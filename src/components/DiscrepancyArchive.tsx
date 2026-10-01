import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { DISCREPANCY_SAVED_EVENT, exportDiscrepancyCases } from '../lib/discrepancyCases';

export function DiscrepancyArchive() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const reports = await getCitrixStorageAdapter().readDiscrepancies();
        if (active) { setCount(reports.length); setError(''); }
      } catch {
        if (active) setError('Could not read saved reports.');
      }
    };
    void refresh();
    window.addEventListener(DISCREPANCY_SAVED_EVENT, refresh);
    const unsubscribe = getCitrixStorageAdapter().onDirectoryConnected?.(refresh);
    return () => {
      active = false;
      window.removeEventListener(DISCREPANCY_SAVED_EVENT, refresh);
      unsubscribe?.();
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const bundle = await exportDiscrepancyCases();
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sig-assist-cases-${bundle.exportedAt.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${bundle.caseCount} discrepancy reports.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Case export failed.');
    } finally {
      setExporting(false);
    }
  };

  return <section aria-label="Saved discrepancy cases" className="rounded-lg border border-border bg-card p-4 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium">{error || (count === null ? 'Loading saved reports…' : `${count} saved discrepancy reports`)}</p>
      <button type="button" onClick={handleExport} disabled={exporting || !count || !!error}
        className="rounded border border-primary/30 px-3 py-2 text-sm text-primary disabled:opacity-50">
        {exporting ? 'Exporting…' : 'Export discrepancy cases'}
      </button>
    </div>
    <p className="text-xs text-muted-foreground">Reports stay local. Export a file after each session and before changing folders or clearing browser data. Case files include original directions, PON, corrections and notes; remove patient identifiers before sharing.</p>
  </section>;
}
