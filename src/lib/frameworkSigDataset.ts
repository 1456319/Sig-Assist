import { parseScriptLog } from './iguana/payload';
import { ingestScriptEvents } from './iguana/intake';
import { queryIguana } from './iguana/client';
import { initialConnectorConfig, daysAgoMidnight } from './iguana/config';
import { sourceStamp, type QueueOrder } from './orderQueue';

export interface FrameworkSigSnapshot { ok: boolean; code?: string; pon?: string; sig?: string; drug?: string; observedAt?: string; partial?: boolean; retryAfterMs?: number }
export function frameworkSnapshotStatus(snapshot: FrameworkSigSnapshot): string {
  if (snapshot.code === 'PASSIVE_PAUSED') {
    const seconds = Number.isFinite(snapshot.retryAfterMs) ? Math.ceil(Math.min(60000, Math.max(0, snapshot.retryAfterMs!)) / 1000) : undefined;
    return `Background Framework reads are paused${seconds === undefined ? '' : ` for about ${seconds} seconds`} after a stalled read. Technician actions remain available.`;
  }
  if (snapshot.code === 'FRAMEWORK_NOT_RESPONDING') return 'Framework is not responding. Background reads will pause before retrying; existing dataset samples are retained.';
  if (snapshot.code === 'READ_TIMEOUT') return 'The Framework read timed out. Background reads will pause before retrying; existing dataset samples are retained.';
  if (snapshot.code === 'BUSY') return 'Framework is handling another operation. Collection will retry on the next poll.';
  if (snapshot.code === 'SELECTION_REQUIRED' || snapshot.code === 'WINDOW_UNAVAILABLE') return `Framework: ${snapshot.code}. Choose the entry window once through Find E-Rx.`;
  return `Framework: ${snapshot.code || 'No uniquely associated PON and SIG are readable'}. Collection will retry when the current order fields are readable.`;
}
export async function readFrameworkSigSnapshot(signal?: AbortSignal): Promise<FrameworkSigSnapshot> {
  const response = await fetch('/connector/desktop/dataset-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'Restart the connector from the newest prototype ZIP to use passive SIG collection.' : `SIG snapshot returned HTTP ${response.status}.`);
  return response.json();
}

// This is an exact source lookup only, never an order selection or processing
// action. Returned source text stays in the local browser dataset.
export async function findDatasetSource(pon: string, signal: AbortSignal): Promise<QueueOrder | undefined> {
  const quiet = () => {};
  let recent: QueueOrder | undefined;
  for (const days of [1, 7]) {
    const result = await queryIguana({ ...initialConnectorConfig(), filter: pon, after: daysAgoMidnight(days), before: '' }, quiet, signal);
    const events = result.logs.flatMap(log => parseScriptLog(log, quiet));
    const intake = ingestScriptEvents([], events, () => '', quiet);
    const matches = intake.orders.filter(order => order.pon.trim() === pon && !order.intakeHold);
    if (matches.length > 1 || result.saturated) return undefined;
    if (days === 1) recent = matches[0];
    else if (matches.length === 1 && !matches[0].cancelled && (!recent || sourceStamp(recent) === sourceStamp(matches[0]))) return matches[0];
  }
  return undefined;
}
