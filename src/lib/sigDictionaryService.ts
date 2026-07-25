import { supabase } from './supabase';
import type { SigDictionaryEntry, SigDictionaryInsert } from './types';

export async function fetchAllSigEntries(): Promise<SigDictionaryEntry[]> {
  const { data, error } = await supabase
    .from('sig_dictionary')
    .select('*')
    .order('sig_code', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSigEntry(entry: SigDictionaryInsert): Promise<void> {
  const { error } = await supabase
    .from('sig_dictionary')
    .upsert({ ...entry, sig_code: entry.sig_code.toUpperCase() }, { onConflict: 'sig_code' });
  if (error) throw error;
}

export async function deleteSigEntry(id: string): Promise<void> {
  const { error } = await supabase.from('sig_dictionary').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkImportSigEntries(entries: SigDictionaryInsert[]): Promise<number> {
  const normalized = entries.map((e) => ({
    ...e,
    sig_code: e.sig_code.toUpperCase(),
  }));
  const { data, error } = await supabase
    .from('sig_dictionary')
    .upsert(normalized, { onConflict: 'sig_code' })
    .select();
  if (error) throw error;
  return data?.length ?? 0;
}
