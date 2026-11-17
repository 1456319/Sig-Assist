import { supabase } from './supabase';
import type { SigDictionaryEntry, SigDictionaryInsert } from './types';
import { observeCustomizationCounts, recordPilotEvent } from './pilotDiagnostics';

const LOCAL_STORAGE_KEY = 'sig_assist_local_sig_dictionary';
const SYNC_STORAGE_KEY = 'sig_assist_local_sig_dictionary_sync_v1';
type Insert = SigDictionaryInsert & { id?: string };
interface DeletedEntry { id: string; code: string }
interface LocalState {
  entries: SigDictionaryEntry[];
  pendingIds: Set<string>;
  deleted: DeletedEntry[];
}

const storageError = () => new Error('Cannot save the SIG dictionary on this device. Check available browser storage and allow site data, then retry. Existing codes have not been replaced.');
const corruptError = () => new Error('The saved SIG dictionary is unreadable. Preserve or export this device’s site data before restoring a backup; existing data has not been overwritten.');
const codeKey = (code: string) => code.trim().toUpperCase();

function isEntry(value: unknown): value is SigDictionaryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<SigDictionaryEntry>;
  return typeof e.id === 'string' && Boolean(e.id) &&
    typeof e.sig_code === 'string' && Boolean(codeKey(e.sig_code)) &&
    typeof e.translation === 'string' &&
    (e.status === 'ACTIVE' || e.status === 'OBSOLETE') &&
    Array.isArray(e.redirect_codes) && e.redirect_codes.every(c => typeof c === 'string') &&
    typeof e.is_high_risk === 'boolean' && typeof e.high_risk_warning === 'string' &&
    typeof e.created_at === 'string' && typeof e.updated_at === 'string';
}

function getLocalState(): LocalState {
  if (typeof localStorage === 'undefined') return { entries: [], pendingIds: new Set(), deleted: [] };
  let raw: string | null;
  let syncRaw: string | null;
  try {
    raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    syncRaw = localStorage.getItem(SYNC_STORAGE_KEY);
  } catch { throw storageError(); }
  try {
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isEntry)) throw corruptError();
    const entries: SigDictionaryEntry[] = parsed;
    if (new Set(entries.map(e => e.id)).size !== entries.length ||
        new Set(entries.map(e => codeKey(e.sig_code))).size !== entries.length) throw corruptError();
    // Older archives have no sync history. Conservatively retain every existing
    // custom code until a matching shared row or explicit local save confirms it.
    if (syncRaw === null) return { entries, pendingIds: new Set(entries.map(e => e.id)), deleted: [] };
    const sync = JSON.parse(syncRaw);
    if (sync?.version !== 1 || !Array.isArray(sync.pendingIds) ||
        !sync.pendingIds.every((id: unknown) => typeof id === 'string') ||
        !Array.isArray(sync.deleted) || !sync.deleted.every((e: DeletedEntry) => e && typeof e.id === 'string' && typeof e.code === 'string')) {
      throw corruptError();
    }
    return { entries, pendingIds: new Set(sync.pendingIds), deleted: sync.deleted };
  } catch { throw corruptError(); }
}

function saveLocalState(state: LocalState): void {
  if (typeof localStorage === 'undefined') throw storageError();
  let previousSync: string | null = null;
  let syncWritten = false;
  try {
    previousSync = localStorage.getItem(SYNC_STORAGE_KEY);
    // Record pending changes first. If the archive write fails, restore the old
    // sync record; an acknowledged save always has both durable pieces in place.
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({
      version: 1, pendingIds: [...state.pendingIds], deleted: state.deleted,
    }));
    syncWritten = true;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.entries));
  } catch {
    if (syncWritten) {
      try {
        if (previousSync === null) localStorage.removeItem(SYNC_STORAGE_KEY);
        else localStorage.setItem(SYNC_STORAGE_KEY, previousSync);
      } catch { /* The actionable failure below remains visible. */ }
    }
    recordPilotEvent('dictionary.save', { outcome: 'failed', count: state.entries.length });
    throw storageError();
  }
  recordPilotEvent('dictionary.save', { outcome: 'ok', count: state.entries.length });
  observeCustomizationCounts();
}

