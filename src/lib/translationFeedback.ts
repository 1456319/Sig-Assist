import type { DiscrepancyReport } from './clinical/types';
import { getCitrixStorageAdapter } from './citrixStorage';
import { browserRecords } from './browserDatabase';
import { DISCREPANCY_SAVED_EVENT } from './discrepancyCases';
import { feedbackKey, snapshotCopy, type TranslationFeedbackEvent, type TranslationFeedbackSnapshot } from './translationFeedbackModel';
import { workflowObservationState } from './workflowObservation';

type EventInput = Omit<TranslationFeedbackEvent, 'id' | 'at' | 'sequence' | 'appVersion' | 'buildId'>;
interface PendingFeedback { id: string; at: string; order: number; input: TranslationFeedbackSnapshot; event: EventInput; appVersion: string; buildId: string }
const outbox = browserRecords('sig-assist-rating-outbox-v1');
const pending = new Map<string, PendingFeedback>();
const negativeKeys = new Set<string>();
export const FEEDBACK_PENDING_EVENT = 'sig-assist-rating-pending';
let chain: Promise<unknown> = Promise.resolve();
let loading: Promise<void> | undefined;
let counter = 0;
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
function notify() { window.dispatchEvent(new Event(FEEDBACK_PENDING_EVENT)); }
export function pendingFeedback() { return [...pending.values()]; }
export async function loadPendingFeedback() {
  loading ||= outbox.entries().then(entries => {
    for (const [key, value] of entries) {
      const job = value as PendingFeedback;
      if (job?.id === key && job.input && job.event && !pending.has(key)) {
        pending.set(key, job); negativeKeys.add(feedbackKey(job.input));
      }
    }
    notify();
  }).catch(() => { loading = undefined; });
  await loading;
}
export async function findTranslationFeedback(input: TranslationFeedbackSnapshot) {
  const key = feedbackKey(input);
  const found = (await getCitrixStorageAdapter().readDiscrepancies()).find(r => r.translationFeedback?.key === key);
  if (found) negativeKeys.add(key);
  return found;
}
async function persist(job: PendingFeedback): Promise<DiscrepancyReport | undefined> {
  const existing = await findTranslationFeedback(job.input);
  const jobs = [...pending.values()].filter(p => feedbackKey(p.input) === feedbackKey(job.input)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const seed = jobs.find(p => p.event.kind === 'rating' && p.event.rating! < 10);
  if (!existing && !seed) return undefined;
  const original = existing?.translationFeedback?.original || snapshotCopy(seed!.input);
  const events = [...(existing?.translationFeedback?.events || [])];
  for (const p of jobs) if (!events.some(e => e.id === p.id)) {
    events.push({ ...p.event, id: p.id, at: p.at, sequence: Math.max(0, ...events.map(e => e.sequence)) + 1,
      appVersion: p.appVersion, buildId: p.buildId });
  }
  const report: DiscrepancyReport = { ...(existing || { id: `rating_${seed!.id}`, timestamp: seed!.at, pon: original.pon,
    drugName: original.drugName, rawProse: original.rawProse, generatedSig: original.presentedSig,
    technicianSig: original.currentDraft, notes: '', flaggedForRph: false, context: original.context,
    appVersion: job.appVersion, buildId: job.buildId }), storageUpdatedAt: new Date().toISOString(),
    ...(events.some(e => e.draft !== undefined) ? { technicianSig: [...events].reverse().find(e => e.draft !== undefined)!.draft! } : {}),
    ...(events.some(e => e.comment !== undefined) ? { notes: [...events].reverse().find(e => e.comment !== undefined)!.comment! } : {}),
    translationFeedback: { schemaVersion: 1, key: feedbackKey(original), original,
      events } };
  await getCitrixStorageAdapter().appendDiscrepancy(report, { immediate: true });
  negativeKeys.add(feedbackKey(original));
  window.dispatchEvent(new Event(DISCREPANCY_SAVED_EVENT));
  return report;
}
function enqueue(job: PendingFeedback) {
  const run = async () => {
    try { await outbox.put(job.id, job); } catch { /* file/report fallback may still succeed */ }
    const report = await persist(job);
    try { await outbox.remove(job.id); } catch { /* retry is idempotent if an acknowledged job remains */ }
    pending.delete(job.id); notify();
    return report;
  };
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}
export async function saveTranslationFeedback(input: TranslationFeedbackSnapshot, event: EventInput) {
  if (event.kind === 'rating' && (!Number.isInteger(event.rating) || event.rating! < 1 || event.rating! > 10)) return Promise.reject(new Error('Choose a rating from 1 to 10.'));
  const recording = workflowObservationState();
  input = snapshotCopy({ ...input, ...(recording.active && recording.sessionId && input.context ? { context: { ...input.context,
    diagnostics: { ...input.context?.diagnostics, recording: { sessionId: recording.sessionId, status: recording.status, eventSource: recording.eventSource, framesRead: recording.frames, replayGaps: recording.gaps, nativeDrops: recording.dropped } } } } : {}),
    presentationBuildId: input.presentationBuildId ?? __SIG_ASSIST_BUILD__,
    presentationAppVersion: input.presentationAppVersion ?? __SIG_ASSIST_VERSION__ }); event = snapshotCopy(event);
  if (event.kind === 'rating' && event.rating === 10 && !negativeKeys.has(feedbackKey(input)) && !await findTranslationFeedback(input)) return undefined;
  const job: PendingFeedback = { id: id(), at: new Date().toISOString(), order: Date.now() * 1000 + counter++ % 1000, input, event,
    appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__ };
  pending.set(job.id, job); notify();
  if (event.kind === 'rating' && event.rating! < 10) negativeKeys.add(feedbackKey(input));
  return enqueue(job);
}
export async function retryTranslationFeedback() {
  await loadPendingFeedback();
  for (const job of [...pending.values()]) { try { await enqueue(job); } catch { /* retain evidence for retry/download */ } }
}
export function captureFeedbackCorrection(input: TranslationFeedbackSnapshot, draft: string, verifiedTransfer = false) {
  if (!negativeKeys.has(feedbackKey(input))) return;
  void saveTranslationFeedback(input, { kind: verifiedTransfer ? 'verified_transfer' : 'corrected_copy', draft }).catch(() => {});
}
