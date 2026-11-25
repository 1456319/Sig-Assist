import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewContext } from '../src/hooks/use-review-session';
import { SigDatasetConfirmation, SigDatasetPanel } from '../src/components/SigDatasetPanel';
import type { QueueOrder } from '../src/lib/orderQueue';
import type { SigDatasetInput, SigDatasetRecord } from '../src/lib/sigDataset';

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  captureState: { enabled: true, pending: 0, error: '', saved: 0 },
  stats: vi.fn(),
  page: vi.fn(),
  exportPosition: vi.fn(),
  setExportPosition: vi.fn(),
  record: vi.fn(),
  clear: vi.fn(),
  delete: vi.fn(),
  readFramework: vi.fn(),
  findSource: vi.fn(),
}));

vi.mock('../src/lib/sigDataset', () => ({
  sigDatasetStore: { stats: mocks.stats, page: mocks.page, exportPosition: mocks.exportPosition, setExportPosition: mocks.setExportPosition, record: mocks.record, clear: mocks.clear, delete: mocks.delete },
}));
vi.mock('../src/lib/sigDatasetCapture', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/sigDatasetCapture')>(),
  queueSigSample: mocks.queue,
  datasetCaptureState: () => mocks.captureState,
  subscribeDatasetCapture: () => () => {},
}));
vi.mock('../src/lib/frameworkSigDataset', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/frameworkSigDataset')>(),
  readFrameworkSigSnapshot: mocks.readFramework,
  findDatasetSource: mocks.findSource,
}));