function normalizeInsert(value: Insert, index: number): Insert {
  if (!value || typeof value !== 'object' || typeof value.sig_code !== 'string' || !codeKey(value.sig_code) ||
      typeof value.translation !== 'string' || !value.translation.trim() ||
      (value.id !== undefined && (typeof value.id !== 'string' || !value.id)) ||
      (value.status !== undefined && value.status !== 'ACTIVE' && value.status !== 'OBSOLETE') ||
      (value.redirect_codes !== undefined && (!Array.isArray(value.redirect_codes) || !value.redirect_codes.every(c => typeof c === 'string'))) ||
      (value.is_high_risk !== undefined && typeof value.is_high_risk !== 'boolean') ||
      (value.high_risk_warning !== undefined && typeof value.high_risk_warning !== 'string')) {
    throw new Error(`Dictionary entry ${index + 1} is invalid. Each entry needs a SIG code and translation, with valid status and optional risk/redirect fields.`);
  }
  return {
    ...(value.id ? { id: value.id } : {}),
    sig_code: codeKey(value.sig_code), translation: value.translation,
    status: value.status ?? 'ACTIVE', redirect_codes: value.redirect_codes ?? [],
    is_high_risk: value.is_high_risk ?? false, high_risk_warning: value.high_risk_warning ?? '',
  };
}

function mergeInserts(state: LocalState, inputs: Insert[]): SigDictionaryEntry[] {
  const byId = new Map(state.entries.map(e => [e.id, e]));
  const byCode = new Map(state.entries.map(e => [codeKey(e.sig_code), e]));
  const changedIds = new Set<string>();
  const now = new Date().toISOString();
  for (const input of inputs) {
    const idMatch = input.id ? byId.get(input.id) : undefined;
    const codeMatch = byCode.get(input.sig_code);
    if (idMatch && codeMatch && idMatch.id !== codeMatch.id) {
      throw new Error(`Cannot rename a SIG entry to "${input.sig_code}" because that code already exists. Choose a different code or edit the existing entry.`);
    }
    const existing = idMatch ?? codeMatch;
    const entry: SigDictionaryEntry = {
      ...input,
      id: existing?.id ?? input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      created_at: existing?.created_at ?? now, updated_at: now,
    };
    if (existing) byCode.delete(codeKey(existing.sig_code));
    byId.set(entry.id, entry);
    byCode.set(entry.sig_code, entry);
    changedIds.add(entry.id);
  }
  state.entries = [...byId.values()];
  const changed = [...changedIds].map(id => byId.get(id)!);
  for (const entry of changed) state.pendingIds.add(entry.id);
  const changedCodes = new Set(changed.map(e => e.sig_code));
  state.deleted = state.deleted.filter(d => !changedIds.has(d.id) && !changedCodes.has(d.code));
  return changed;
}

function sameContent(a: SigDictionaryEntry, b: SigDictionaryEntry): boolean {
  return codeKey(a.sig_code) === codeKey(b.sig_code) && a.translation === b.translation &&
    a.status === b.status && a.is_high_risk === b.is_high_risk && a.high_risk_warning === b.high_risk_warning &&
    JSON.stringify(a.redirect_codes) === JSON.stringify(b.redirect_codes);
}

