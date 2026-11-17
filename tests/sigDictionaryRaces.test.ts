import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SigDictionaryEntry, SigDictionaryInsert } from '../src/lib/types';

const remote = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: remote.from } }));
import { deleteSigEntry, fetchAllSigEntries, upsertSigEntry } from '../src/lib/sigDictionaryService';

const KEY = 'sig_assist_local_sig_dictionary';
const input = (code: string, translation = `Meaning of ${code}`): SigDictionaryInsert => ({
  sig_code: code, translation, status: 'ACTIVE', redirect_codes: [], is_high_risk: false, high_risk_warning: '',
});
const entry = (code: string): SigDictionaryEntry => ({
  ...input(code), id: `id-${code}`, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
});
function pendingLookup() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
  remote.from.mockReturnValue({
    select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(promise) }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });
  return { resolve, reject, lookup: fetchAllSigEntries() };
}
const failures = [
  { label: 'returns an error', finish: (pending: ReturnType<typeof pendingLookup>) => pending.resolve({ data: null, error: { message: 'offline' } }) },
  { label: 'returns malformed rows', finish: (pending: ReturnType<typeof pendingLookup>) => pending.resolve({ data: [{ invalid: true }], error: null }) },
  { label: 'throws', finish: (pending: ReturnType<typeof pendingLookup>) => pending.reject(new Error('Connection lost')) },
];
const archive = (): SigDictionaryEntry[] => JSON.parse(localStorage.getItem(KEY)!);

beforeEach(() => { localStorage.clear(); remote.from.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe.each(failures)('dictionary lookups when the shared request $label', ({ finish }) => {
  it('includes a new code durably saved while the lookup was pending', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('OLD')]));
    const pending = pendingLookup();
    await upsertSigEntry(input('NEW'));
    const saved = archive();

    finish(pending);
    const result = await pending.lookup;

    expect(result.map(e => e.sig_code)).toEqual(['NEW', 'OLD']);
    expect(result).toEqual([...saved].sort((a, b) => a.sig_code.localeCompare(b.sig_code)));
    expect(archive()).toEqual(saved);
  });

  it('returns a correction durably saved while the lookup was pending', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('CUSTOM')]));
    const pending = pendingLookup();
    await upsertSigEntry({ ...input('CUSTOM', 'Corrected local meaning'), id: 'id-CUSTOM' });
    const saved = archive();

    finish(pending);

    expect(await pending.lookup).toEqual(saved);
    expect(archive()).toEqual(saved);
  });

  it('omits a code durably deleted while the lookup was pending', async () => {
    localStorage.setItem(KEY, JSON.stringify([entry('GONE'), entry('KEEP')]));
    const pending = pendingLookup();
    await deleteSigEntry('id-GONE');
    const saved = archive();

    finish(pending);
    const result = await pending.lookup;

    expect(result.map(e => e.sig_code)).toEqual(['KEEP']);
    expect(result).toEqual(saved);
    expect(archive()).toEqual(saved);
  });
});
