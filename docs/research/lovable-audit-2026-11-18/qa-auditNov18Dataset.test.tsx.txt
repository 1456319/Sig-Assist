import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SigDatasetConfirmation, SigDatasetPanel } from '../src/components/SigDatasetPanel';
import { ReviewContext } from '../src/hooks/use-review-session';
import type { QueueOrder } from '../src/lib/orderQueue';

const mocks = vi.hoisted(() => ({ queue: vi.fn(), read: vi.fn(), find: vi.fn() }));
vi.mock('../src/lib/sigDataset', () => ({ sigDatasetStore: { stats: async () => ({ total: 0, stages: {} }), exportPosition: async () => 0 } }));
vi.mock('../src/lib/sigDatasetCapture', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/sigDatasetCapture')>(), queueSigSample: mocks.queue,
}));
vi.mock('../src/lib/frameworkSigDataset', () => ({ readFrameworkSigSnapshot: mocks.read, findDatasetSource: mocks.find }));

const order = (id: string, facility: string): QueueOrder => ({
  id, facility, patientRef: '', pon: 'SYN-X:01', drug: 'Synthetic tablet', directions: 'Synthetic source directions',
  revision: 1, previousSources: [], draft: 'COMBINED DRAFT', cancelled: false,
});
const original = order('synthetic-A', 'A');
const parts = [
  { id: 'am', label: 'Morning', sig: 'EDITED MORNING DRAFT', suggestion: 'MORNING SUGGESTION' },
  { id: 'pm', label: 'Evening', sig: 'EDITED EVENING DRAFT', suggestion: 'EVENING SUGGESTION' },
];
const panel = (orders: QueueOrder[]) => <ReviewContext.Provider value={{ orders, ready: true, setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 }}><SigDatasetPanel /></ReviewContext.Provider>;
function openSplit() {
  render(<SigDatasetConfirmation order={original} suggestion="COMBINED SUGGESTION" exclusions={[]} parts={parts} />);
  fireEvent.click(screen.getByText('Finished in Framework? Save the final SIG to the dataset'));
}
const selectPart = (part: string) => fireEvent.change(screen.getByLabelText('Completed order part'), { target: { value: part } });
const record = () => fireEvent.click(screen.getByRole('button', { name: 'Saved in Framework — record final SIG' }));
beforeEach(() => { vi.resetAllMocks(); mocks.queue.mockResolvedValue(true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('records the presented suggestion for the selected part, not a combined or edited draft', async () => {
  openSplit(); selectPart('pm'); record();
  await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
  expect(mocks.queue).toHaveBeenCalledWith(expect.objectContaining({ partId: 'pm', suggestedSig: 'EVENING SUGGESTION', finalSig: 'EDITED EVENING DRAFT' }));
});

it('preserves unsaved actual text and keeps optional feedback with its own part', async () => {
  openSplit();
  fireEvent.change(screen.getByLabelText('Actual final SIG in Framework'), { target: { value: 'ACTUAL MORNING CORRECTION' } });
  fireEvent.change(screen.getByLabelText('Dataset comment (optional)'), { target: { value: 'Morning correction only' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggestion acceptable: No' }));
  selectPart('pm'); record();
  await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
  selectPart('am'); record();
  await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
  expect(mocks.queue.mock.calls.map(([sample]) => [sample.partId, sample.finalSig, sample.comment, sample.acceptable])).toEqual([
    ['pm', 'EDITED EVENING DRAFT', undefined, undefined], ['am', 'ACTUAL MORNING CORRECTION', 'Morning correction only', false],
  ]);
});

it.each([false, true])('pairs only if the late exact-PON lookup does not conflict with the current queue (collision=%s)', async collision => {
  vi.useFakeTimers();
  let finish: (value: QueueOrder) => void = () => { throw new Error('Source lookup did not run'); };
  mocks.find.mockImplementation(() => new Promise<QueueOrder>(resolve => { finish = resolve; }));
  mocks.read.mockResolvedValue({ ok: true, pon: original.pon, sig: 'OBSERVED SYNTHETIC TEXT' });
  const view = render(panel([]));
  fireEvent.click(screen.getByText('SIG dataset · 0 local observations · collecting'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start passive Framework SIG collection' })); });
  expect(mocks.find).toHaveBeenCalledOnce();
  if (collision) view.rerender(panel([original, order('synthetic-B', 'B')]));
  await act(async () => { finish(original); });
  const fieldRows = mocks.queue.mock.calls.map(([sample]) => sample).filter(sample => sample.stage === 'framework_observed');
  expect(fieldRows.map(sample => [sample.orderKey, sample.captureKind, sample.finalSig])).toEqual([
    [`framework:${original.pon}`, 'framework_sig_observation', 'OBSERVED SYNTHETIC TEXT'],
    ...(collision ? [] : [[original.id, 'erx_source', 'OBSERVED SYNTHETIC TEXT']]),
  ]);
});
