import { supabase } from './supabase';
import type { TechRule, TechRuleInsert } from './types';

const LOCAL_STORAGE_KEY = 'sig_assist_local_tech_rules';

function getLocalRules(): TechRule[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRules(rules: TechRule[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // ignore local storage errors
  }
}

export async function fetchAllTechRules(): Promise<TechRule[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tech_rules')
        .select('*')
        .order('priority', { ascending: true });
      if (!error && data) {
        saveLocalRules(data);
        return data;
      }
    } catch {
      // Fallback to local storage
    }
  }
  return getLocalRules().sort((a, b) => a.priority - b.priority);
}

export async function upsertTechRule(rule: TechRuleInsert & { id?: string }): Promise<void> {
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { error } = await supabase.from('tech_rules').upsert(rule);
      if (!error) return;
    } catch {
      // Fallback
    }
  }

  const rules = getLocalRules();
  const existingIdx = rules.findIndex((r) => rule.id && r.id === rule.id);

  const updatedRule: TechRule = {
    id: rule.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    name: rule.name,
    target_type: rule.target_type,
    match_values: rule.match_values,
    action_type: rule.action_type,
    output_value: rule.output_value,
    priority: rule.priority ?? (existingIdx >= 0 ? rules[existingIdx].priority : rules.length + 1),
    enabled: rule.enabled ?? true,
    created_at: existingIdx >= 0 ? rules[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    rules[existingIdx] = updatedRule;
  } else {
    rules.push(updatedRule);
  }
  saveLocalRules(rules);
}

export async function deleteTechRule(id: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('tech_rules').delete().eq('id', id);
      if (!error) {
        saveLocalRules(getLocalRules().filter((r) => r.id !== id));
        return;
      }
    } catch {
      // Fallback
    }
  }
  saveLocalRules(getLocalRules().filter((r) => r.id !== id));
}

export async function reorderTechRules(orderedIds: string[]): Promise<void> {
  if (supabase) {
    try {
      const updates = orderedIds.map((id, index) =>
        supabase!.from('tech_rules').update({ priority: index + 1 }).eq('id', id)
      );
      await Promise.all(updates);
      return;
    } catch {
      // Fallback
    }
  }
  const rules = getLocalRules();
  orderedIds.forEach((id, index) => {
    const r = rules.find((item) => item.id === id);
    if (r) r.priority = index + 1;
  });
  saveLocalRules(rules.sort((a, b) => a.priority - b.priority));
}

export async function toggleTechRule(id: string, enabled: boolean): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('tech_rules').update({ enabled }).eq('id', id);
      if (!error) {
        const rules = getLocalRules();
        const r = rules.find((item) => item.id === id);
        if (r) r.enabled = enabled;
        saveLocalRules(rules);
        return;
      }
    } catch {
      // Fallback
    }
  }
  const rules = getLocalRules();
  const r = rules.find((item) => item.id === id);
  if (r) r.enabled = enabled;
  saveLocalRules(rules);
}
