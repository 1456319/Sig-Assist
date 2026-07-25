import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, ListX, X, ChevronRight,
  ReplaceAll, Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  fetchAllExpansions,
  upsertExpansion,
  deleteExpansion,
  toggleExpansion,
} from '../lib/sigExpansionService';
import type { SigExpansion, SigExpansionInsert } from '../lib/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

const EMPTY_FORM: SigExpansionInsert = {
  output_phrase: '',
  aliases: [],
  match_type: 'token',
  enabled: true,
  priority: 100,
};

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const add = () => {
    const trimmed = inputVal.trim().toUpperCase();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInputVal('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-background border border-input rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-mono px-1.5 py-0.5 rounded">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !inputVal && value.length > 0) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length === 0 ? 'Type an alias, press Enter...' : ''}
        className="flex-1 min-w-[140px] bg-transparent outline-none text-[12px] placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function ExpansionModal({
  open, expansion, onClose, onSave,
}: {
  open: boolean;
  expansion: (SigExpansionInsert & { id?: string }) | null;
  onClose: () => void;
  onSave: (data: SigExpansionInsert & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<SigExpansionInsert & { id?: string }>(expansion ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(expansion ?? EMPTY_FORM);
  }, [open, expansion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.output_phrase.trim()) { toast.error('Output phrase is required'); return; }
    if (form.aliases.length === 0) { toast.error('At least one alias is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!expansion?.id;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Expansion` : 'Add Phrase Expansion'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">
              Output Phrase <span className="text-destructive">*</span>
            </label>
            <input
              value={form.output_phrase}
              onChange={(e) => setForm({ ...form, output_phrase: e.target.value.toUpperCase() })}
              placeholder="e.g. FOR GENERALIZED ANXIETY DISORDER"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              The canonical phrase that will be inserted when any alias matches.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">
              Aliases / Trigger Codes <span className="text-destructive">*</span>
            </label>
            <TagInput value={form.aliases} onChange={(v) => setForm({ ...form, aliases: v })} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Any of these inputs will expand to the output phrase above. Press Enter or comma to add each one.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">
              Match Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['token', 'phrase'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm({ ...form, match_type: mode })}
                  className={cn(
                    'px-3 py-2.5 rounded-lg border text-[12px] text-left transition-colors',
                    form.match_type === mode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <p className="font-medium capitalize">{mode}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">
                    {mode === 'token'
                      ? 'Match whole words/codes only'
                      : 'Match anywhere in the text'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
              <Zap className="w-3 h-3" />Example
            </p>
            {form.aliases.length > 0 && form.output_phrase.trim() ? (
              <div className="flex flex-wrap gap-1 items-center">
                {form.aliases.map((a, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground text-[10px]">or</span>}
                    <span className="font-mono text-[11px] bg-background border border-border px-1.5 py-0.5 rounded text-foreground">{a}</span>
                  </span>
                ))}
                <ChevronRight className="w-3.5 h-3.5 text-amber-500 mx-1" />
                <span className="font-mono text-[11px] bg-background border border-amber-500/40 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400">
                  {form.output_phrase}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Add aliases and an output phrase to see a preview.</p>
            )}
          </div>

          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] bg-amber-500 text-white font-medium hover:bg-amber-500/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Expansion'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpansionView() {
  const [expansions, setExpansions] = useState<SigExpansion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editExpansion, setEditExpansion] = useState<(SigExpansionInsert & { id?: string }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpansions(await fetchAllExpansions());
    } catch {
      toast.error('Failed to load expansions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: SigExpansionInsert & { id?: string }) => {
    await upsertExpansion(data);
    toast.success(data.id ? 'Expansion updated' : 'Expansion created');
    await load();
  };

  const handleDelete = async (exp: SigExpansion) => {
    if (!confirm(`Delete expansion for "${exp.output_phrase}"?`)) return;
    try {
      await deleteExpansion(exp.id);
      toast.success('Expansion deleted');
      await load();
    } catch {
      toast.error('Failed to delete expansion');
    }
  };

  const handleToggle = async (exp: SigExpansion) => {
    try {
      await toggleExpansion(exp.id, !exp.enabled);
      setExpansions((prev) => prev.map((e) => e.id === exp.id ? { ...e, enabled: !e.enabled } : e));
    } catch {
      toast.error('Failed to toggle expansion');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/20 flex-shrink-0">
        <p className="text-sm text-muted-foreground flex-1">
          Phrase expansions run before tokenization, mapping shorthand aliases to full output phrases.
        </p>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-input hover:bg-muted text-muted-foreground transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
        <button
          onClick={() => { setEditExpansion(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] bg-amber-500 text-white font-medium hover:bg-amber-500/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Expansion
        </button>
      </div>

      {/* How it works note */}
      <div className="px-5 py-2.5 bg-amber-500/5 border-b border-amber-500/10 flex-shrink-0">
        <p className="text-[11px] text-amber-700 dark:text-amber-400/80">
          <strong>How it works:</strong> Before any SIG codes are resolved, the parser scans for these alias patterns and replaces them with their full output phrase verbatim. Use this for conditions with no SIG code (like Generalized Anxiety Disorder) where you want to type in shorthand but output the full text.
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto scrollbar-thin p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
        ) : expansions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <ListX className="w-8 h-8 opacity-30" />
            <p className="text-sm">No expansions yet. Add your first phrase expansion rule.</p>
            <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
              Example: Map "GEN ANX DIS", "GAD", or "FGAD" → "FOR GENERALIZED ANXIETY DISORDER"
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {expansions.map((exp) => (
              <div
                key={exp.id}
                className={cn(
                  'flex items-start gap-3 bg-card border rounded-lg px-4 py-3 transition-all',
                  !exp.enabled && 'opacity-50',
                  'border-border'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <ReplaceAll className="w-4 h-4 text-amber-500/60" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                    {exp.aliases.map((alias, i) => (
                      <span key={i} className="font-mono text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {alias}
                      </span>
                    ))}
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono text-[12px] font-semibold text-foreground">
                      {exp.output_phrase}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Match mode: <span className="capitalize font-medium text-foreground/60">{exp.match_type}</span>
                    {' · '}Priority: <span className="font-medium text-foreground/60">{exp.priority}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(exp)}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-colors',
                      exp.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {exp.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => {
                      setEditExpansion({
                        id: exp.id,
                        output_phrase: exp.output_phrase,
                        aliases: exp.aliases,
                        match_type: exp.match_type,
                        enabled: exp.enabled,
                        priority: exp.priority,
                      });
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(exp)}
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

      <ExpansionModal
        open={modalOpen}
        expansion={editExpansion}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
