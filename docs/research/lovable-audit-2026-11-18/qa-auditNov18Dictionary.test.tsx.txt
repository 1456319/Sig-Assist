import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DictionaryView } from '../src/components/DictionaryView';
import { toast } from 'sonner';
import type { SigDictionaryEntry } from '../src/lib/types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const remote = vi.hoisted(() => ({ enabled: true, from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ get supabase() { return remote.enabled ? { from: remote.from } : null; } }));
import { fetchAllSigEntries, upsertSigEntry } from '../src/lib/sigDictionaryService';

const code = { sig_code: 'SYNTHQA', translation: 'Synthetic lookup meaning', status: 'ACTIVE' as const };
const archive = (): SigDictionaryEntry[] => JSON.parse(localStorage.getItem('sig_assist_local_sig_dictionary') ?? '[]');
const upsert = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); remote.enabled = true; upsert.mockReset();
  remote.from.mockReset().mockReturnValue({ upsert, select: () => ({ order: async () => ({ data: [], error: null }) }) });
});

it('distinguishes a saved local edit from a rejected shared write, and manually retries the same entry', async () => {
  upsert.mockResolvedValueOnce({ error: { message: 'Synthetic rejection' } }).mockResolvedValueOnce({ error: null });
  const first = await upsertSigEntry(code);
  const [saved] = archive();
  expect(saved).toMatchObject(code);
  expect(await fetchAllSigEntries()).toEqual([saved]);
  expect(upsert).toHaveBeenCalledOnce();
  const second = await upsertSigEntry({ ...code, id: saved.id });
  expect(archive()).toHaveLength(1);
  expect(upsert.mock.calls[1][0][0].id).toBe(saved.id);
  expect([first, second]).toEqual(['shared-unconfirmed', 'shared-acknowledged']);
});

it('distinguishes a local-only installation from a rejected shared write', async () => {
  remote.enabled = false;
  expect(await upsertSigEntry(code)).toBe('local-only');
  expect(archive()).toHaveLength(1);
  expect(upsert).not.toHaveBeenCalled();
});


afterEach(cleanup);

it('keeps the locally saved entry visible and warns that this shared write was not confirmed', async () => {
  upsert.mockResolvedValue({ error: { message: 'Synthetic shared write rejection' } });
  render(<DictionaryView />);
  await screen.findByText('No entries match your filters');
  fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));
  fireEvent.change(screen.getByPlaceholderText('e.g. BID'), { target: { value: code.sig_code } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Twice Daily'), { target: { value: code.translation } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Entry' }));
  await screen.findByRole('button', { name: `Edit ${code.sig_code}` });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(archive()).toHaveLength(1);
  expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Shared save not confirmed'));
  expect(toast.success).not.toHaveBeenCalled();
});