export async function fetchAllSigEntries(): Promise<SigDictionaryEntry[]> {
  // Read before requesting shared data so an unreadable local archive is never
  // silently replaced by a remote response.
  let state = getLocalState();
  if (supabase) {
    let remote: SigDictionaryEntry[] | undefined;
    try {
      const { data, error } = await supabase.from('sig_dictionary').select('*').order('sig_code', { ascending: true });
      if (!error && Array.isArray(data) && data.every(isEntry)) remote = data;
    } catch { /* The complete local archive remains available offline. */ }
    if (remote) {
      // A local save/delete may have completed while the request was pending.
      state = getLocalState();
      const byId = new Map(state.entries.map(e => [e.id, e]));
      const byCode = new Map(state.entries.map(e => [codeKey(e.sig_code), e]));
      const deletedIds = new Set(state.deleted.map(d => d.id));
      const deletedCodes = new Set(state.deleted.map(d => d.code));
      for (const row of remote) {
        if (deletedIds.has(row.id) || deletedCodes.has(codeKey(row.sig_code))) continue;
        const local = byId.get(row.id) ?? byCode.get(codeKey(row.sig_code));
        if (local && state.pendingIds.has(local.id)) {
          if (sameContent(local, row)) {
            state.pendingIds.delete(local.id);
          } else continue;
        }
        // A renamed pending entry can also occupy the response's code under a
        // different ID. Never let a partial/stale result create duplicate codes.
        const occupied = byCode.get(codeKey(row.sig_code));
        if (occupied && local && occupied.id !== local.id) continue;
        if (local) {
          byId.delete(local.id);
          byCode.delete(codeKey(local.sig_code));
        }
        byId.set(row.id, row);
        byCode.set(codeKey(row.sig_code), row);
      }
      state.entries = [...byId.values()];
      // Missing rows are not explicit deletes: shared requests can be empty or
      // paginated, and must never erase offline customizations.
      saveLocalState(state);
    }
  }
  return state.entries.sort((a, b) => a.sig_code.localeCompare(b.sig_code));
}

async function saveInserts(inputs: Insert[]): Promise<void> {
  const state = getLocalState();
  const changed = mergeInserts(state, inputs);
  saveLocalState(state);
  if (!supabase) return;
  let succeeded = false;
  try {
    const { error } = await supabase.from('sig_dictionary').upsert(changed, { onConflict: 'sig_code' });
    succeeded = !error;
  } catch { /* Durable pending changes remain available for local review. */ }
  if (succeeded) {
    const latest = getLocalState();
    const saved = new Map(changed.map(e => [e.id, e]));
    for (const entry of latest.entries) {
      const sent = saved.get(entry.id);
      if (sent && sent.updated_at === entry.updated_at && sameContent(sent, entry)) latest.pendingIds.delete(entry.id);
    }
    try {
      // Only the sync acknowledgment changed: keep bulk imports to one archive
      // write. If acknowledgment storage fails, retaining pending status is safe.
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({
        version: 1, pendingIds: [...latest.pendingIds], deleted: latest.deleted,
      }));
    } catch { /* The entries were already durably saved before the request. */ }
  }
}

export async function upsertSigEntry(entry: Insert): Promise<void> {
  await saveInserts([normalizeInsert(entry, 0)]);
}

export async function deleteSigEntry(id: string): Promise<void> {
  const state = getLocalState();
  const deleted = state.entries.find(e => e.id === id);
  state.entries = state.entries.filter(e => e.id !== id);
  state.pendingIds.delete(id);
  if (!state.deleted.some(d => d.id === id)) state.deleted.push({ id, code: deleted ? codeKey(deleted.sig_code) : '' });
  saveLocalState(state);
  if (supabase) {
    try { await supabase.from('sig_dictionary').delete().eq('id', id); }
    catch { /* The tombstone prevents a stale response resurrecting this code. */ }
  }
}

export async function bulkImportSigEntries(entries: Insert[]): Promise<number> {
  if (!Array.isArray(entries)) throw new Error('Bulk import needs a JSON array of SIG dictionary entries.');
  // Validate every row before touching either local or shared data.
  const normalized = entries.map(normalizeInsert);
  if (normalized.length) await saveInserts(normalized);
  return normalized.length;
}
