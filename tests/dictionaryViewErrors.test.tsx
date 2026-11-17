import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DictionaryView } from '../src/components/DictionaryView';
import { bulkImportSigEntries, fetchAllSigEntries, upsertSigEntry } from '../src/lib/sigDictionaryService';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/lib/sigDictionaryService', () => ({
  fetchAllSigEntries: vi.fn(), bulkImportSigEntries: vi.fn(), upsertSigEntry: vi.fn(), deleteSigEntry: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAllSigEntries).mockResolvedValue([]);
});
afterEach(cleanup);

describe('dictionary storage feedback', () => {
  it('shows an actionable import error instead of mislabeling valid JSON', async () => {
    const message = 'Cannot save the SIG dictionary on this device. Check available browser storage and allow site data, then retry.';
    vi.mocked(bulkImportSigEntries).mockRejectedValue(new Error(message));
    render(<DictionaryView />);
    await screen.findByText('No entries match your filters');
    const file = new File(['[{"sig_code":"CUSTOM","translation":"Example"}]'], 'codes.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '[{"sig_code":"CUSTOM","translation":"Example"}]' });
    const fileInput = screen.getByText('Bulk Import JSON').closest('label')!.querySelector('input')!;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
    expect(bulkImportSigEntries).toHaveBeenCalledWith([{ sig_code: 'CUSTOM', translation: 'Example' }]);
  });
  it('retains a failed save in the open editor and displays the real storage error', async () => {
    const message = 'The saved SIG dictionary is unreadable. Preserve this device’s site data.';
    vi.mocked(upsertSigEntry).mockRejectedValue(new Error(message));
    render(<DictionaryView />);
    await screen.findByText('No entries match your filters');
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. BID'), { target: { value: 'CUSTOM' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Twice Daily'), { target: { value: 'Example translation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByPlaceholderText('e.g. BID') as HTMLInputElement).value).toBe('CUSTOM');
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('passes the original ID when a technician renames an existing code', async () => {
    vi.mocked(fetchAllSigEntries).mockResolvedValue([{
      id: 'stable-id', sig_code: 'CUSTOM', translation: 'Existing translation', status: 'ACTIVE',
      redirect_codes: [], is_high_risk: false, high_risk_warning: '', created_at: '2026-01-01', updated_at: '2026-01-01',
    }]);
    vi.mocked(upsertSigEntry).mockResolvedValue();
    render(<DictionaryView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit CUSTOM' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. BID'), { target: { value: 'RENAMED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));
    await waitFor(() => expect(upsertSigEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'stable-id', sig_code: 'RENAMED' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
