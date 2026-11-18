import { sigDatasetStore, type SigDatasetInput, type SigDatasetStage } from './sigDataset';
import type { QueueOrder } from './orderQueue';
import type { SigExclusion } from './reviewPolicy';

type Pending = { input: SigDatasetInput; waiting: Array<(saved: boolean) => void> };
const pending = new Map<string, Pending>();
const listeners = new Set<() => void>();
let active = false, enabled = true, error = '', saved = 0, noticeTimer: ReturnType<typeof setTimeout> | undefined;
function notify() {
  if (noticeTimer) return;
  noticeTimer = setTimeout(() => { noticeTimer = undefined; for (const listener of listeners) listener(); }, 100);
}
export function datasetCaptureState() { return { enabled, pending: pending.size, error, saved }; }
export function subscribeDatasetCapture(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setDatasetCaptureEnabled(value: boolean) { enabled = value; notify(); }
export function pendingDatasetExport() {
  return [...pending.values()].map(({ input }) => {
    // Identity inputs stay in memory only, including in emergency downloads.
    const observation = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'orderKey' && key !== 'partId'));
    return { format: 'sig-assist-unsaved-sig-observation', schemaVersion: 1, ...observation };
  });
}
async function drain() {
  if (active || error) return;
  active = true;
  try {
    for (const [key, item] of pending) {
      try {
        const result = await sigDatasetStore.record(item.input);
        pending.delete(key); if (result.added) saved++;
        item.waiting.splice(0).forEach(resolve => resolve(true));
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'Dataset storage failed.';
        // Keep each unsaved observation for retry; no success acknowledgment.
        for (const queued of pending.values()) queued.waiting.splice(0).forEach(resolve => resolve(false));
        break;
      }
      notify();
    }
  } finally { active = false; notify(); }
}
export function retryDatasetCapture() { error = ''; void drain(); notify(); }
export function queueSigSample(input: SigDatasetInput): Promise<boolean> {
  if (!enabled) return Promise.resolve(false);
  const key = JSON.stringify([input, __SIG_ASSIST_BUILD__]);
  let item = pending.get(key);
  if (!item) { item = { input, waiting: [] }; pending.set(key, item); }
  notify();
  if (error) return Promise.resolve(false);
  const result = new Promise<boolean>(resolve => item!.waiting.push(resolve));
  void drain(); return result;
}

export function orderDatasetInput(order: QueueOrder, stage: SigDatasetStage, options: {
  suggestion?: string; generatedSig?: string; finalSig?: string; partId?: string;
  exclusions?: SigExclusion[]; warnings?: string[]; comment?: string; acceptable?: boolean;
} = {}): SigDatasetInput {
  const metadata = order.iguana;
  const { suggestion, ...details } = options;
  return {
    orderKey: order.id, revision: order.revision, stage, drug: order.drug, rawSig: order.directions,
    captureKind: 'erx_source', origin: order.iguana ? 'iguana' : 'manual', suggestedSig: suggestion, ...details,
    context: metadata ? { ndc: metadata.ndc, strength: metadata.strength, dose: metadata.dose, doseUnit: metadata.doseUnit,
      route: metadata.route, frequency: metadata.frequency, administrationTimes: metadata.administrationTimes } : undefined,
  };
}
