import { parseScriptLog } from './iguana/payload';
import { ingestScriptEvents } from './iguana/intake';
import { queryIguana } from './iguana/client';
import { initialConnectorConfig, daysAgoMidnight } from './iguana/config';
import type { QueueOrder } from './orderQueue';

export interface FrameworkSigSnapshot { ok: boolean; code?: string; pon?: string; sig?: string; drug?: string; observedAt?: string; partial?: boolean }
export async function readFrameworkSigSnapshot(signal?: AbortSignal): Promise<FrameworkSigSnapshot> {
  const response = await fetch('/connector/desktop/dataset-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'Restart the connector from the newest prototype ZIP to use passive SIG collection.' : `SIG snapshot returned HTTP ${response.status}.`);
  return response.json();
}

// This is an exact source lookup only, never an order selection or processing
// action. Returned source text stays in the local browser dataset.
export async function findDatasetSource(pon: string, signal: AbortSignal): Promise<QueueOrder | undefined> {
  const quiet = () => {};
  for (const days of [1, 7]) {
    const result = await queryIguana({ ...initialConnectorConfig(), filter: pon, after: daysAgoMidnight(days), before: '' }, quiet, signal);
    const events = result.logs.flatMap(log => parseScriptLog(log, quiet));
    const intake = ingestScriptEvents([], events, () => '', quiet);
    const matches = intake.orders.filter(order => order.pon.trim() === pon && !order.intakeHold);
    if (matches.length === 1 && !result.saturated) return matches[0];
    if (matches.length > 1 || result.saturated) return undefined;
  }
  return undefined;
}
