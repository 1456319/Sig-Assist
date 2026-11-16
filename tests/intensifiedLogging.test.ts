import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IntensifiedRecorder, summarizeTrace, type JournalStatus, type JournalEvent } from '../src/lib/diagnostics/intensifiedLogging';
import { traceLogger } from '../src/lib/diagnostics/traceLogger';
import { recordPilotEvent } from '../src/lib/pilotDiagnostics';
const recorders: IntensifiedRecorder[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => { recorders.splice(0).forEach(r => r.dispose()); vi.restoreAllMocks(); });
function setup(capacity = 10000) {
  let status: JournalStatus = { ok: true, active: true, configured: true, sessionId: 'test-session' };
  const api = vi.fn(async (action: string, body?: Record<string, unknown>) => { void body; if (action === 'stop') status = { ...status, active: false }; return status; });
  const recorder = new IntensifiedRecorder(api, localStorage, capacity); recorders.push(recorder); return { recorder, api };
}

it('captures live events beyond the trace ring without sending clinical text, identifiers, credentials or raw exceptions', async () => {
  const { recorder, api } = setup(); await recorder.connect();
  for (let i = 0; i < 1100; i++) traceLogger.debug('clinical', 'clinicalEngine', 'PRIVATE MESSAGE', { pon: 'PRIVATE-PON', drugName: 'PRIVATE-DRUG', primarySig: 'PRIVATE-SIG', abnormalitiesCount: 2 }, 'PRIVATE-TRACE');
  recordPilotEvent('screen.open', { screen: 'queue' });
  await recorder.flush();
  const batches = api.mock.calls.filter(([action]) => action === 'events').map(([, body]) => body!);
  expect(batches.flatMap(b => b.events as JournalEvent[]).filter(e => e.code === 'trace')).toHaveLength(1100);
  expect(JSON.stringify(batches)).not.toContain('PRIVATE');
  expect(batches.flatMap(b => b.events as JournalEvent[]).find(e => e.code === 'screen.open')).toBeTruthy();
  expect(recorder.getState().pending).toBe(0);
});

it('retains an unacknowledged batch, retries its exact ID, and restores pending events after a page reload', async () => {
  const { recorder, api } = setup(); await recorder.connect(); recorder.record('browser.click', { tag: 'button' });
  api.mockImplementationOnce(async () => { throw new Error('Acknowledgement lost'); });
  await recorder.flush(); expect(recorder.getState().pending).toBeGreaterThan(0);
  const first = api.mock.calls.find(([action]) => action === 'events')![1]!;
  recorder.dispose();
  const second = new IntensifiedRecorder(api, localStorage); recorders.push(second); await second.connect(); await second.flush();
  const retry = api.mock.calls.filter(([action]) => action === 'events')[1][1]!;
  expect(retry.batchId).toBe(first.batchId); expect(retry.events).toEqual(first.events); expect(second.getState().pending).toBe(0);
});

it('separates queue budgets so a translation burst cannot displace workflow and records dropped counts', async () => {
  const { recorder, api } = setup(2); await recorder.connect();
  for (let i = 0; i < 10; i++) recorder.record('trace', { messageLength: 3 });
  recorder.record('screen.open', { screen: 'queue' }); await recorder.flush();
  const events = api.mock.calls.filter(([a]) => a === 'events').flatMap(([, body]) => body!.events as JournalEvent[]);
  expect(events.find(e => e.code === 'screen.open')).toBeTruthy();
  expect(events.find(e => e.code === 'browser.overflow')!.fields.droppedTranslation).toBe(8);
});

it('preserves an unreadable outbox and still exposes a persistence warning while saving live events to the connector', async () => {
  localStorage.setItem('sig_assist_intensified_outbox_v1_test-session', '{broken');
  const { recorder } = setup(); await recorder.connect(); recorder.record('browser.error'); await recorder.flush();
  expect(localStorage.getItem('sig_assist_intensified_outbox_v1_test-session')).toBe('{broken'); expect(recorder.getState().outboxError).toBe(true);
});

it('ignores password fields and records ordinary interactions without their values or labels', async () => {
  const { recorder, api } = setup(); await recorder.connect();
  const input = document.createElement('input'); input.type = 'password'; input.value = 'PRIVATE-PASSWORD'; document.body.append(input); input.dispatchEvent(new Event('change', { bubbles: true }));
  input.type = 'text'; input.value = 'PRIVATE-PATIENT'; input.dispatchEvent(new Event('change', { bubbles: true })); await recorder.flush(); input.remove();
  const events = api.mock.calls.filter(([a]) => a === 'events').flatMap(([, body]) => body!.events as JournalEvent[]);
  expect(events.filter(e => e.code === 'browser.change')).toHaveLength(1); expect(JSON.stringify(events)).not.toContain('PRIVATE');
  expect(summarizeTrace({ id: 'secret', traceId: 'secret', timestamp: '', layer: 'clinical', level: 'WARN', component: 'unknown PHI', message: 'secret' }, 'trace-1')).toMatchObject({ component: 'other', messageLength: 6 });
});
