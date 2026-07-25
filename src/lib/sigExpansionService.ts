import { supabase } from './supabase';
import type { SigExpansion, SigExpansionInsert } from './types';

export async function fetchAllExpansions(): Promise<SigExpansion[]> {
  const { data, error } = await supabase
    .from('sig_expansions')
    .select('*')
    .order('priority', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertExpansion(expansion: SigExpansionInsert & { id?: string }): Promise<void> {
  const payload = {
    ...expansion,
    output_phrase: expansion.output_phrase.toUpperCase(),
    aliases: expansion.aliases.map((a) => a.toUpperCase()),
  };
  const { error } = await supabase
    .from('sig_expansions')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteExpansion(id: string): Promise<void> {
  const { error } = await supabase.from('sig_expansions').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleExpansion(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('sig_expansions').update({ enabled }).eq('id', id);
  if (error) throw error;
}

export async function reorderExpansions(ids: string[]): Promise<void> {
  const updates = ids.map((id, i) => ({ id, priority: i + 1 }));
  const { error } = await supabase.from('sig_expansions').upsert(updates, { onConflict: 'id' });
  if (error) throw error;
}
