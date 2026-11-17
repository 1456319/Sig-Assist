import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SigDictionaryEntry, SigDictionaryInsert } from '../src/lib/types';

const remote = vi.hoisted(() => ({ enabled: false, from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ get supabase() { return remote.enabled ? { from: remote.from } : null; } }));
import { bulkImportSigEntries, deleteSigEntry, fetchAllSigEntries, upsertSigEntry } from '../src/lib/sigDictionaryService';

const KEY = 'sig_assist_local_sig_dictionary';
const SYNC_KEY = 'sig_assist_local_sig_dictionary_sync_v1';
const input = (code: string, translation = `Meaning of ${code}`): SigDictionaryInsert => ({
  sig_code: code, translation, status: 'ACTIVE', redirect_codes: [], is_high_risk: false, high_risk_warning: '',
});
const entry = (code: string, id = `id-${code}`): SigDictionaryEntry => ({
  ...input(code), id, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
});
function serve(rows: SigDictionaryEntry[], writeError: object | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: writeError });
  const remove = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: writeError }) });
  remote.enabled = true;
  remote.from.mockReturnValue({
    select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: rows, error: null }) }),
    upsert, delete: remove,
  });
  return { upsert, remove };
}
const archive = (): SigDictionaryEntry[] => JSON.parse(localStorage.getItem(KEY)!);
const archiveWrites = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.filter(call => call[0] === KEY);

beforeEach(() => { localStorage.clear(); remote.enabled = false; remote.from.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe('dictionary indexed imports and required storage', () => {
  it('preserves 80 custom codes and IDs, deduplicates imports, and writes the archive once', async () => {
    const custom = Array.from({ length: 80 }, (_, i) => entry(`CUSTOM${i}`));
    localStorage.setItem(KEY, JSON.stringify(custom));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const count = await bulkImportSigEntries([
      input(' custom7 ', 'Updated existing'), input('new', 'First duplicate'), input('NEW', 'Last duplicate'),
    ]);
    expect(count).toBe(3);
    expect(archiveWrites(writes)).toHaveLength(1);
    const result = await fetchAllSigEntries();
    expect(result).toHaveLength(81);
    expect(result.find(e => e.sig_code === 'CUSTOM7')).toMatchObject({ id: custom[7].id, translation: 'Updated existing', created_at: custom[7].created_at });
    expect(result.find(e => e.sig_code === 'NEW')).toMatchObject({ translation: 'Last duplicate' });
    expect(result.filter(e => e.sig_code !== 'CUSTOM7' && e.sig_code !== 'NEW')).toEqual(custom.filter(e => e.sig_code !== 'CUSTOM7').sort((a, b) => a.sig_code.localeCompare(b.sig_code)));
  });
  it('retains identity through renames and removes stale code indexes during the same import', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('OLD', 'stable-id')]));
    await bulkImportSigEntries([{ ...input('renamed'), id: 'stable-id' }, input('OLD', 'New independent entry'), input('RENAMED', 'Final renamed meaning')]);
    const result = await fetchAllSigEntries();
    expect(result).toHaveLength(2);
    expect(result.find(e => e.sig_code === 'RENAMED')).toMatchObject({ id: 'stable-id', translation: 'Final renamed meaning', created_at: '2026-01-01T00:00:00.000Z' });
    expect(result.find(e => e.sig_code === 'OLD')?.id).not.toBe('stable-id');
  });
  it('rejects a rename collision without writing or losing either existing entry', async () => {
    const initial = JSON.stringify([entry('FIRST'), entry('SECOND')]);
    localStorage.setItem(KEY, initial);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await expect(upsertSigEntry({ ...input('SECOND'), id: 'id-FIRST' })).rejects.toThrow('already exists');
    expect(localStorage.getItem(KEY)).toBe(initial);
    expect(archiveWrites(writes)).toHaveLength(0);
  });
  it('validates every imported row before any local or remote mutation', async () => {
    const shared = serve([]);
    await expect(bulkImportSigEntries([input('VALID'), { ...input('INVALID'), redirect_codes: 'bad' } as unknown as SigDictionaryInsert])).rejects.toThrow('entry 2');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(shared.upsert).not.toHaveBeenCalled();
  });
  it.each(['{broken', '{}', '[{"sig_code":"CUSTOM","translation":"Preserve me"}]'])('preserves an unreadable archive verbatim: %s', async raw => {
    localStorage.setItem(KEY, raw);
    serve([entry('REMOTE')]);
    await expect(fetchAllSigEntries()).rejects.toThrow('unreadable');
    await expect(upsertSigEntry(input('NEW'))).rejects.toThrow('unreadable');
    await expect(bulkImportSigEntries([input('NEW')])).rejects.toThrow('unreadable');
    await expect(deleteSigEntry('anything')).rejects.toThrow('unreadable');
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(remote.from).not.toHaveBeenCalled();
  });
  it('rejects writes when site storage is unavailable, with a recovery action', async () => {
    const initial = JSON.stringify([entry('CUSTOM')]);
    localStorage.setItem(KEY, initial);
    serve([]);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === KEY || key === SYNC_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      set.call(this, key, value);
    });
    await expect(upsertSigEntry(input('NEW'))).rejects.toThrow('Check available browser storage');
    await expect(bulkImportSigEntries([input('NEW')])).rejects.toThrow('Check available browser storage');
    await expect(deleteSigEntry('id-CUSTOM')).rejects.toThrow('Check available browser storage');
    expect(localStorage.getItem(KEY)).toBe(initial);
    expect(remote.from).not.toHaveBeenCalled();
  });
  it('restores the previous sync record if the archive write fails', async () => {
    await upsertSigEntry(input('CUSTOM'));
    const original = localStorage.getItem(KEY);
    const originalSync = localStorage.getItem(SYNC_KEY);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      set.call(this, key, value);
    });
    await expect(deleteSigEntry(archive()[0].id)).rejects.toThrow('Cannot save');
    expect(localStorage.getItem(KEY)).toBe(original);
    expect(localStorage.getItem(SYNC_KEY)).toBe(originalSync);
  });
  it('preserves entries when sync metadata is corrupted', async () => {
    const initial = JSON.stringify([entry('CUSTOM')]);
    localStorage.setItem(KEY, initial);
    localStorage.setItem(SYNC_KEY, '{broken');
    await expect(bulkImportSigEntries([input('NEW')])).rejects.toThrow('unreadable');
    expect(localStorage.getItem(KEY)).toBe(initial);
    expect(localStorage.getItem(SYNC_KEY)).toBe('{broken');
  });
});