const stages = { source_received: 0, reviewed_copy: 0, verified_transfer: 0, technician_confirmed: 0, framework_observed: 0 };
const order = (extra: Partial<QueueOrder> = {}): QueueOrder => ({
  id: 'synthetic-order', facility: 'Synthetic facility', patientRef: 'synthetic-patient', pon: 'SYNTHETIC-PON',
  drug: 'Synthetic tablet', directions: 'Take one tablet by mouth every morning.',
  revision: 1, previousSources: [], draft: '1T PO QAM', cancelled: false, ...extra,
});
const finalInput = () => screen.getByLabelText('Actual final SIG in Framework') as HTMLTextAreaElement;
const commentInput = () => screen.getByLabelText('Dataset comment (optional)') as HTMLTextAreaElement;
const recordFinal = () => screen.getByRole('button', { name: 'Saved in Framework — record final SIG' });
function openConfirmation() { fireEvent.click(screen.getByText('Finished in Framework? Save the final SIG to the dataset')); }
function panel(orders: QueueOrder[], ready = true) {
  return <ReviewContext.Provider value={{ ready, orders, setOrders: vi.fn(), exclusions: [], policyRevision: 0, setExclusions: vi.fn() }}><SigDatasetPanel /></ReviewContext.Provider>;
}
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queue.mockReset().mockResolvedValue(true);
  mocks.stats.mockReset().mockResolvedValue({ total: 0, stages });
  mocks.page.mockReset().mockResolvedValue({ records: [], nextSeq: 0, hasMore: false, policies: {} });
  mocks.exportPosition.mockReset().mockResolvedValue(0);
  mocks.setExportPosition.mockReset().mockResolvedValue(undefined);
  mocks.readFramework.mockReset();
  mocks.findSource.mockReset();
  mocks.captureState = { enabled: true, pending: 0, error: '', saved: 0 };
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('technician confirmation', () => {
  it('keeps the actual final text, comment and rating available after a failed local save', async () => {
    mocks.queue.mockResolvedValueOnce(false);
    render(<SigDatasetConfirmation order={order()} suggestion="1T PO QD" exclusions={[]} />);
    openConfirmation();
    fireEvent.change(finalInput(), { target: { value: '  1T PO QAM WITH FOOD  ' } });
    fireEvent.change(commentInput(), { target: { value: '  Restored the food instruction in Framework.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggestion acceptable: No' }));
    fireEvent.click(recordFinal());

    expect((await screen.findByRole('status')).textContent).toContain('Not durably saved');
    expect(finalInput().value).toBe('  1T PO QAM WITH FOOD  ');
    expect(commentInput().value).toBe('  Restored the food instruction in Framework.  ');
    expect(screen.getByRole('button', { name: 'Suggestion acceptable: No' }).getAttribute('aria-pressed')).toBe('true');
    expect((recordFinal() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(recordFinal());
    await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.queue.mock.calls[1][0]).toMatchObject({
      stage: 'technician_confirmed', finalSig: '1T PO QAM WITH FOOD',
      comment: 'Restored the food instruction in Framework.', acceptable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { answer: undefined, expected: undefined },
    { answer: 'Yes', expected: true },
    { answer: 'No', expected: false },
  ])('records the actual correction with the optional $answer assessment without submitting an Rx', async ({ answer, expected }) => {
    const original = order();
    const before = structuredClone(original);
    const exclusions = [{ kind: 'code' as const, value: 'QD', replacement: 'DAILY' }];
    render(<SigDatasetConfirmation order={original} suggestion="1T PO QD" generatedSig="1T QD" exclusions={exclusions} />);
    openConfirmation();
    fireEvent.change(finalInput(), { target: { value: '1T PO QAM WITH FOOD' } });
    if (answer) fireEvent.click(screen.getByRole('button', { name: `Suggestion acceptable: ${answer}` }));
    fireEvent.click(recordFinal());

    await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
    expect(mocks.queue).toHaveBeenCalledOnce();
    expect(mocks.queue.mock.calls[0][0]).toMatchObject({
      orderKey: original.id, revision: 1, rawSig: original.directions, stage: 'technician_confirmed',
      captureKind: 'erx_source', origin: 'manual', suggestedSig: '1T PO QD', generatedSig: '1T QD',
      finalSig: '1T PO QAM WITH FOOD', acceptable: expected, exclusions,
    });
    expect(original).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.readFramework).not.toHaveBeenCalled();
    expect(mocks.findSource).not.toHaveBeenCalled();
  });

  it('tracks app draft changes until the technician enters an actual final correction', () => {
    const original = order();
    const view = render(<SigDatasetConfirmation order={original} suggestion="1T PO QD" exclusions={[]} />);
    openConfirmation();
    expect(finalInput().value).toBe('1T PO QAM');

    view.rerender(<SigDatasetConfirmation order={{ ...original, draft: '1T PO BID' }} suggestion="1T PO BID" exclusions={[]} />);
    expect(finalInput().value).toBe('1T PO BID');
    fireEvent.change(finalInput(), { target: { value: '1T PO BID WITH FOOD' } });
    fireEvent.change(commentInput(), { target: { value: 'Actual text entered after saving.' } });
    view.rerender(<SigDatasetConfirmation order={{ ...original, draft: '2T PO QAM' }} suggestion="2T PO QAM" exclusions={[]} />);

    expect(finalInput().value).toBe('1T PO BID WITH FOOD');
    expect(commentInput().value).toBe('Actual text entered after saving.');
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('records the selected split order part with its actual final correction', async () => {
    render(<SigDatasetConfirmation order={order()} suggestion="Combined draft" exclusions={[]} parts={[
      { id: 'morning', label: 'Morning part', sig: '1T PO QAM' },
      { id: 'evening', label: 'Evening part', sig: '2T PO QPM' },
    ]} />);
    openConfirmation();
    expect(finalInput().value).toBe('1T PO QAM');
    fireEvent.change(screen.getByLabelText('Completed order part'), { target: { value: 'evening' } });
    expect(finalInput().value).toBe('2T PO QPM');
    fireEvent.change(finalInput(), { target: { value: '2T PO QPM WITH EVENING MEAL' } });
    fireEvent.click(recordFinal());

    await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
    expect(mocks.queue).toHaveBeenCalledOnce();
    expect(mocks.queue.mock.calls[0][0]).toMatchObject({
      orderKey: 'synthetic-order', stage: 'technician_confirmed', partId: 'evening', finalSig: '2T PO QPM WITH EVENING MEAL',
    });
  });
});

describe('dataset collection panel', () => {
  it('waits for queue hydration, captures real source context, and skips demo sources', async () => {
    const real = order({ iguana: {
      messageId: 'synthetic-message', messageIds: ['synthetic-message'], sender: 'synthetic', patientRefType: 'synthetic',
      ndc: '00000000000', strength: '5 mg', dose: '1', doseUnit: 'tablet', route: 'oral', frequency: 'daily',
      administrationTimes: ['08:00'], instructionFacts: {},
    } });
    const demo = order({ id: 'synthetic-demo', pon: 'dEmO-001' });
    const orders = [real, demo];
    const view = render(panel(orders, false));
    expect(mocks.queue).not.toHaveBeenCalled();
    view.rerender(panel(orders));

    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce());
    expect(mocks.queue.mock.calls[0][0]).toMatchObject({
      orderKey: real.id, revision: 1, stage: 'source_received', rawSig: real.directions,
      captureKind: 'erx_source', origin: 'iguana', context: {
        ndc: '00000000000', strength: '5 mg', dose: '1', doseUnit: 'tablet', route: 'oral', frequency: 'daily', administrationTimes: ['08:00'],
      },
    });
    expect((mocks.queue.mock.calls[0][0] as SigDatasetInput).finalSig).toBeUndefined();

    view.rerender(panel([{ ...real, draft: '1T PO BID' }, demo]));
    expect(mocks.queue).toHaveBeenCalledOnce();
    view.rerender(panel([{ ...real, revision: 2, directions: 'Take one tablet twice daily.' }, demo]));
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledTimes(2));
    expect(mocks.queue.mock.calls[1][0]).toMatchObject({ stage: 'source_received', revision: 2, rawSig: 'Take one tablet twice daily.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not collect new sources while local collection is paused', async () => {
    mocks.captureState = { ...mocks.captureState, enabled: false };
    render(panel([order()]));
    await screen.findByText('SIG dataset · 0 local observations · paused');
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('keeps observing the next Framework order while source enrichment is stalled and stops future polls on request', async () => {
    vi.useFakeTimers();
    mocks.readFramework
      .mockResolvedValueOnce({ ok: true, pon: 'SYNTHETIC-PON-1', sig: '1T PO QAM', drug: 'Synthetic morning tablet' })
      .mockResolvedValueOnce({ ok: true, pon: 'SYNTHETIC-PON-2', sig: '2T PO QPM', drug: 'Synthetic evening tablet' });
    // A slow source service must not hold up capture of the next E-Rx.
    mocks.findSource.mockImplementation(() => new Promise<QueueOrder | undefined>(() => {}));
    render(panel([]));
    fireEvent.click(screen.getByText('SIG dataset · 0 local observations · collecting'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start passive Framework SIG collection' }));
    });

    expect(mocks.queue).toHaveBeenCalledOnce();
    expect(mocks.findSource).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('Field observation saved locally; original E-Rx prose was not available');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    expect(mocks.readFramework).toHaveBeenCalledTimes(2);
    expect(mocks.queue.mock.calls.map(([value]) => {
      const input = value as SigDatasetInput;
      return { orderKey: input.orderKey, stage: input.stage, captureKind: input.captureKind, origin: input.origin, rawSig: input.rawSig, finalSig: input.finalSig };
    })).toEqual([
      { orderKey: 'framework:SYNTHETIC-PON-1', stage: 'framework_observed', captureKind: 'framework_sig_observation', origin: 'framework', rawSig: '1T PO QAM', finalSig: '1T PO QAM' },
      { orderKey: 'framework:SYNTHETIC-PON-2', stage: 'framework_observed', captureKind: 'framework_sig_observation', origin: 'framework', rawSig: '2T PO QPM', finalSig: '2T PO QPM' },
    ]);
    // Enrichment is still waiting on its first lookup while both observations are saved.
    expect(mocks.findSource).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Stop passive Framework SIG collection' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mocks.readFramework).toHaveBeenCalledTimes(2);
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Start passive Framework SIG collection' })).toBeDefined();
  });

  it('downloads bounded successive batches and retains sample counts and data after export and reset', async () => {
    const records: SigDatasetRecord[] = Array.from({ length: 1002 }, (_, index) => ({
      seq: index + 1, schemaVersion: 1, capturedAt: '2026-01-01T00:00:00.000Z', appVersion: 'synthetic', buildId: 'synthetic',
      orderId: 'synthetic-order-hash', sampleId: `synthetic-sample-${index + 1}`, dedupKey: `synthetic-dedup-${index + 1}`,
      revision: 1, stage: 'source_received', drug: 'Synthetic tablet', rawSig: `Synthetic instruction ${index + 1}`,
      exclusionPolicyId: 'synthetic-policy',
    }));
    records[0].stage = 'framework_observed';
    records[1].stage = 'framework_observed';
    records[1].sourceMatch = 'pon_candidate';
    const storedSnapshot = structuredClone(records);
    const snapshot = records.map(row => row.stage === 'framework_observed' && row.sourceMatch === undefined
      ? { ...structuredClone(row), sourceMatch: 'legacy_unverified' } : structuredClone(row));
    const exclusions = [{ kind: 'code' as const, value: 'QD', replacement: 'DAILY' }];
    mocks.stats.mockResolvedValue({ total: records.length, stages: { ...stages, source_received: records.length } });
    mocks.page.mockImplementation(async (after: number, limit: number) => {
      const batch = records.filter(row => row.seq > after).slice(0, limit);
      return { records: batch, nextSeq: batch.at(-1)?.seq ?? after, hasMore: records.some(row => row.seq > (batch.at(-1)?.seq ?? after)), policies: batch.length ? { 'synthetic-policy': exclusions } : {} };
    });
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:synthetic-dataset'; });
      static revokeObjectURL = vi.fn();
    });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download); });
    render(panel([]));
    await screen.findByText('SIG dataset · 1002 local observations · collecting');
    fireEvent.click(screen.getByText('SIG dataset · 1002 local observations · collecting'));
    const download = screen.getByRole('button', { name: 'Download next 1,000 samples' });

    fireEvent.click(download);
    await screen.findByText(/Download requested for 1000 samples.*More samples remain.*Dataset records are retained/);
    expect(mocks.page).toHaveBeenNthCalledWith(1, 0, 1000);
    expect(mocks.setExportPosition).toHaveBeenLastCalledWith(1000);
    const first = (await readBlob(blobs[0])).trim().split('\n').map(line => JSON.parse(line));
    expect(first[0]).toMatchObject({ type: 'sig_dataset_batch', schemaVersion: 1, afterSeq: 0, throughSeq: 1000 });
    expect(first[1]).toEqual({ type: 'exclusion_policy', id: 'synthetic-policy', exclusions });
    expect(first.slice(2)).toEqual(snapshot.slice(0, 1000));
    expect(records[0].sourceMatch).toBeUndefined();
    expect(first[2].sourceMatch).toBe('legacy_unverified');
    expect(first[3].sourceMatch).toBe('pon_candidate');

    fireEvent.click(download);
    await screen.findByText(/Download requested for 2 samples.*Export is current.*Dataset records are retained/);
    expect(mocks.page).toHaveBeenNthCalledWith(2, 1000, 1000);
    expect(mocks.setExportPosition).toHaveBeenLastCalledWith(1002);
    const second = (await readBlob(blobs[1])).trim().split('\n').map(line => JSON.parse(line));
    expect(second[0]).toMatchObject({ afterSeq: 1000, throughSeq: 1002 });
    expect(second.slice(2)).toEqual(snapshot.slice(1000));
    expect(downloads).toEqual(['sig-dataset-1-1000.jsonl', 'sig-dataset-1001-1002.jsonl']);

    fireEvent.click(download);
    await screen.findByText(/No additional samples at this export position/);
    expect(mocks.page).toHaveBeenNthCalledWith(3, 1002, 1000);
    expect(blobs).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Reset export position' }));
    await screen.findByText('Export position reset. Existing dataset samples are unchanged.');
    expect(mocks.setExportPosition).toHaveBeenLastCalledWith(0);
    fireEvent.click(download);
    await waitFor(() => expect(mocks.page).toHaveBeenNthCalledWith(4, 0, 1000));

    expect(screen.getByText('SIG dataset · 1002 local observations · collecting')).toBeDefined();
    expect(screen.getByText(/Source observations: 1002/)).toBeDefined();
    expect(records).toEqual(storedSnapshot);
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('loads the durable export position before enabling export after reopening', async () => {
    let loaded!: (value: number) => void;
    mocks.exportPosition.mockImplementation(() => new Promise<number>(resolve => { loaded = resolve; }));
    render(panel([]));
    fireEvent.click(screen.getByText('SIG dataset · 0 local observations · collecting'));
    const download = screen.getByRole('button', { name: 'Download next 1,000 samples' }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    await act(async () => { loaded(2000); });
    expect(download.disabled).toBe(false);
    fireEvent.click(download);
    await waitFor(() => expect(mocks.page).toHaveBeenCalledWith(2000, 1000));
    expect(mocks.setExportPosition).not.toHaveBeenCalled();
  });

  it('keeps the prior cursor after an export-position failure and permits retrying the same batch', async () => {
    mocks.page.mockResolvedValue({ records: [{ seq: 1 }], nextSeq: 1, policies: {}, hasMore: false });
    mocks.setExportPosition.mockRejectedValueOnce(new Error('Synthetic metadata failure'));
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:synthetic-dataset');
      static revokeObjectURL = vi.fn();
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(panel([]));
    fireEvent.click(screen.getByText('SIG dataset · 0 local observations · collecting'));
    const download = screen.getByRole('button', { name: 'Download next 1,000 samples' }) as HTMLButtonElement;
    await waitFor(() => expect(download.disabled).toBe(false));
    fireEvent.click(download);
    expect((await screen.findByRole('alert')).textContent).toContain('position was not advanced');
    fireEvent.click(download);
    await screen.findByText(/Download requested for 1 samples/);
    expect(mocks.page.mock.calls).toEqual([[0, 1000], [0, 1000]]);
  });
});
