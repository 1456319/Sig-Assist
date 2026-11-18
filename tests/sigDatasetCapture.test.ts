import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SigDatasetInput } from '../src/lib/sigDataset';
const storage = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('../src/lib/sigDataset', () => ({ sigDatasetStore: storage }));
const input = (extra: Partial<SigDatasetInput> = {}): SigDatasetInput => ({ orderKey: 'LOCAL-IDENTITY-NOT-FOR-EXPORT', revision: 1, stage: 'reviewed_copy', drug: 'Synthetic tablet', rawSig: 'Take one tablet daily.', finalSig: '1T PO QD', ...extra });
beforeEach(() => { vi.resetModules(); storage.record.mockReset().mockResolvedValue({ added: true, seq: 1 }); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('dataset capture acknowledgment and recovery', () => {
  it('acknowledges a sample only after durable storage resolves', async () => {
    let complete!: (value: { added: boolean; seq: number }) => void;
    storage.record.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const capture = await import('../src/lib/sigDatasetCapture');
    const promise = capture.queueSigSample(input());
    expect(capture.datasetCaptureState().pending).toBe(1);
    expect(capture.datasetCaptureState().saved).toBe(0);
    complete({ added: true, seq: 4 });
    expect(await promise).toBe(true);
    expect(capture.datasetCaptureState()).toMatchObject({ pending: 0, saved: 1 });
  });
  it('retains failed samples for retry and emergency export without identity inputs', async () => {
    storage.record.mockRejectedValueOnce(new Error('Synthetic quota failure'));
    const capture = await import('../src/lib/sigDatasetCapture');
    expect(await capture.queueSigSample(input({ partId: 'PRIVATE-PART-KEY' }))).toBe(false);
    expect(capture.datasetCaptureState()).toMatchObject({ pending: 1, saved: 0, error: 'Synthetic quota failure' });
    const exported = capture.pendingDatasetExport();
    expect(exported[0]).toMatchObject({ rawSig: 'Take one tablet daily.', stage: 'reviewed_copy' });
    expect(JSON.stringify(exported)).not.toMatch(/LOCAL-IDENTITY|PRIVATE-PART-KEY/);
    capture.retryDatasetCapture(); await vi.runAllTimersAsync();
    expect(capture.datasetCaptureState()).toMatchObject({ pending: 0, saved: 1, error: '' });
    expect(storage.record).toHaveBeenCalledTimes(2);
  });
  it('keeps copies separate from technician-confirmed samples and retains corrections', async () => {
    const capture = await import('../src/lib/sigDatasetCapture');
    await capture.queueSigSample(input());
    await capture.queueSigSample(input({ stage: 'technician_confirmed', finalSig: '1T PO BID', comment: 'Changed in Framework.' }));
    expect(storage.record.mock.calls.map(([row]) => row.stage)).toEqual(['reviewed_copy', 'technician_confirmed']);
    expect(storage.record.mock.calls[1][0]).toMatchObject({ finalSig: '1T PO BID', comment: 'Changed in Framework.' });
  });
  it('pauses new capture without clearing pending recovery data', async () => {
    storage.record.mockRejectedValueOnce(new Error('Offline database'));
    const capture = await import('../src/lib/sigDatasetCapture');
    await capture.queueSigSample(input()); capture.setDatasetCaptureEnabled(false);
    expect(await capture.queueSigSample(input({ stage: 'source_received' }))).toBe(false);
    expect(capture.datasetCaptureState().pending).toBe(1);
    expect(storage.record).toHaveBeenCalledTimes(1);
  });
  it('retains replay context while excluding structured patient/facility identifiers', async () => {
    const capture = await import('../src/lib/sigDatasetCapture');
    const sample = capture.orderDatasetInput({ id: 'LOCAL-ONLY', pon: 'LOCAL-PON', patientRef: 'LOCAL-RESIDENT', facility: 'LOCAL-FACILITY',
      drug: 'Synthetic powder', directions: 'Give17 grams daily.', defaultSig: 'Dissolve in4–8 ounces of water.', revision: 2, previousSources: [], draft: 'DRAFT', cancelled: false }, 'source_received');
    expect(sample).toMatchObject({ rawSig: 'Give17 grams daily.', defaultSigTemplate: 'Dissolve in4–8 ounces of water.', revision: 2 });
    expect(sample).not.toHaveProperty('patientRef'); expect(sample).not.toHaveProperty('facility'); expect(sample).not.toHaveProperty('pon');
  });
});
