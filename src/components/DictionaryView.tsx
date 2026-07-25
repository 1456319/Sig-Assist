import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, Upload, RefreshCw, ChevronUp, ChevronDown,
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, X, Tag
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchAllSigEntries, upsertSigEntry, deleteSigEntry, bulkImportSigEntries } from '../lib/sigDictionaryService';
import type { SigDictionaryEntry, SigDictionaryInsert } from '../lib/types';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type SortField = 'sig_code' | 'translation' | 'status' | 'is_high_risk';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'ACTIVE' | 'OBSOLETE';

const EMPTY_FORM: SigDictionaryInsert = {
  sig_code: '',
  translation: '',
  status: 'ACTIVE',
  redirect_codes: [],
  is_high_risk: false,
  high_risk_warning: '',
};

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const add = () => {
    const trimmed = inputVal.trim().toUpperCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputVal('');
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-background border border-input rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-mono px-1.5 py-0.5 rounded">
          {tag}
          <button type="button" onClick={() => remove(tag)}>
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !inputVal && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length === 0 ? 'Type code, press Enter...' : ''}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-[12px] placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function EntryModal({
  open, entry, onClose, onSave,
}: {
  open: boolean;
  entry: SigDictionaryInsert | null;
  onClose: () => void;
  onSave: (data: SigDictionaryInsert) => Promise<void>;
}) {
  const [form, setForm] = useState<SigDictionaryInsert>(entry ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(entry ?? EMPTY_FORM);
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sig_code.trim() || !form.translation.trim()) {
      toast.error('SIG Code and Translation are required');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode, required?: boolean) => (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {node}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry?.sig_code ? `Edit — ${entry.sig_code}` : 'Add SIG Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            {field('SIG Code', (
              <input
                value={form.sig_code}
                onChange={(e) => setForm({ ...form, sig_code: e.target.value.toUpperCase() })}
                placeholder="e.g. BID"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            ), true)}
            {field('Status', (
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'OBSOLETE' })}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="OBSOLETE">OBSOLETE</option>
              </select>
            ))}
          </div>

          {field('Translation', (
            <input
              value={form.translation}
              onChange={(e) => setForm({ ...form, translation: e.target.value })}
              placeholder="e.g. Twice Daily"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
          ), true)}

          {form.status === 'OBSOLETE' && field('Redirect Codes', (
            <TagInput
              value={form.redirect_codes}
              onChange={(v) => setForm({ ...form, redirect_codes: v })}
            />
          ))}

          <div className="flex items-center gap-2">
            <input
              id="high-risk"
              type="checkbox"
              checked={form.is_high_risk}
              onChange={(e) => setForm({ ...form, is_high_risk: e.target.checked })}
              className="w-4 h-4 rounded border-input accent-destructive"
            />
            <label htmlFor="high-risk" className="text-[13px] text-foreground cursor-pointer flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
              Mark as High Risk
            </label>
          </div>

          {form.is_high_risk && field('High Risk Warning', (
            <textarea
              value={form.high_risk_warning}
              onChange={(e) => setForm({ ...form, high_risk_warning: e.target.value })}
              placeholder="Warning message shown on hover..."
              rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          ))}

          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DictionaryView() {
  const [entries, setEntries] = useState<SigDictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('sig_code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SigDictionaryInsert | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllSigEntries();
      setEntries(data);
    } catch {
      toast.error('Failed to load SIG dictionary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSave = async (data: SigDictionaryInsert) => {
    await upsertSigEntry(data);
    toast.success(`SIG code "${data.sig_code}" saved`);
    await load();
  };

  const handleDelete = async (entry: SigDictionaryEntry) => {
    if (!confirm(`Delete "${entry.sig_code}"? This cannot be undone.`)) return;
    try {
      await deleteSigEntry(entry.id);
      toast.success(`Deleted "${entry.sig_code}"`);
      await load();
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBulkImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const count = await bulkImportSigEntries(arr);
      toast.success(`Imported ${count} entries`);
      await load();
    } catch {
      toast.error('Bulk import failed — ensure valid JSON array');
    } finally {
      setBulkImporting(false);
    }
  };

  const filtered = entries
    .filter((e) => {
      const q = search.toLowerCase();
      if (q && !e.sig_code.toLowerCase().includes(q) && !e.translation.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (highRiskOnly && !e.is_high_risk) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'sig_code') cmp = a.sig_code.localeCompare(b.sig_code);
      else if (sortField === 'translation') cmp = a.translation.localeCompare(b.translation);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'is_high_risk') cmp = Number(b.is_high_risk) - Number(a.is_high_risk);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const stats = {
    total: entries.length,
    active: entries.filter((e) => e.status === 'ACTIVE').length,
    obsolete: entries.filter((e) => e.status === 'OBSOLETE').length,
    highRisk: entries.filter((e) => e.is_high_risk).length,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-card/30 flex-shrink-0">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Active', value: stats.active, color: 'text-emerald-500' },
          { label: 'Obsolete', value: stats.obsolete, color: 'text-muted-foreground' },
          { label: 'High Risk', value: stats.highRisk, color: 'text-high-risk' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('text-lg font-bold tabular-nums', color)}>{value}</span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/20 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search codes or translations..."
            className="w-full bg-background border border-input rounded-lg pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-background border border-input rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="OBSOLETE">Obsolete Only</option>
        </select>
        <button
          onClick={() => setHighRiskOnly(!highRiskOnly)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border transition-colors',
            highRiskOnly
              ? 'bg-destructive/10 text-high-risk border-high-risk/30'
              : 'bg-background border-input text-muted-foreground hover:text-foreground'
          )}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          High Risk
        </button>
        <div className="flex-1" />
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-input hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
        <label className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border border-input cursor-pointer transition-colors',
          'hover:bg-muted text-muted-foreground hover:text-foreground',
          bulkImporting && 'opacity-60 pointer-events-none'
        )}>
          <Upload className="w-3.5 h-3.5" />
          {bulkImporting ? 'Importing...' : 'Bulk Import JSON'}
          <input type="file" accept=".json" onChange={handleBulkImport} className="hidden" />
        </label>
        <button
          onClick={() => { setEditEntry(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Entry
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 z-10 bg-card border-b border-border">
            <tr>
              {([
                { field: 'sig_code' as SortField, label: 'SIG Code', w: 'w-24' },
                { field: 'translation' as SortField, label: 'Translation', w: 'flex-1' },
                { field: 'status' as SortField, label: 'Status', w: 'w-24' },
              ]).map(({ field, label, w }) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className={cn('text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none', w)}
                >
                  <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
                </th>
              ))}
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground w-36">
                <span className="flex items-center gap-1">Redirects <Tag className="w-3 h-3" /></span>
              </th>
              <th
                onClick={() => handleSort('is_high_risk')}
                className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none w-24"
              >
                <span className="flex items-center gap-1">Risk <SortIcon field="is_high_risk" /></span>
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">No entries match your filters</td></tr>
            ) : filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[12px] font-semibold text-foreground">{entry.sig_code}</span>
                </td>
                <td className="px-4 py-2.5 text-foreground/80">{entry.translation}</td>
                <td className="px-4 py-2.5">
                  {entry.status === 'ACTIVE' ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                      <CheckCircle2 className="w-3 h-3" />ACTIVE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground text-[11px] font-medium">
                      <XCircle className="w-3 h-3" />OBSOLETE
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {entry.redirect_codes.map((c) => (
                      <span key={c} className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {entry.is_high_risk ? (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 text-high-risk text-[11px] font-medium cursor-help">
                            <AlertTriangle className="w-3.5 h-3.5" />HIGH
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-xs">
                          {entry.high_risk_warning}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditEntry({
                          sig_code: entry.sig_code,
                          translation: entry.translation,
                          status: entry.status,
                          redirect_codes: entry.redirect_codes,
                          is_high_risk: entry.is_high_risk,
                          high_risk_warning: entry.high_risk_warning,
                        });
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EntryModal
        open={modalOpen}
        entry={editEntry}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
