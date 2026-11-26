import { useEffect, useState } from 'react';
import type { DiscrepancyReport } from '../lib/clinical/types';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { DISCREPANCY_SAVED_EVENT } from '../lib/discrepancyCases';
import { feedbackState } from '../lib/translationFeedbackModel';
import { FEEDBACK_PENDING_EVENT, loadPendingFeedback, pendingFeedback, retryTranslationFeedback, saveTranslationFeedback } from '../lib/translationFeedback';
import { translateClinicalSig } from '../lib/clinical/clinicalEngine';

export function FeedbackOutbox() {
  const [count, setCount] = useState(pendingFeedback().length);
  useEffect(() => {
    const refresh = () => setCount(pendingFeedback().length);
    window.addEventListener(FEEDBACK_PENDING_EVENT, refresh);
    void loadPendingFeedback();
    const timer = setInterval(() => { if (pendingFeedback().length) void retryTranslationFeedback(); }, 30000);
    return () => { clearInterval(timer); window.removeEventListener(FEEDBACK_PENDING_EVENT, refresh); };
  }, []);
  if (!count) return null;
  return <div className="border-b border-amber-500 bg-amber-50 p-2 text-xs text-amber-950" role="status">
    {count} feedback updates pending. <button type="button" className="underline" onClick={() => void retryTranslationFeedback()}>Retry pending feedback</button>{' '}
    <button type="button" className="underline" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'sig-assist-pending-ratings', pending: pendingFeedback() }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'sig-assist-unsaved-ratings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }}>Download pending evidence</button>
  </div>;
}

export function TranslationFeedbackQueue() {
  const [reports, setReports] = useState<DiscrepancyReport[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => { void getCitrixStorageAdapter().readDiscrepancies().then(rows => { if (active) { setReports(rows.filter(r => r.translationFeedback)); setError(''); } }).catch(() => { if (active) setError('Saved translation feedback could not be read.'); }); };
    load(); window.addEventListener(DISCREPANCY_SAVED_EVENT, load);
    const unsubscribe = getCitrixStorageAdapter().onDirectoryConnected?.(load);
    return () => { active = false; window.removeEventListener(DISCREPANCY_SAVED_EVENT, load); unsubscribe?.(); };
  }, []);
  const deferred = reports.filter(r => feedbackState(r).deferred);
  return <details className="rounded border p-3 text-sm" aria-label="Translation feedback history">
    <summary>Translation feedback · {deferred.length} deferred explanations · {reports.length} reports</summary>
    {error && <p role="alert">{error}</p>}
    {[...deferred, ...reports.filter(r => !feedbackState(r).deferred)].map(report => <FeedbackCase key={report.id} report={report} />)}
  </details>;
}
function FeedbackCase({ report }: { report: DiscrepancyReport }) {
  const data = report.translationFeedback!;
  const state = feedbackState(report);
  const [comment, setComment] = useState('');
  const [retranslated, setRetranslated] = useState('');
  const [notice, setNotice] = useState('');
  const input = { ...data.original, currentDraft: report.technicianSig };
  return <details className="my-2 rounded border p-2">
    <summary>{report.pon} · {report.drugName} · {state.rating}/10 {state.deferred ? '· explain later' : state.resolved ? '· recorded' : '· explanation optional'}</summary>
    <dl className="space-y-1 my-2">
      <dt>Original source</dt><dd className="whitespace-pre-wrap font-mono">{report.rawProse}</dd>
      <dt>Original automatic suggestion</dt><dd className="font-mono">{data.original.presentedSig}</dd>
      <dt>Latest technician draft/correction</dt><dd className="font-mono">{report.technicianSig || 'Not captured'}</dd>
    </dl>
    <button type="button" className="rounded border px-2 py-1" onClick={() => {
      const sig = translateClinicalSig({ id: data.original.orderKey, pon: report.pon, drugName: report.drugName, rawProse: report.rawProse,
        defaultSigTemplate: data.original.context?.defaultSigTemplate, sourceFormat: 'manual_text' }, data.original.preferences || { exclusions: data.original.context?.exclusions }).primarySig;
      setRetranslated(sig);
      void saveTranslationFeedback(input, { kind: 'retranslation', retranslation: { sig, preferences: data.original.preferences }, draft: report.technicianSig })
        .then(() => setNotice('Retranslation saved as a new iteration; original evidence retained.')).catch(() => setNotice('Update pending; original evidence retained.'));
    }}>Retranslate saved source with current engine</button>
    {retranslated && <p className="font-mono my-2">Current engine ({__SIG_ASSIST_VERSION__} · {__SIG_ASSIST_BUILD__.slice(0, 8)}), original preferences: {retranslated}</p>}
    <textarea aria-label={`Explanation for ${report.pon}`} rows={3} value={comment} onChange={e => setComment(e.target.value)}
      placeholder="Add an explanation; previous comments remain in history." className="my-2 w-full rounded border bg-background p-2" />
    <button type="button" className="rounded border px-2 py-1" disabled={!comment.trim()} onClick={() => {
      void saveTranslationFeedback(input, { kind: 'comment', comment, resolved: true, draft: report.technicianSig })
        .then(() => { setComment(''); setNotice('Explanation saved; earlier iterations preserved.'); }).catch(() => setNotice('Explanation pending. Retry pending feedback or download its evidence.'));
    }}>Save explanation and finish</button>
    {notice && <p role="status">{notice}</p>}
    <details className="mt-2"><summary>All {data.events.length} iterations and original diagnostic context</summary>
      <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
    </details>
  </details>;
}
