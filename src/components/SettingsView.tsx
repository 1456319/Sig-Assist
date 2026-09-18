import { useState, useCallback } from 'react';
import { Download, Trash2, RefreshCw, Database, Shield, BookOpen, Wand2 } from 'lucide-react';
import { fetchAllSigEntries, deleteSigEntry, fetchAllSigEntries as fetchAll } from '../lib/sigDictionaryService';
import { fetchAllTechRules, deleteTechRule } from '../lib/techRulesService';
import { toast } from 'sonner';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[12px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DangerSection({ title, description, buttonLabel, onConfirm, loading }: {
  title: string;
  description: string;
  buttonLabel: string;
  onConfirm: () => Promise<void>;
  loading: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = async () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    await onConfirm();
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
      <div>
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={handleClick}
        onBlur={() => setConfirming(false)}
        disabled={loading}
        className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ml-4 ${
          confirming
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'border border-destructive/40 text-destructive hover:bg-destructive/10'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {confirming ? 'Click again to confirm' : buttonLabel}
      </button>
    </div>
  );
}

export function SettingsView() {
  const [stats, setStats] = useState({ dict: 0, active: 0, obsolete: 0, highRisk: 0, rules: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [clearDictLoading, setClearDictLoading] = useState(false);
  const [clearRulesLoading, setClearRulesLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [entries, rules] = await Promise.all([fetchAllSigEntries(), fetchAllTechRules()]);
      setStats({
        dict: entries.length,
        active: entries.filter((e) => e.status === 'ACTIVE').length,
        obsolete: entries.filter((e) => e.status === 'OBSOLETE').length,
        highRisk: entries.filter((e) => e.is_high_risk).length,
        rules: rules.length,
      });
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const entries = await fetchAll();
      const json = JSON.stringify(entries.map(({ sig_code, translation, status, redirect_codes, is_high_risk, high_risk_warning }) => ({
        sig_code, translation, status, redirect_codes, is_high_risk, high_risk_warning,
      })), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sig-dictionary-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dictionary exported successfully');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClearDictionary = async () => {
    setClearDictLoading(true);
    try {
      const entries = await fetchAllSigEntries();
      await Promise.all(entries.map((e) => deleteSigEntry(e.id)));
      toast.success(`Cleared ${entries.length} dictionary entries`);
      await refreshStats();
    } catch {
      toast.error('Failed to clear dictionary');
    } finally {
      setClearDictLoading(false);
    }
  };

  const handleClearRules = async () => {
    setClearRulesLoading(true);
    try {
      const rules = await fetchAllTechRules();
      await Promise.all(rules.map((r) => deleteTechRule(r.id)));
      toast.success(`Cleared ${rules.length} tech rules`);
      await refreshStats();
    } catch {
      toast.error('Failed to clear rules');
    } finally {
      setClearRulesLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Stats */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            Database Statistics
          </h2>
          <button
            onClick={refreshStats}
            disabled={statsLoading}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={BookOpen}  label="Total SIG Codes"  value={stats.dict}     color="bg-primary/10 text-primary" />
          <StatCard icon={Database}  label="Active Codes"     value={stats.active}   color="bg-emerald-500/10 text-emerald-500" />
          <StatCard icon={Shield}    label="High Risk Codes"  value={stats.highRisk} color="bg-destructive/10 text-destructive" />
          <StatCard icon={RefreshCw} label="Obsolete Codes"   value={stats.obsolete} color="bg-muted text-muted-foreground" />
          <StatCard icon={Wand2}     label="Tech Rules"       value={stats.rules}    color="bg-violet-500/10 text-violet-500" />
        </div>
      </section>

      {/* Export */}
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Data Export
        </h2>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div>
            <p className="text-[13px] font-medium text-foreground">Export SIG Dictionary</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Download all dictionary entries as a JSON file suitable for re-import.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors flex-shrink-0 ml-4"
          >
            <Download className="w-3.5 h-3.5" />
            {exportLoading ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-destructive mb-4">
          Danger Zone
        </h2>
        <div className="space-y-3">
          <DangerSection
            title="Clear SIG Dictionary"
            description="Permanently deletes all SIG code entries from the database."
            buttonLabel="Clear Dictionary"
            onConfirm={handleClearDictionary}
            loading={clearDictLoading}
          />
          <DangerSection
            title="Clear All Tech Rules"
            description="Permanently deletes all custom transformation rules."
            buttonLabel="Clear Rules"
            onConfirm={handleClearRules}
            loading={clearRulesLoading}
          />
        </div>
      </section>

      {/* JSON format reference */}
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Bulk Import Format Reference
        </h2>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[12px] text-muted-foreground mb-3">
            Upload a JSON file with this structure in the SIG Dictionary view to import entries in bulk:
          </p>
          <pre className="font-mono-tight text-[11px] text-foreground/80 bg-muted/60 rounded p-3 overflow-x-auto">{`[
  {
    "sig_code": "BID",
    "translation": "Twice Daily",
    "status": "ACTIVE",
    "redirect_codes": [],
    "is_high_risk": false,
    "high_risk_warning": ""
  },
  {
    "sig_code": "QDPRN",
    "translation": "Once Daily As Needed (Obsolete)",
    "status": "OBSOLETE",
    "redirect_codes": ["QD", "PRN"],
    "is_high_risk": false,
    "high_risk_warning": ""
  }
]`}</pre>
        </div>
      </section>
    </div>
  );
}
