import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SigDatasetPanel } from '../src/components/SigDatasetPanel';
import { ReviewContext } from '../src/hooks/use-review-session';
import type { QueueOrder } from '../src/lib/orderQueue';

const mocks = vi.hoisted(() => ({ queue: vi.fn(), read: vi.fn(), find: vi.fn() }));
vi.mock('../src/lib/sigDataset', () => ({ sigDatasetStore: { stats: async () => ({ total: 0, stages: {} }), exportPosition: async () => 0 } }));
vi.mock('../src/lib/sigDatasetCapture', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/sigDatasetCapture')>(), queueSigSample: mocks.queue,
}));
vi.mock('../src/lib/frameworkSigDataset', () => ({ readFrameworkSigSnapshot: mocks.read, findDatasetSource: mocks.find }));

const original: QueueOrder = { id: 'synthetic-a', facility: 'A', patientRef: 'synthetic-patient', pon: 'SYN-PAIR:01',
  drug: 'Synthetic tablet', directions: 'Original source directions', revision: 1, previousSources: [], draft: '', cancelled: false };
const panel = (orders: QueueOrder[]) => <ReviewContext.Provider value={{ orders, ready: true, setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 }}><SigDatasetPanel /></ReviewContext.Provider>;
const samples = () => mocks.queue.mock.calls.map(([row]) => row).filter(row => row.stage === 'framework_observed');
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(5000); });
async function start(orders: QueueOrder[] = []) {
  const view = render(panel(orders));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start passive Framework SIG collection' })); });
  return view;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); mocks.queue.mockResolvedValue(true);
  mocks.read.mockResolvedValue({ ok: true, pon: original.pon, sig: 'OBSERVED SIG' });
  mocks.find.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('passive observation provenance', () => {
  it('labels a sole live PON match as a candidate requiring confirmation', async () => {
    await start([original]);
    expect(samples()).toHaveLength(1);
    expect(samples()[0]).toMatchObject({ orderKey: original.id, sourceMatch: 'pon_candidate', finalSig: 'OBSERVED SIG', stage: 'framework_observed' });
  });

  it('records unchanged field text again when its candidate source revision changes', async () => {
    const view = await start([original]);
    view.rerender(panel([{ ...original, revision: 2, directions: 'Revised source directions' }]));
    await tick();
    expect(samples().map(row => row.revision)).toEqual([1, 2]);
    await tick();
    expect(samples()).toHaveLength(2);
  });

  it('never reuses a cached source after the queue empties and its PON is reused', async () => {
    mocks.find.mockResolvedValueOnce(original).mockResolvedValue(undefined);
    const view = await start();
    expect(samples().map(row => row.orderKey)).toEqual([`framework:${original.pon}`, original.id]);
    view.rerender(panel([]));
    mocks.read.mockResolvedValue({ ok: true, pon: original.pon, sig: 'A DIFFERENT ORDER SIG' });
    await tick();
    expect(samples().at(-1)).toMatchObject({ orderKey: `framework:${original.pon}`, rawSig: 'A DIFFERENT ORDER SIG', sourceMatch: 'unpaired' });
    expect(samples().filter(row => row.orderKey === original.id)).toHaveLength(1);
  });

  it.each(['field', 'queue', 'unreadable'])('discards delayed source enrichment after the %s changes', async change => {
    let finish!: (source: QueueOrder) => void;
    mocks.find.mockImplementationOnce(() => new Promise<QueueOrder>(resolve => { finish = resolve; }));
    const view = await start();
    if (change === 'field') mocks.read.mockResolvedValue({ ok: true, pon: 'SYN-PAIR:02', sig: 'NEXT OBSERVATION' });
    if (change === 'queue') view.rerender(panel([{ ...original, revision: 2 }]));
    if (change === 'unreadable') mocks.read.mockResolvedValue({ ok: false, code: 'PON_UNAVAILABLE' });
    await tick();
    await act(async () => { finish(original); });
    expect(samples().filter(row => row.orderKey === original.id && row.revision === 1)).toHaveLength(0);
  });

  it('keeps ambiguous PON observations unpaired and skips lookup', async () => {
    await start([original, { ...original, id: 'synthetic-b', facility: 'B' }]);
    expect(samples()).toHaveLength(1);
    expect(samples()[0]).toMatchObject({ sourceMatch: 'unpaired', captureKind: 'framework_sig_observation' });
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
