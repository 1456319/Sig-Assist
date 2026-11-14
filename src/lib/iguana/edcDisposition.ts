import type { EdcDocument } from '../docutrackQueue';
import { daysAgoMidnight } from './config';
import { queryIguana } from './client';
import { parseScriptLog } from './payload';
import type { ConnectorConfig, DiagnosticSink, IguanaLog, ScriptEvent } from './types';

/**
 * PILOT ONLY — E-DC lifecycle evidence, not a Framework order-status API.
 * No result of an Iguana log search establishes that a NewRx is still pending.
 * Replace "outbound activity" with a definite refusal/processing outcome ONLY
 * after validating the site's outbound message schema against a dummy refusal.
 */
export type EdcEvidenceKind = 'incomplete' | 'outbound-activity' | 'cancelrx-seen' | 'newrx-history' | 'no-evidence';

export interface EdcDispositionEvidence {
  kind: EdcEvidenceKind;
  checkedAt: number;
  complete: boolean;
  newRxSeen: boolean;
  cancelRxSeen: boolean;
  outboundSeen: boolean;
  outboundTypes: string[];
}

export function edcEvidenceKey(doc: Pick<EdcDocument, 'pon' | 'facility'>) {
  return JSON.stringify([doc.pon.trim(), doc.facility.trim().toUpperCase()]);
}

export function edcEvidenceDescription(evidence?: EdcDispositionEvidence): string {
  if (!evidence) return 'Not checked — NewRx disposition unknown';
  if (!evidence.complete) return 'Incomplete check — verify directly in Framework';
  if (evidence.outboundSeen) return 'Paxit VA–FW Outbound activity found — type not yet verified as a refusal';
  if (evidence.cancelRxSeen) return 'CancelRx received — not proof of a Framework refusal';
  if (evidence.newRxSeen) return 'Historical NewRx found — current status unknown';
  return 'No matching logs found in the seven-day window — current status unknown';
}

const noDiagnosticExport: DiagnosticSink = () => { /* No PON, resident or log payload in shared diagnostics. */ };
type LogReader = typeof queryIguana;

function exactPonInText(payload: string, pon: string) {
  const escaped = pon.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-z0-9_.:/-])' + escaped + '(?=$|[^A-Za-z0-9_.:/-])').test(payload);
}

function eventForDocument(event: ScriptEvent, doc: EdcDocument): boolean {
  if (event.pon !== doc.pon) return false;
  if (doc.facility && event.facility && doc.facility.toUpperCase() !== event.facility.toUpperCase()) return false;
  return true;
}

export async function verifyEdcDispositions(
  documents: EdcDocument[],
  config: ConnectorConfig,
  signal: AbortSignal,
  onResult: (document: EdcDocument, evidence: EdcDispositionEvidence) => void,
  readLogs: LogReader = queryIguana,
): Promise<void> {
  const byPon = new Map<string, EdcDocument[]>();
  for (const document of documents) {
    const group = byPon.get(document.pon) ?? [];
    group.push(document);
    byPon.set(document.pon, group);
  }
  const pons = [...byPon.keys()];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < pons.length && !signal.aborted) {
      const pon = pons[nextIndex++];
      const results: { logs: IguanaLog[]; saturated: boolean }[] = [];
      let complete = true;
      // These are evidence searches, not the ongoing intake cursor.
      // Use the exact PON filter with a bounded seven-day window.
      for (const channel of ['MessageBroker', 'Paxit: VA - FW Outbound']) {
        if (signal.aborted) return;
        try {
          const result = await readLogs({
            ...config, channel, filter: pon, after: daysAgoMidnight(7),
            before: '', limit: Math.min(5000, Math.max(1, config.limit || 1000)),
          }, noDiagnosticExport, signal);
          results.push(result);
          if (result.saturated) complete = false;
        } catch {
          if (signal.aborted) return;
          complete = false;
          results.push({ logs: [], saturated: false });
        }
      }
      if (signal.aborted) return;
      const [inbound, outbound] = results;
      const inboundEvents = inbound.logs.flatMap(log => parseScriptLog(log, noDiagnosticExport));
      const outboundEvents = outbound.logs.flatMap(log => parseScriptLog(log, noDiagnosticExport));
      for (const doc of byPon.get(pon) ?? []) {
        const matchingInbound = inboundEvents.filter(event => eventForDocument(event, doc));
        const matchingOutbound = outboundEvents.filter(event => eventForDocument(event, doc));
        const newRxSeen = matchingInbound.some(event => event.kind.toLowerCase() === 'newrx');
        const cancelRxSeen = matchingInbound.some(event => event.kind.toLowerCase() === 'cancelrx');
        // A PON in an unclassified outbound log is evidence of traffic, NOT
        // an accepted, rejected, processed, or refused Framework request.
        const outboundSeen = matchingOutbound.length > 0 ||
          outbound.logs.some(log => exactPonInText(log.payload, pon));
        const outboundTypes = [...new Set(matchingOutbound.map(event => event.kind))];
        const kind: EdcEvidenceKind = !complete ? 'incomplete' :
          outboundSeen ? 'outbound-activity' : cancelRxSeen ? 'cancelrx-seen' :
          newRxSeen ? 'newrx-history' : 'no-evidence';
        onResult(doc, { kind, checkedAt: Date.now(), complete, newRxSeen, cancelRxSeen, outboundSeen, outboundTypes });
      }
    }
  }
  // At most two concurrent Iguana searches. Never run a request per row at once.
  await Promise.all([worker(), worker()]);
}
