import type { DiscrepancyReport, TechnicianPreferences } from './clinical/types';

export type ExplanationMode = 'obvious' | 'brief' | 'none' | 'detailed' | 'later';
export interface TranslationFeedbackSnapshot {
  orderKey: string;
  pon: string;
  drugName: string;
  rawProse: string;
  generatedSig: string;
  presentedSig: string;
  currentDraft: string;
  partId?: string;
  presentationBuildId?: string;
  presentationAppVersion?: string;
  context?: DiscrepancyReport['context'];
  preferences?: Partial<TechnicianPreferences>;
}
export interface TranslationFeedbackEvent {
  id: string;
  at: string;
  sequence: number;
  kind: 'rating' | 'explanation' | 'comment' | 'corrected_copy' | 'verified_transfer' | 'retranslation';
  rating?: number;
  mode?: ExplanationMode;
  comment?: string;
  draft?: string;
  resolved?: boolean;
  appVersion: string;
  buildId: string;
  retranslation?: { sig: string; preferences?: Partial<TechnicianPreferences> };
}
export interface TranslationFeedbackData {
  schemaVersion: 1;
  key: string;
  original: TranslationFeedbackSnapshot;
  events: TranslationFeedbackEvent[];
}
export const snapshotCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Manual edits do not create a new automatic-translation identity. */
export function feedbackKey(input: TranslationFeedbackSnapshot): string {
  return JSON.stringify([input.orderKey, input.partId, input.pon, input.drugName, input.rawProse, input.generatedSig,
    input.presentedSig, input.context?.source, input.context?.revision, input.context?.policyRevision,
    input.context?.exclusions, input.context?.defaultSigTemplate, input.preferences,
    input.presentationBuildId ?? __SIG_ASSIST_BUILD__]);
}
export function feedbackState(report: DiscrepancyReport) {
  let rating: number | undefined;
  let mode: ExplanationMode | undefined;
  let comment = '';
  let resolved = false;
  for (const event of report.translationFeedback?.events || []) {
    if (event.kind === 'rating') { rating = event.rating; mode = undefined; resolved = false; }
    if (event.mode) { mode = event.mode; resolved = mode === 'obvious' || mode === 'none'; }
    if (event.comment !== undefined) comment = event.comment;
    if (event.resolved !== undefined) resolved = event.resolved;
  }
  return { rating, mode, comment, resolved, deferred: mode === 'later' && !resolved };
}
export function mergeFeedbackHistory(a: DiscrepancyReport, b: DiscrepancyReport, latest: DiscrepancyReport): DiscrepancyReport {
  const first = a.translationFeedback || b.translationFeedback;
  if (!first) return latest;
  if (a.translationFeedback && b.translationFeedback && a.translationFeedback.key !== b.translationFeedback.key) {
    throw new Error('Feedback identity conflict. Existing evidence was preserved.');
  }
  const events = new Map<string, TranslationFeedbackEvent>();
  for (const event of [...(a.translationFeedback?.events || []), ...(b.translationFeedback?.events || [])]) {
    if (!events.has(event.id)) events.set(event.id, event);
  }
  const history = [...events.values()].sort((x, y) => x.sequence - y.sequence || x.at.localeCompare(y.at) || x.id.localeCompare(y.id));
  return { ...latest, pon: first.original.pon, drugName: first.original.drugName, rawProse: first.original.rawProse,
    generatedSig: first.original.presentedSig, context: first.original.context,
    technicianSig: [...history].reverse().find(e => e.draft !== undefined)?.draft ?? latest.technicianSig,
    notes: [...history].reverse().find(e => e.comment !== undefined)?.comment ?? latest.notes,
    translationFeedback: { ...first, events: history } };
}
