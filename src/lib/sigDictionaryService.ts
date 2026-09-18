import { supabase, requireSupabase } from './supabase';
import type { SigDictionaryEntry, SigDictionaryInsert } from './types';

export async function fetchAllSigEntries(): Promise<SigDictionaryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await requireSupabase()
    .from('sig_dictionary')
    .select('*')
    .order('sig_code', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSigEntry(entry: SigDictionaryInsert): Promise<void> {
  const { error } = await requireSupabase()
    .from('sig_dictionary')
    .upsert({ ...entry, sig_code: entry.sig_code.toUpperCase() }, { onConflict: 'sig_code' });
  if (error) throw error;
}

export async function deleteSigEntry(id: string): Promise<void> {
  const { error } = await requireSupabase().from('sig_dictionary').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkImportSigEntries(entries: SigDictionaryInsert[]): Promise<number> {
  const normalized = entries.map((e) => ({
    ...e,
    sig_code: e.sig_code.toUpperCase(),
  }));
  const { data, error } = await requireSupabase()
    .from('sig_dictionary')
    .upsert(normalized, { onConflict: 'sig_code' })
    .select();
  if (error) throw error;
  return data?.length ?? 0;
}
