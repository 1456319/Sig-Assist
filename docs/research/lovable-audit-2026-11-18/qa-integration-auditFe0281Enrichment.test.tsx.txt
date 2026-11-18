import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

const pon = 'SYN-RETRY:01';
const original: QueueOrder = { id: 'synthetic-a', facility: 'A', patientRef: '', pon, drug: 'Synthetic tablet', directions: 'Synthetic source directions', revision: 1, previousSources: [], draft: '', cancelled: false };
const value = 'SYNTHETIC FIELD TEXT';
const panel = (orders: QueueOrder[]) => <ReviewContext.Provider value={{ orders, ready: true, setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 }}><SigDatasetPanel /></ReviewContext.Provider>;
const fieldSamples = () => mocks.queue.mock.calls.map(([row]) => row).filter(row => row.stage === 'framework_observed');
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function start() {
  const view = render(panel([]));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start passive Framework SIG collection' })); });
  return view;
}

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  mocks.queue.mockResolvedValue(true);
  mocks.read.mockResolvedValue({ ok: true, pon, sig: value });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('keeps the raw field and retries a thrown lookup once even if the unchanged field is deduplicated', async () => {
  mocks.find.mockRejectedValueOnce(new Error('Synthetic transient failure')).mockResolvedValueOnce(original);
  await start();
  expect(fieldSamples().map(row => row.orderKey)).toEqual([`framework:${pon}`]);
  expect(mocks.find).toHaveBeenCalledTimes(1);
  await tick(25_000);
  expect(mocks.read).toHaveBeenCalledTimes(6);
  expect(mocks.find).toHaveBeenCalledTimes(1);
  await tick(5_000);
  expect(fieldSamples().map(row => [row.orderKey, row.finalSig])).toEqual([[`framework:${pon}`, value], [original.id, value]]);
  await tick(60_000);
  expect(mocks.find).toHaveBeenCalledTimes(2);
});

it('does not retry an ordinary no-result lookup', async () => {
  mocks.find.mockResolvedValue(undefined);
  await start(); await tick(60_000);
  expect(mocks.find).toHaveBeenCalledTimes(1);
  expect(fieldSamples().map(row => row.orderKey)).toEqual([`framework:${pon}`]);
});

it('stops retrying after a second rejection', async () => {
  mocks.find.mockRejectedValue(new Error('Synthetic outage'));
  await start(); await tick(120_000);
  expect(mocks.find).toHaveBeenCalledTimes(2);
  expect(fieldSamples().map(row => row.orderKey)).toEqual([`framework:${pon}`]);
});

it('does not retry after two exact-PON Queue siblings appear during the cooldown', async () => {
  mocks.find.mockRejectedValueOnce(new Error('Synthetic transient failure')).mockResolvedValueOnce(original);
  const view = await start();
  view.rerender(panel([original, { ...original, id: 'synthetic-b', facility: 'B' }]));
  await tick(60_000);
  expect(mocks.find).toHaveBeenCalledTimes(1);
  expect(fieldSamples().map(row => row.orderKey)).toEqual([`framework:${pon}`]);
});