describe('dictionary partial remote responses and explicit deletes', () => {
  it('keeps all 80 legacy custom codes after empty and partial shared responses', async () => {
    const custom = Array.from({ length: 80 }, (_, i) => entry(`CUSTOM${i}`));
    localStorage.setItem(KEY, JSON.stringify(custom));
    serve([]);
    expect(await fetchAllSigEntries()).toHaveLength(80);
    serve([entry('REMOTE'), { ...custom[3], translation: 'Stale shared meaning' }]);
    const result = await fetchAllSigEntries();
    expect(result).toHaveLength(81);
    expect(result.find(e => e.id === custom[3].id)?.translation).toBe(custom[3].translation);
  });
  it('returns the merged dictionary when an optional cache refresh cannot be stored', async () => {
    const original = JSON.stringify([entry('LOCAL')]);
    localStorage.setItem(KEY, original);
    serve([entry('REMOTE')]);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      set.call(this, key, value);
    });
    expect((await fetchAllSigEntries()).map(e => e.sig_code)).toEqual(['LOCAL', 'REMOTE']);
    expect(localStorage.getItem(KEY)).toBe(original);
    expect(localStorage.getItem(SYNC_KEY)).toBeNull();
  });
  it('preserves a legacy offline rename when the stale shared copy has a different ID', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('OLD', 'local-id')]));
    await upsertSigEntry({ ...input('NEW'), id: 'local-id' });
    serve([entry('OLD', 'shared-id')]);
    expect((await fetchAllSigEntries()).map(e => e.sig_code)).toEqual(['NEW']);
  });
  it('keeps pending offline updates and renames over stale shared rows', async () => {
    serve([entry('OLD')]);
    await fetchAllSigEntries();
    remote.enabled = false;
    await upsertSigEntry({ ...input('NEW', 'Offline correction'), id: 'id-OLD' });
    serve([entry('OLD'), entry('OTHER')]);
    const result = await fetchAllSigEntries();
    expect(result.map(e => e.sig_code)).toEqual(['NEW', 'OTHER']);
    expect(result[0]).toMatchObject({ id: 'id-OLD', translation: 'Offline correction' });
  });
  it('allows refreshed shared edits after an acknowledged save and still preserves omitted rows', async () => {
    const shared = serve([]);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await bulkImportSigEntries([input('ONE'), input('TWO')]);
    expect(archiveWrites(writes)).toHaveLength(1);
    expect(shared.upsert).toHaveBeenCalledTimes(1);
    const sent = shared.upsert.mock.calls[0][0] as SigDictionaryEntry[];
    serve([{ ...sent[0], translation: 'Later shared edit' }]);
    const result = await fetchAllSigEntries();
    expect(result).toHaveLength(2);
    expect(result.find(e => e.sig_code === 'ONE')?.translation).toBe('Later shared edit');
  });
  it.each([false, true])('does not resurrect an explicitly deleted code from stale shared rows (online=%s)', async online => {
    const deleted = entry('DELETE');
    serve([deleted, entry('KEEP')]);
    await fetchAllSigEntries();
    remote.enabled = online;
    await deleteSigEntry(deleted.id);
    serve([deleted, entry('DELETE', 'different-remote-id'), entry('KEEP')]);
    expect((await fetchAllSigEntries()).map(e => e.sig_code)).toEqual(['KEEP']);
    remote.enabled = false;
    await upsertSigEntry(input('DELETE', 'Explicitly recreated'));
    expect((await fetchAllSigEntries()).find(e => e.sig_code === 'DELETE')?.translation).toBe('Explicitly recreated');
  });
  it('re-reads the local archive after a remote fetch to retain edits made in flight', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('CUSTOM')]));
    let resolve!: (result: { data: SigDictionaryEntry[]; error: null }) => void;
    remote.enabled = true;
    remote.from.mockReturnValue({ select: () => ({ order: () => new Promise(r => { resolve = r; }) }) });
    const pendingFetch = fetchAllSigEntries();
    remote.enabled = false;
    await upsertSigEntry({ ...input('CUSTOM', 'New local correction'), id: 'id-CUSTOM' });
    resolve({ data: [entry('CUSTOM')], error: null });
    expect((await pendingFetch)[0].translation).toBe('New local correction');
  });
  it('retains a deletion made while an older shared fetch is in flight', async () => {
    const deleted = entry('CUSTOM');
    localStorage.setItem(KEY, JSON.stringify([deleted]));
    let resolve!: (result: { data: SigDictionaryEntry[]; error: null }) => void;
    remote.enabled = true;
    remote.from.mockReturnValue({ select: () => ({ order: () => new Promise(r => { resolve = r; }) }) });
    const pendingFetch = fetchAllSigEntries();
    remote.enabled = false;
    await deleteSigEntry(deleted.id);
    resolve({ data: [deleted], error: null });
    expect(await pendingFetch).toEqual([]);
    expect(archive()).toEqual([]);
  });
  it('does not mark a newer offline correction synced when an older save finishes', async () => {
    let resolve!: (result: { error: null }) => void;
    remote.enabled = true;
    remote.from.mockReturnValue({ upsert: () => new Promise(r => { resolve = r; }) });
    const olderSave = upsertSigEntry(input('CUSTOM', 'First local edit'));
    remote.enabled = false;
    await upsertSigEntry(input('CUSTOM', 'Newer local correction'));
    resolve({ error: null });
    await olderSave;
    serve([{ ...archive()[0], translation: 'First local edit' }]);
    expect((await fetchAllSigEntries())[0].translation).toBe('Newer local correction');
  });
});
