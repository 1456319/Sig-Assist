import { useRef, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { captureFeedbackDiagnostics, recordPilotEvent, type FeedbackDiagnostics } from '../lib/pilotDiagnostics';
import type { TechnicianFeedback as FeedbackReport } from '../lib/feedbackTypes';

const input = 'w-full rounded border border-border bg-background px-2 py-1.5 text-sm';
function download(report: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function localDateTime(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TechnicianFeedback({ screen }: { screen: FeedbackReport['screen'] }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackReport['category']>('general');
  const [acceptable, setAcceptable] = useState<FeedbackReport['acceptable']>('not-rated');
  const [quality, setQuality] = useState<FeedbackReport['quality']>('as-shown');
  const [impact, setImpact] = useState<FeedbackReport['impact']>('not-rated');
  const [comment, setComment] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [minutes, setMinutes] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [diagnostics, setDiagnostics] = useState<FeedbackDiagnostics>();
  const [screenAtOpen, setScreenAtOpen] = useState(screen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState<number>();
  const identity = useRef<string>();
  const savedReport = useRef<FeedbackReport>();
  const pending = useRef(false);

  function begin() {
    if (identity.current) return;
    identity.current = `feedback_${Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')}`;
    setObservedAt(localDateTime()); setScreenAtOpen(screen);
    setDiagnostics(captureFeedbackDiagnostics(screen, getCitrixStorageAdapter().getStorageMode()));
    void getCitrixStorageAdapter().readFeedback().then(reports => setSavedCount(reports.length)).catch(() => setSavedCount(undefined));
  }
  function report(): FeedbackReport {
    if (!identity.current) throw new Error('Reopen feedback to start a report.');
    const observed = new Date(observedAt);
    if (Number.isNaN(observed.getTime())) throw new Error('Choose when this happened.');
    if (acceptable === 'not-rated' && !comment.trim()) throw new Error('Choose Yes or No, or describe your feedback.');
    const minutesLost = minutes.trim() ? Number(minutes) : undefined;
    if (minutesLost !== undefined && (!Number.isFinite(minutesLost) || minutesLost < 0 || minutesLost > 1440)) throw new Error('Minutes lost must be between 0 and 1440.');
    return {
      schemaVersion: 1, id: identity.current, timestamp: new Date().toISOString(), observedAt: observed.toISOString(),
      appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, screen: screenAtOpen,
      category, acceptable, ...(acceptable === 'yes' ? { quality } : {}), impact, comment: comment.trim(),
      ...(minutesLost !== undefined ? { minutesLost } : {}), ...(includeDiagnostics ? { diagnostics } : {}),
    };
  }
  async function save() {
    if (pending.current || saved) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    let next: FeedbackReport;
    try { next = report(); }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Choose Yes or No, or describe your feedback.');
      pending.current = false; setBusy(false); return;
    }
    try {
      const destination = await getCitrixStorageAdapter().appendFeedback(next);
      recordPilotEvent('feedback.save', { outcome: destination });
      savedReport.current = next;
      setSaved(true);
      setStatus(destination === 'file_system' ? 'Feedback saved to feedback.json in your connected folder.' : 'Feedback saved in this browser. Export it before changing address or clearing browser data.');
      void getCitrixStorageAdapter().readFeedback().then(reports => setSavedCount(reports.length)).catch(() => setSavedCount(undefined));
    } catch {
      recordPilotEvent('feedback.save', { outcome: 'failed' });
      setError('Feedback could not be saved. Your entries are still here. Retry, or download this report to keep it.');
    } finally { pending.current = false; setBusy(false); }
  }
  function downloadCurrent() {
    try { download({ format: 'sig-assist-technician-feedback', schemaVersion: 1, report: savedReport.current ?? report() }, `sig-assist-feedback-v${__SIG_ASSIST_VERSION__}-${identity.current}.json`); setError(''); setStatus('Download requested. Check your downloads before closing.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Feedback download failed.'); }
  }
  async function exportSaved() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const reports = await getCitrixStorageAdapter().readFeedback();
      if (!reports.length) throw new Error('No saved feedback is available at this address or connected folder.');
      download({ format: 'sig-assist-technician-feedback-bundle', schemaVersion: 1, appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, exportedAt: new Date().toISOString(), commentsRedacted: false, reportCount: reports.length, reports }, `sig-assist-feedback-v${__SIG_ASSIST_VERSION__}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      setStatus(`Download requested for ${reports.length} saved reports. Comments are included; review before sharing.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Saved feedback could not be exported.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function newReport() {
    identity.current = undefined; savedReport.current = undefined; setCategory('general'); setAcceptable('not-rated'); setQuality('as-shown');
    setImpact('not-rated'); setComment(''); setMinutes(''); setSaved(false); setError(''); setStatus(''); begin();
  }

  return <Dialog open={open} onOpenChange={value => { if (value) begin(); setOpen(value); }}>
    <DialogTrigger asChild><button type="button" className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium"><MessageSquarePlus className="h-3.5 w-3.5" />Feedback</button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
      <DialogHeader><DialogTitle>Technician feedback</DialogTitle><DialogDescription>What worked, what needed correction, or what made your work harder? Saved locally. No order is required.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <label className="block text-sm">Topic<select className={input} value={category} onChange={e => setCategory(e.target.value as FeedbackReport['category'])} disabled={saved || busy}>
          <option value="general">General experience</option><option value="translation">Translation / SIG</option><option value="edc">DocuTrack / E-DC</option><option value="customizations">Custom codes / preferences</option><option value="connection">Connection / server setup</option><option value="performance">Speed / extra work</option>
        </select></label>
        <fieldset disabled={saved || busy}><legend className="text-sm font-medium">Was the result acceptable? (optional)</legend><div className="flex gap-5 text-sm py-1">
          {(['yes', 'no', 'not-rated'] as const).map(value => <label key={value} className="flex items-center gap-1.5"><input type="radio" name="feedback-acceptable" value={value} checked={acceptable === value} onChange={() => setAcceptable(value)} />{value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not rating a result'}</label>)}
        </div>{acceptable === 'yes' && <label className="block text-sm">How did it meet your needs?<select className={input} value={quality} onChange={e => setQuality(e.target.value as FeedbackReport['quality'])}><option value="as-shown">Worked as shown</option><option value="after-correction">Acceptable after a correction</option></select></label>}</fieldset>
        <label className="block text-sm">Impact<select className={input} value={impact} onChange={e => setImpact(e.target.value as FeedbackReport['impact'])} disabled={saved || busy}>
          <option value="not-rated">Not rated</option><option value="none">No problem / positive feedback</option><option value="annoyance">Minor annoyance</option><option value="slowed-work">Slowed my work</option><option value="blocked-work">Stopped me completing the task</option><option value="potential-order-error">Could cause an incorrect order or action</option>
        </select></label>
        <label className="block text-sm">Comments / what you changed (optional)<textarea className={input} rows={3} maxLength={8000} value={comment} onChange={e => setComment(e.target.value)} disabled={saved || busy} placeholder="For example: Yes, acceptable after adding a missing instruction; or my custom SIG codes disappeared after relaunch." /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">When did this happen?<input className={input} type="datetime-local" value={observedAt} onChange={e => setObservedAt(e.target.value)} disabled={saved || busy} /></label><label className="text-sm">Estimated minutes lost (optional)<input className={input} type="number" min="0" max="1440" value={minutes} onChange={e => setMinutes(e.target.value)} disabled={saved || busy} /></label></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={includeDiagnostics} onChange={e => setIncludeDiagnostics(e.target.checked)} disabled={saved || busy} />Include troubleshooting details: version, screen, storage, customization counts, timings and result codes.</label>
        <p className="text-xs text-muted-foreground">Keep patient names, PONs and passwords out of comments. Troubleshooting details do not copy order text or credentials. Review comments before sharing an export.</p>
        <details className="text-xs"><summary className="cursor-pointer">Preview troubleshooting details · PILOT</summary><p className="my-2">PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION — review this recorder before release. Feedback remains useful in production.</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border p-2">{includeDiagnostics ? JSON.stringify(diagnostics, null, 2) : 'Troubleshooting details excluded.'}</pre></details>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-300">{error}</p>}
        {status && <p role="status" className="text-sm font-medium">{status}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || saved} onClick={() => void save()} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Working…' : saved ? 'Feedback saved' : 'Save feedback locally'}</button><button type="button" disabled={busy} onClick={downloadCurrent} className="rounded border px-3 py-2 text-sm">Download this report</button>{saved && <button type="button" onClick={newReport} className="rounded border px-3 py-2 text-sm">New feedback</button>}</div>
        <div className="flex items-center gap-3 border-t pt-3"><button type="button" disabled={busy} onClick={() => void exportSaved()} className="rounded border px-3 py-2 text-sm">Export saved feedback</button><span className="text-xs text-muted-foreground">{savedCount === undefined ? 'Local feedback archive' : `${savedCount} saved reports`}</span></div>
        <p className="text-xs text-muted-foreground">v{__SIG_ASSIST_VERSION__} · build {__SIG_ASSIST_BUILD__.slice(0, 12)} · {screenAtOpen}</p>
      </div>
    </DialogContent>
  </Dialog>;
}
