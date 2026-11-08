import { supabase } from './supabase';
import type { SigDictionaryEntry, SigDictionaryInsert } from './types';

const LOCAL_STORAGE_KEY = 'sig_assist_local_sig_dictionary';

function getLocalEntries(): SigDictionaryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEntries(entries: SigDictionaryEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore local storage errors
  }
}

export async function fetchAllSigEntries(): Promise<SigDictionaryEntry[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sig_dictionary')
        .select('*')
        .order('sig_code', { ascending: true });
      if (!error && data) {
        saveLocalEntries(data);
        return data;
      }
    } catch {
      // Fallback to local storage if remote request fails
    }
  }
  return getLocalEntries().sort((a, b) => a.sig_code.localeCompare(b.sig_code));
}

export async function upsertSigEntry(entry: SigDictionaryInsert & { id?: string }): Promise<void> {
  const normalizedCode = entry.sig_code.toUpperCase();
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { error } = await supabase
        .from('sig_dictionary')
        .upsert({ ...entry, sig_code: normalizedCode }, { onConflict: 'sig_code' });
      if (!error) return;
    } catch {
      // Fallback to local storage if remote request fails
    }
  }

  const entries = getLocalEntries();
  const existingIdx = entries.findIndex(
    (e) => (entry.id && e.id === entry.id) || e.sig_code.toUpperCase() === normalizedCode
  );

  const newEntry: SigDictionaryEntry = {
    id: entry.id || (existingIdx >= 0 ? entries[existingIdx].id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`)),
    sig_code: normalizedCode,
    translation: entry.translation,
    status: entry.status || 'ACTIVE',
    redirect_codes: entry.redirect_codes || [],
    is_high_risk: Boolean(entry.is_high_risk),
    high_risk_warning: entry.high_risk_warning || '',
    created_at: existingIdx >= 0 ? entries[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = newEntry;
  } else {
    entries.push(newEntry);
  }
  saveLocalEntries(entries);
}

export async function deleteSigEntry(id: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('sig_dictionary').delete().eq('id', id);
      if (!error) {
        const entries = getLocalEntries().filter((e) => e.id !== id);
        saveLocalEntries(entries);
        return;
      }
    } catch {
      // Fallback to local storage
    }
  }
  const entries = getLocalEntries().filter((e) => e.id !== id);
  saveLocalEntries(entries);
}

export async function bulkImportSigEntries(entries: SigDictionaryInsert[]): Promise<number> {
  const normalized = entries.map((e) => ({
    ...e,
    sig_code: e.sig_code.toUpperCase(),
  }));

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sig_dictionary')
        .upsert(normalized, { onConflict: 'sig_code' })
        .select();
      if (!error && data) return data.length;
    } catch {
      // Fallback to local storage
    }
  }

  for (const entry of normalized) {
    await upsertSigEntry(entry);
  }
  return normalized.length;
}
