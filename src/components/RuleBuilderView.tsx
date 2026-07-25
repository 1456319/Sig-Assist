import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, GripVertical, Pencil, Trash2, RefreshCw, ListX,
  Zap, ChevronRight, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchAllTechRules, upsertTechRule, deleteTechRule, reorderTechRules, toggleTechRule } from '../lib/techRulesService';
import type { TechRule, TechRuleInsert } from '../lib/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { applyTechRules } from '../lib/parser';

type TargetType = TechRule['target_type'];
type ActionType = TechRule['action_type'];

const TARGET_LABELS: Record<TargetType, string> = {
  contains: 'Contains',
  starts_with: 'Starts With',
  ends_with: 'Ends With',
  exact: 'Exact Match',
  regex: 'Regex',
};

const ACTION_LABELS: Record<ActionType, string> = {
  replace: 'Replace With',
  append: 'Append',
  prepend: 'Prepend',
};

const EMPTY_FORM: TechRuleInsert = {
  name: '',
  target_type: 'contains',
  match_values: [],
  action_type: 'replace',
  output_value: '',
  priority: 100,
  enabled: true,
};

function RuleSummary({ rule }: { rule: TechRule }) {
  return (
    <span className="text-[11px] text-muted-foreground font-mono-tight">
      If input <span className="text-primary font-medium">{TARGET_LABELS[rule.target_type]}</span>{' '}
      [{rule.match_values.map((v, i) => (
        <span key={i}>{i > 0 && ', '}<span className="text-foreground font-medium">"{v}"</span></span>
      ))}]{' '}
      <ChevronRight className="w-3 h-3 inline" />{' '}
      <span className="text-primary font-medium">{ACTION_LABELS[rule.action_type]}</span>{' '}
      "<span className="text-foreground font-medium">{rule.output_value}</span>"
    </span>
  );
}

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const add = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInputVal('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-background border border-input rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-mono px-1.5 py-0.5 rounded">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !inputVal && value.length > 0) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length === 0 ? 'Add match pattern, press Enter...' : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-[12px] placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function RuleModal({
  open, rule, onClose, onSave,
}: {
  open: boolean;
  rule: TechRuleInsert | null;
  onClose: () => void;
  onSave: (data: TechRuleInsert) => Promise<void>;
}) {
  const [form, setForm] = useState<TechRuleInsert>(rule ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState('Take 1 tablet twice daily by mouth as needed');
  const [testOutput, setTestOutput] = useState('');

  useEffect(() => {
    if (open) setForm(rule ?? EMPTY_FORM);
  }, [open, rule]);

  // Live preview
  useEffect(() => {
    if (!form.name || form.match_values.length === 0 || !form.output_value) {
      setTestOutput(testInput);
      return;
    }
    const mockRule: TechRule = { ...form, id: 'preview', priority: 1, created_at: '', updated_at: '' };
    const { output } = applyTechRules(testInput, [mockRule]);
    setTestOutput(output);
  }, [form, testInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    if (form.match_values.length === 0) { toast.error('At least one match pattern is required'); return; }
    if (!form.output_value.trim()) { toast.error('Output value is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const changed = testInput !== testOutput;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule?.name ? `Edit — ${rule.name}` : 'Add Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">Rule Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Normalize 'twice daily' to BID"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">Match Type *</label>
              <select
                value={form.target_type}
                onChange={(e) => setForm({ ...form, target_type: e.target.value as TargetType })}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(TARGET_LABELS) as [TargetType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">Action *</label>
              <select
                value={form.action_type}
                onChange={(e) => setForm({ ...form, action_type: e.target.value as ActionType })}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">Match Patterns *</label>
            <TagInput value={form.match_values} onChange={(v) => setForm({ ...form, match_values: v })} />
            <p className="text-[10px] text-muted-foreground mt-1">Press Enter or comma to add each pattern</p>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">Output Value *</label>
            <input
              value={form.output_value}
              onChange={(e) => setForm({ ...form, output_value: e.target.value })}
              placeholder="e.g. BID"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
              <Zap className="w-3 h-3" />Live Preview
            </p>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Test Input</p>
              <input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-[12px] font-mono outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Output</p>
              <div className={cn(
                'bg-background border rounded px-2.5 py-1.5 text-[12px] font-mono min-h-[32px]',
                changed ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-input text-muted-foreground'
              )}>
                {testOutput || testInput}
              </div>
            </div>
            {changed && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                ✓ Rule matches and transforms this input
              </p>
            )}
          </div>

          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RuleBuilderView() {
  const [rules, setRules] = useState<TechRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<TechRuleInsert | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const saveRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await fetchAllTechRules());
    } catch {
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: TechRuleInsert) => {
    const payload = editId ? { ...data, id: editId } : data;
    await upsertTechRule(payload);
    toast.success(editId ? 'Rule updated' : 'Rule created');
    setEditId(null);
    await load();
  };

  const handleDelete = async (rule: TechRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteTechRule(rule.id);
      toast.success('Rule deleted');
      await load();
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleToggle = async (rule: TechRule) => {
    try {
      await toggleTechRule(rule.id, !rule.enabled);
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  // Drag and drop
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnd = () => {
    if (dragging && dragOver && dragging !== dragOver) {
      const reordered = [...rules];
      const fromIdx = reordered.findIndex((r) => r.id === dragging);
      const toIdx = reordered.findIndex((r) => r.id === dragOver);
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const updated = reordered.map((r, i) => ({ ...r, priority: i + 1 }));
      setRules(updated);
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => {
        reorderTechRules(updated.map((r) => r.id)).catch(() => toast.error('Failed to save order'));
      }, 800);
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/20 flex-shrink-0">
        <p className="text-sm text-muted-foreground flex-1">
          Rules execute in priority order (top = first). Drag to reorder.
        </p>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-input hover:bg-muted text-muted-foreground transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
        <button
          onClick={() => { setEditRule(null); setEditId(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-auto scrollbar-thin p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <ListX className="w-8 h-8 opacity-30" />
            <p className="text-sm">No rules yet. Add your first transformation rule.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {rules.map((rule) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => handleDragStart(rule.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(rule.id); }}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-3 bg-card border rounded-lg px-3 py-3 transition-all cursor-grab active:cursor-grabbing',
                  !rule.enabled && 'opacity-50',
                  dragging === rule.id && 'opacity-40 scale-[0.98] border-dashed',
                  dragOver === rule.id && dragging !== rule.id && 'border-primary/60 bg-primary/5 scale-[1.01]',
                  dragOver !== rule.id && 'border-border'
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />

                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                  <span className="font-mono text-[11px] text-muted-foreground font-bold">{rule.priority}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{rule.name}</p>
                  <RuleSummary rule={rule} />
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(rule)}
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-colors',
                      rule.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {rule.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => {
                      setEditRule({
                        name: rule.name,
                        target_type: rule.target_type,
                        match_values: rule.match_values,
                        action_type: rule.action_type,
                        output_value: rule.output_value,
                        priority: rule.priority,
                        enabled: rule.enabled,
                      });
                      setEditId(rule.id);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RuleModal
        open={modalOpen}
        rule={editRule}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
