import { supabase } from './supabase';
import type { SigExpansion, SigExpansionInsert } from './types';

const LOCAL_STORAGE_KEY = 'sig_assist_local_sig_expansions';

function getLocalExpansions(): SigExpansion[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalExpansions(expansions: SigExpansion[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expansions));
  } catch {
    // ignore
  }
}

export async function fetchAllExpansions(): Promise<SigExpansion[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sig_expansions')
        .select('*')
        .order('priority', { ascending: true });
      if (!error && data) {
        saveLocalExpansions(data);
        return data;
      }
    } catch {
      // Fallback
    }
  }
  return getLocalExpansions().sort((a, b) => a.priority - b.priority);
}

export async function upsertExpansion(expansion: SigExpansionInsert & { id?: string }): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    ...expansion,
    output_phrase: expansion.output_phrase.toUpperCase(),
    aliases: expansion.aliases.map((a) => a.toUpperCase()),
  };

  if (supabase) {
    try {
      const { error } = await supabase
        .from('sig_expansions')
        .upsert(payload, { onConflict: 'id' });
      if (!error) return;
    } catch {
      // Fallback
    }
  }

  const list = getLocalExpansions();
  const existingIdx = list.findIndex((e) => expansion.id && e.id === expansion.id);

  const updated: SigExpansion = {
    id: expansion.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    output_phrase: payload.output_phrase,
    aliases: payload.aliases,
    match_type: payload.match_type || 'phrase',
    enabled: payload.enabled ?? true,
    priority: payload.priority ?? (existingIdx >= 0 ? list[existingIdx].priority : list.length + 1),
    created_at: existingIdx >= 0 ? list[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    list[existingIdx] = updated;
  } else {
    list.push(updated);
  }
  saveLocalExpansions(list);
}

export async function deleteExpansion(id: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('sig_expansions').delete().eq('id', id);
      if (!error) {
        saveLocalExpansions(getLocalExpansions().filter((e) => e.id !== id));
        return;
      }
    } catch {
      // Fallback
    }
  }
  saveLocalExpansions(getLocalExpansions().filter((e) => e.id !== id));
}

export async function toggleExpansion(id: string, enabled: boolean): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('sig_expansions').update({ enabled }).eq('id', id);
      if (!error) {
        const list = getLocalExpansions();
        const item = list.find((e) => e.id === id);
        if (item) item.enabled = enabled;
        saveLocalExpansions(list);
        return;
      }
    } catch {
      // Fallback
    }
  }
  const list = getLocalExpansions();
  const item = list.find((e) => e.id === id);
  if (item) item.enabled = enabled;
  saveLocalExpansions(list);
}

export async function reorderExpansions(ids: string[]): Promise<void> {
  if (supabase) {
    try {
      const updates = ids.map((id, i) => ({ id, priority: i + 1 }));
      const { error } = await supabase.from('sig_expansions').upsert(updates, { onConflict: 'id' });
      if (!error) return;
    } catch {
      // Fallback
    }
  }
  const list = getLocalExpansions();
  ids.forEach((id, i) => {
    const item = list.find((e) => e.id === id);
    if (item) item.priority = i + 1;
  });
  saveLocalExpansions(list.sort((a, b) => a.priority - b.priority));
}
