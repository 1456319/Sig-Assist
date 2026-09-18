import { supabase, requireSupabase } from './supabase';
import type { TechRule, TechRuleInsert } from './types';

export async function fetchAllTechRules(): Promise<TechRule[]> {
  if (!supabase) return [];
  const { data, error } = await requireSupabase()
    .from('tech_rules')
    .select('*')
    .order('priority', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertTechRule(rule: TechRuleInsert & { id?: string }): Promise<void> {
  const { error } = await requireSupabase().from('tech_rules').upsert(rule);
  if (error) throw error;
}

export async function deleteTechRule(id: string): Promise<void> {
  const { error } = await requireSupabase().from('tech_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderTechRules(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    requireSupabase().from('tech_rules').update({ priority: index + 1 }).eq('id', id)
  );
  await Promise.all(updates);
}

export async function toggleTechRule(id: string, enabled: boolean): Promise<void> {
  const { error } = await requireSupabase().from('tech_rules').update({ enabled }).eq('id', id);
  if (error) throw error;
}
