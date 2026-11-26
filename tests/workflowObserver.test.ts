// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error Dependency-free connector module.
import { createWorkflowObserver, nativeObservationEvent } from '../scripts/framework-observer.mjs';
// @ts-expect-error Dependency-free connector module.
import { createDesktopSession, normalizeWorkflowSnapshot } from '../scripts/framework-desktop.mjs';

type Frame = { id: number; kind: string; pon?: string; fields?: Record<string, string>; control?: string; outcome?: string };
const observers: Array<{ stop(): void }> = [];
afterEach(() => { for (const observer of observers.splice(0)) observer.stop(); vi.useRealTimers(); });
const snapshot = (pon = 'DUMMY:1', sig = '1T PO QD') => ({ ok: true, code: 'OK', pon, view: 'rx_entry', fields: { draft_sig: sig, message_sig: 'Take one tablet daily', quantity: '30' }, unavailable: [], sigMode: 'order' });
function setup(options: Record<string, unknown> = {}) {
  vi.useFakeTimers();
  const records: Frame[] = [], close = vi.fn(); let emit: (event: unknown) => void = () => {};
  const desktop = Object.assign(vi.fn(async () => snapshot()), { observationBinding: vi.fn(() => ({ pid: 123, started: '1', id: 'root', handle: 456 })) });
  const observer = createWorkflowObserver({ desktop, onRecord: async (frame: Frame) => { records.push(frame); return true; },
    subscribeNative: async (_binding: unknown, listener: typeof emit) => { emit = listener; return close; }, ...options });
  observers.push(observer); observer.start('session-1');
  return { observer, desktop, records, close, event: (event: unknown) => emit(event) };
}

it('coalesces event bursts, captures order transitions and field edits without checkpoints, and never overlaps reads', async () => {
  const { desktop, records, event, observer } = setup();
  await vi.advanceTimersByTimeAsync(500); expect(desktop).toHaveBeenCalledTimes(1);
  expect(records[0]).toMatchObject({ kind: 'order_visible', pon: 'DUMMY:1', outcome: 'unverified' });
  for (let n = 0; n < 20; n++) { event({ kind: 'changed' }); await vi.advanceTimersByTimeAsync(25); }
  desktop.mockResolvedValue(snapshot('DUMMY:2', '2T PO BID'));
  await vi.advanceTimersByTimeAsync(500); expect(desktop).toHaveBeenCalledTimes(2);
  expect(records.at(-1)).toMatchObject({ kind: 'order_changed', pon: 'DUMMY:2', fields: { draft_sig: '2T PO BID' } });
  event({ kind: 'invoked', control: 'NextButton' }); await observer.drain();
  expect(records.at(-1)).toMatchObject({ kind: 'button_invoked', control: 'NextButton', outcome: 'unverified' });
  expect(records.some(row => /saved|completed/.test(row.kind))).toBe(false);
  desktop.mockResolvedValue(snapshot('DUMMY:2', '3T PO QD'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(records.at(-1)).toMatchObject({ kind: 'fields_changed', fields: { draft_sig: '3T PO QD' } });
});

it('uses bounded fallback polling without event support and backs off stalled providers', async () => {
  const { desktop, observer, records } = setup({ subscribeNative: async () => { throw new Error('not supported'); } });
  desktop.mockResolvedValue({ ok: false, code: 'READ_TIMEOUT' } as ReturnType<typeof snapshot>);
  await vi.advanceTimersByTimeAsync(500); expect(desktop).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(9000); expect(desktop).toHaveBeenCalledTimes(1);
  desktop.mockResolvedValue(snapshot());
  await vi.advanceTimersByTimeAsync(1200); expect(desktop).toHaveBeenCalledTimes(2);
  expect(observer.updates().eventSource).toBe('polling_fallback');
  expect(records.map(row => row.kind)).toEqual(['observation_unavailable', 'order_visible']);
});

it('discards reads from replaced bindings and releases subscriptions on stop', async () => {
  let resolve: (data: unknown) => void = () => {};
  const { desktop, records, close, observer } = setup();
  desktop.mockImplementationOnce(() => new Promise(r => { resolve = r; }) as Promise<ReturnType<typeof snapshot>>);
  await vi.advanceTimersByTimeAsync(500);
  desktop.observationBinding.mockReturnValue({ pid: 123, started: '1', id: 'replacement', handle: 456 });
  resolve(snapshot()); await vi.advanceTimersByTimeAsync(1); expect(records).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(5000); expect(records).toHaveLength(1); expect(close).toHaveBeenCalledTimes(1);
  await observer.finish(); expect(close).toHaveBeenCalledTimes(2);
  const calls = desktop.mock.calls.length; await vi.advanceTimersByTimeAsync(20000); expect(desktop).toHaveBeenCalledTimes(calls);
});

it('only exposes acknowledged frames, reports ring gaps, preserves queued writes on finish, and stops on local write failure', async () => {
  let release: (value: boolean) => void = () => {};
  const onRecord = vi.fn(() => new Promise<boolean>(resolve => { release = resolve; }));
  const { observer, event } = setup({ onRecord, ringLimit: 2 });
  await vi.advanceTimersByTimeAsync(500); expect(observer.updates().frames).toHaveLength(0);
  release(true); await observer.drain(); expect(observer.updates().frames).toHaveLength(1);
  onRecord.mockResolvedValue(true);
  event({ kind: 'invoked', control: 'save' }); event({ kind: 'invoked', control: 'back' });
  await observer.finish();
  expect(observer.updates().frames).toHaveLength(2); expect(observer.updates(0, 'session-1').gaps).toBe(1);
  expect(onRecord.mock.calls.length).toBe(3);
  observer.start('session-2'); onRecord.mockResolvedValue(false); await vi.advanceTimersByTimeAsync(500);
  await observer.drain(); expect(observer.active()).toBe(false); expect(observer.updates().status).toBe('LOCAL_WRITE_STOPPED');
});

it('keeps unrecognized event names and snapshot diagnostics out of the observation contract', () => {
  expect(nativeObservationEvent({ kind: 'invoked', control: 'PRIVATE PATIENT NAME', password: 'secret' })).toEqual({ kind: 'invoked', control: 'button', suppressed: 0 });
  expect(nativeObservationEvent({ kind: 'private event' })).toBeNull();
  expect(normalizeWorkflowSnapshot({ ...snapshot(), fields: { draft_sig: 'VALID SIG', password: 'SECRET' }, patientName: 'DO NOT RETURN' })).toMatchObject({ fields: { draft_sig: 'VALID SIG' } });
  expect(JSON.stringify(normalizeWorkflowSnapshot({ ...snapshot(), partial: true }))).not.toContain('VALID');
});

it('gives queued technician work priority and sanitizes the new passive action', async () => {
  let release: (data: unknown) => void = () => {};
  const entry = { pid: 123, started: '1', id: 'root', handle: 456 };
  const run = vi.fn(async (input: { action: string }) => input.action === 'detect' ? { ok: true, entryWindow: entry } : snapshot());
  const desktop = createDesktopSession({ run }); await desktop('detect');
  expect(desktop.observationBinding()).toEqual(entry);
  run.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }) as ReturnType<typeof run>);
  const passive = desktop('workflow-snapshot'), clinical = desktop('inspect');
  expect((await desktop('workflow-snapshot')).code).toBe('BUSY');
  release(snapshot()); expect((await passive).ok).toBe(true); await clinical;
  expect(run.mock.calls.at(-1)?.[0].action).toBe('inspect');
});
