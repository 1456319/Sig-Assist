import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReviewContext } from '../src/hooks/use-review-session';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { traceLogger } from '../src/lib/diagnostics/traceLogger';
import type { SigDatasetInput } from '../src/lib/sigDataset';

const mocks = vi.hoisted(() => ({ queue: vi.fn(), writeClipboard: vi.fn(), dictionary: vi.fn(), rules: vi.fn(), expansions: vi.fn() }));
vi.mock('../src/lib/sigDictionaryService', () => ({ fetchAllSigEntries: mocks.dictionary }));
vi.mock('../src/lib/techRulesService', () => ({ fetchAllTechRules: mocks.rules }));
vi.mock('../src/lib/sigExpansionService', () => ({ fetchAllExpansions: mocks.expansions }));
vi.mock('../src/lib/supabase', () => ({ supabase: null }));
vi.mock('../src/lib/citrixStorage', () => ({
  getCitrixStorageAdapter: () => ({ readDiscrepancies: async () => [], onDirectoryConnected: () => () => {} }),
}));
vi.mock('../src/lib/sigDataset', () => ({ sigDatasetStore: { record: vi.fn(), stats: vi.fn(), page: vi.fn() } }));
vi.mock('../src/lib/sigDatasetCapture', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/sigDatasetCapture')>(),
  queueSigSample: mocks.queue,
}));

const drug = 'Synthetic 10 mg tablet';
function renderWorkbench() {
  return render(<ReviewContext.Provider value={{ ready: true, orders: [], setOrders: vi.fn(), exclusions: [], policyRevision: 0, setExclusions: vi.fn() }}><WorkbenchView /></ReviewContext.Provider>);
}
async function enterOrder(directions: string) {
  renderWorkbench();
  await screen.findByText(/0 codes loaded · 0 rules · 0 expansions/);
  fireEvent.change(screen.getByPlaceholderText('e.g. Lisinopril 10mg'), { target: { value: drug } });
  fireEvent.change(screen.getByPlaceholderText(/Enter free text SIG/), { target: { value: directions } });
}
function openFinalConfirmation() {
  fireEvent.click(screen.getByText('Finished in Framework? Save the final SIG to the dataset'));
}

beforeEach(() => {
  mocks.queue.mockReset().mockResolvedValue(true);
  mocks.writeClipboard.mockReset().mockResolvedValue(undefined);
  mocks.dictionary.mockReset().mockResolvedValue([]);
  mocks.rules.mockReset().mockResolvedValue([]);
  mocks.expansions.mockReset().mockResolvedValue([]);
  traceLogger.clear();
  vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: { writeText: mocks.writeClipboard } } }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network access in synthetic Workbench test')));
});
afterEach(() => { cleanup(); traceLogger.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Workbench dataset integration', () => {
  it('captures a reviewed copy and waits for explicit confirmation before labeling the corrected actual final SIG', async () => {
    const directions = 'Take 1 tablet by mouth daily';
    await enterOrder(directions);
    const draft = await screen.findByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
    const copy = screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement;
    expect(copy.disabled).toBe(true);
    expect(mocks.queue).not.toHaveBeenCalled();

    fireEvent.change(draft, { target: { value: '1T PO QD WITH FOOD' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I matched the order and checked all original directions/ }));
    fireEvent.click(copy);
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce());
    expect(mocks.writeClipboard).toHaveBeenCalledWith('1T PO QD WITH FOOD');
    expect(mocks.queue.mock.calls[0][0]).toMatchObject({
      rawSig: directions, drug, revision: 1, stage: 'reviewed_copy', finalSig: '1T PO QD WITH FOOD',
      captureKind: 'erx_source', origin: 'manual', exclusions: [],
    });
    const copied = mocks.queue.mock.calls[0][0] as SigDatasetInput;
    expect(copied.orderKey).toContain('workbench');
    expect(mocks.queue.mock.calls.some(([input]) => input.stage === 'technician_confirmed')).toBe(false);

    openFinalConfirmation();
    const actual = screen.getByLabelText('Actual final SIG in Framework') as HTMLTextAreaElement;
    expect(actual.value).toBe('1T PO QD WITH FOOD');
    fireEvent.change(actual, { target: { value: '1T PO QAM WITH FOOD' } });
    fireEvent.change(screen.getByLabelText('Dataset comment (optional)'), { target: { value: 'Entered the morning schedule in Framework.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggestion acceptable: No' }));
    expect(mocks.queue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Saved in Framework — record final SIG' }));

    await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.queue.mock.calls[1][0]).toMatchObject({
      orderKey: copied.orderKey, rawSig: directions, drug, stage: 'technician_confirmed', origin: 'manual',
      finalSig: '1T PO QAM WITH FOOD', comment: 'Entered the morning schedule in Framework.', acceptable: false,
    });
    expect(mocks.writeClipboard).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a copied split part associated with its edited draft and human-confirmed final correction', async () => {
    const directions = 'Take 2 tablets in the morning and 1 tablet at night for 5 days';
    await enterOrder(directions);
    const secondDraft = await screen.findByLabelText('Draft SIG (Order 2 of 2) · editable, uppercase') as HTMLTextAreaElement;
    const secondCard = secondDraft.closest('[data-testid]') as HTMLElement;
    fireEvent.change(secondDraft, { target: { value: '1T PO QHS WITH WATER' } });
    fireEvent.click(within(secondCard).getByRole('checkbox', { name: 'Reviewed and approved for FrameworkLTC' }));
    fireEvent.click(within(secondCard).getByRole('button', { name: 'Copy Reviewed SIG (Order 2 of 2)' }));

    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce());
    const copied = mocks.queue.mock.calls[0][0] as SigDatasetInput;
    expect(copied).toMatchObject({
      rawSig: directions, drug, stage: 'reviewed_copy', origin: 'manual', finalSig: '1T PO QHS WITH WATER',
    });
    expect(copied.partId).toBeTruthy();
    expect(mocks.writeClipboard).toHaveBeenCalledWith('1T PO QHS WITH WATER');

    openFinalConfirmation();
    const part = screen.getByLabelText('Completed order part') as HTMLSelectElement;
    const secondOption = within(part).getByRole('option', { name: 'Order 2 of 2' }) as HTMLOptionElement;
    fireEvent.change(part, { target: { value: secondOption.value } });
    const actual = screen.getByLabelText('Actual final SIG in Framework') as HTMLTextAreaElement;
    expect(actual.value).toBe('1T PO QHS WITH WATER');
    fireEvent.change(actual, { target: { value: '1T PO QHS WITH A FULL GLASS OF WATER' } });
    fireEvent.change(screen.getByLabelText('Dataset comment (optional)'), { target: { value: 'Verified the completed bedtime part.' } });
    expect(mocks.queue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Saved in Framework — record final SIG' }));

    await screen.findByText('Technician-confirmed final SIG saved to the local dataset.');
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.queue.mock.calls[1][0]).toMatchObject({
      orderKey: copied.orderKey, partId: copied.partId, rawSig: directions, drug, stage: 'technician_confirmed',
      finalSig: '1T PO QHS WITH A FULL GLASS OF WATER', comment: 'Verified the completed bedtime part.', origin: 'manual',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
