import { useEffect, useRef, useState } from 'react';
import { useReviewSession } from '../hooks/use-review-session';
import { sourceStamp, type QueueOrder } from '../lib/orderQueue';
import { sigDatasetStore } from '../lib/sigDataset';
import { datasetCaptureState, orderDatasetInput, pendingDatasetExport, queueSigSample, retryDatasetCapture, setDatasetCaptureEnabled, subscribeDatasetCapture } from '../lib/sigDatasetCapture';
import { reviewButtonClass, reviewInputClass } from './SigReviewPanel';
import { findDatasetSource, readFrameworkSigSnapshot } from '../lib/frameworkSigDataset';

function downloadDataset(rows: unknown[], name: string) {
  const blob = new Blob(rows.map(row => JSON.stringify(row) + '\n'), { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SigDatasetPanel() {
  const { orders, ready } = useReviewSession();
  const [capture, setCapture] = useState(datasetCaptureState);
  const [stats, setStats] = useState<{ total: number; stages: Record<string, number> }>();
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [frameworkEnabled, setFrameworkEnabled] = useState(false), [frameworkStatus, setFrameworkStatus] = useState('Passive Framework collection is stopped.');
  const seen = useRef(new Map<string, string>());
  const latestOrders = useRef(orders); latestOrders.current = orders;
  useEffect(() => subscribeDatasetCapture(() => setCapture(datasetCaptureState())), []);
  useEffect(() => {
    let mounted = true;
    sigDatasetStore.stats().then(value => { if (mounted) { setStats(value); setError(''); } }).catch(() => { if (mounted) setError('Local dataset storage is unavailable. Samples are not acknowledged as saved.'); });
    return () => { mounted = false; };
  }, [capture.saved, capture.pending]);
  useEffect(() => {
    if (ready === false || !capture.enabled) return;
    for (const order of orders) {
      if (/^DEMO-/i.test(order.pon)) continue;
      const stamp = sourceStamp(order);
      if (seen.current.get(order.id) === stamp) continue;
      seen.current.set(order.id, stamp);
      void queueSigSample(orderDatasetInput(order, 'source_received'));
    }
  }, [orders, ready, capture.enabled]);
  useEffect(() => {
    if (!frameworkEnabled || !capture.enabled) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const sources = new Map<string, QueueOrder | null>();
    let last = '', lastError = '';
    async function tick() {
      try {
        const result = await readFrameworkSigSnapshot(controller.signal);
        if (stopped) return;
        if (!result.ok || !result.pon?.trim() || !result.sig?.trim()) {
          setFrameworkStatus(`Framework: ${result.code || 'No uniquely associated PON and SIG are readable'}. Choose the entry window once through Find E-Rx if selection is required.`);
        } else {
          const pon = result.pon.trim(), value = result.sig.trim(), identity = JSON.stringify([pon, value]);
          if (identity !== last) {
            const loaded = latestOrders.current.filter(order => order.pon.trim() === pon);
            let source = loaded.length === 1 ? loaded[0] : undefined;
            if (!source && loaded.length === 0) {
              if (!sources.has(pon)) {
                try { sources.set(pon, (await findDatasetSource(pon, controller.signal)) || null); }
                catch { sources.set(pon, null); lastError = 'Iguana source lookup unavailable; field observations are retained without an original/final pairing.'; }
                if (sources.size > 200) sources.delete(sources.keys().next().value!);
              }
              source = sources.get(pon) || undefined;
            }
            if (!stopped) {
              const input = source ? orderDatasetInput(source, 'framework_observed', { finalSig: value }) : {
                orderKey: `framework:${pon}`, revision: 1, drug: result.drug || '', rawSig: value, finalSig: value,
                stage: 'framework_observed' as const, captureKind: 'framework_sig_observation' as const, origin: 'framework' as const,
              };
              const saved = await queueSigSample(input);
              if (stopped) return;
              if (saved) last = identity;
              setFrameworkStatus(saved ? `Field observation saved locally${source ? ' with its exact incoming source' : '; original E-Rx prose was not available'}. This is not a verified save. ${lastError}` : 'Observation is pending local storage. Check dataset status.');
            }
          }
        }
      } catch (failure) { if (!stopped) setFrameworkStatus(failure instanceof Error ? failure.message : 'Passive SIG collection failed.'); }
      finally { if (!stopped) timer = setTimeout(() => void tick(), 5000); }
    }
    void tick();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [frameworkEnabled, capture.enabled]);
  async function exportBatch() {
    setBusy(true); setNotice('');
    try {
      const page = await sigDatasetStore.page(cursor, 1000);
      if (!page.records.length) { setNotice('No additional samples at this export position. Reset the export position to download earlier samples again.'); return; }
      const policies = Object.entries(page.policies || {}).map(([id, exclusions]) => ({ type: 'exclusion_policy', id, exclusions }));
      downloadDataset([{ type: 'sig_dataset_batch', schemaVersion: 1, appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, afterSeq: cursor, throughSeq: page.nextSeq }, ...policies, ...page.records], `sig-dataset-${cursor + 1}-${page.nextSeq}.jsonl`);
      setCursor(page.nextSeq);
      setNotice(`Download requested for ${page.records.length} samples. Check the saved file. ${page.hasMore ? 'More samples remain.' : 'Export is current.'} Dataset records are retained.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Dataset export failed.'); }
    finally { setBusy(false); }
  }
  return <details className="mx-4 my-2 rounded-lg border border-border bg-card p-3" aria-label="SIG dataset collection">
    <summary className="cursor-pointer text-sm font-medium">SIG dataset · {stats?.total ?? 0} local observations · {capture.enabled ? 'collecting' : 'paused'}{capture.pending ? ` · ${capture.pending} pending` : ''}</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p>Incoming sources and successful reviewed copies/transfers are collected locally. Confirm the actual final SIG after saving in Framework to label it as technician-confirmed. A copy, transfer, or observed field is not a verified prescription save.</p>
      <p>Source observations: {stats?.stages.source_received ?? 0} · reviewed copies: {stats?.stages.reviewed_copy ?? 0} · verified transfers: {stats?.stages.verified_transfer ?? 0} · technician-confirmed: {stats?.stages.technician_confirmed ?? 0} · Framework observations: {stats?.stages.framework_observed ?? 0}.</p>
      <p className="text-xs text-muted-foreground">Stored in this browser's IndexedDB, separately from the queue and reports. Clearing orders does not clear the dataset. Keep the same browser/address and export batches regularly. SIG text may contain sensitive information; nothing is uploaded automatically.</p>
      <div className="flex flex-wrap gap-2">
        <button className={reviewButtonClass} onClick={() => setDatasetCaptureEnabled(!capture.enabled)}>{capture.enabled ? 'Pause SIG collection' : 'Resume SIG collection'}</button>
        <button className={reviewButtonClass} disabled={busy} onClick={() => void exportBatch()}>Download next 1,000 samples</button>
        <button className={reviewButtonClass} disabled={busy || !cursor} onClick={() => { setCursor(0); setNotice('Export position reset. Existing dataset samples are unchanged.'); }}>Reset export position</button>
        <button className={reviewButtonClass} onClick={() => retryDatasetCapture()}>Retry pending dataset writes</button>
        {!!capture.pending && <button className={reviewButtonClass} onClick={() => downloadDataset(pendingDatasetExport(), 'sig-dataset-unsaved.jsonl')}>Download unsaved samples</button>}
        <button className={reviewButtonClass} disabled={!['http:', 'https:'].includes(location.protocol)} onClick={() => setFrameworkEnabled(value => !value)}>{frameworkEnabled ? 'Stop passive Framework SIG collection' : 'Start passive Framework SIG collection'}</button>
      </div>
      <p role="status">{frameworkStatus}</p>
      <p className="text-xs text-muted-foreground">Passive collection reads the remembered entry window without scrolling, clicking, or submitting anything. It can retain field edits observed between five-second checks; it cannot prove every processed order or detect a save from field presence alone.</p>
      {(error || capture.error) && <p role="alert" className="text-destructive">{capture.error || error} {capture.pending ? 'Keep this page open; retry or download unsaved samples before closing.' : ''}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}

export function SigDatasetConfirmation({ order, suggestion, generatedSig, parts = [], exclusions }: {
  order: QueueOrder; suggestion: string; generatedSig?: string; parts?: Array<{ id: string; label: string; sig: string }>;
  exclusions: import('../lib/reviewPolicy').SigExclusion[];
}) {
  const [part, setPart] = useState(parts[0]?.id ?? '');
  const initial = parts.find(p => p.id === part)?.sig ?? order.draft;
  const [finalSig, setFinalSig] = useState(initial), [comment, setComment] = useState('');
  const [edited, setEdited] = useState(false);
  const [acceptable, setAcceptable] = useState<boolean>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => { if (!edited) setFinalSig(initial); }, [initial, edited]);
  return <details className="rounded-lg border border-border p-3" aria-label="Completed E-Rx dataset sample">
    <summary className="cursor-pointer text-sm font-medium">Finished in Framework? Save the final SIG to the dataset</summary>
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground">Use after Framework has saved. Correct the text below if you changed it there. This records your confirmation; it does not submit or refuse an order.</p>
      {!!parts.length && <label className="block text-sm">Completed order part<select className={reviewInputClass} value={part} onChange={e => { setPart(e.target.value); setEdited(false); setFinalSig(parts.find(p => p.id === e.target.value)?.sig || ''); setNotice(''); }}>{parts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
      <label className="block text-sm">Actual final SIG in Framework<textarea className={reviewInputClass} value={finalSig} onChange={e => { setEdited(true); setFinalSig(e.target.value); }} /></label>
      <div className="flex items-center gap-2 text-sm">Was the suggestion acceptable?<button className={reviewButtonClass} aria-label="Suggestion acceptable: Yes" aria-pressed={acceptable === true} onClick={() => setAcceptable(true)}>Yes</button><button className={reviewButtonClass} aria-label="Suggestion acceptable: No" aria-pressed={acceptable === false} onClick={() => setAcceptable(false)}>No</button></div>
      <label className="block text-sm">Dataset comment (optional)<textarea className={reviewInputClass} value={comment} onChange={e => setComment(e.target.value)} /></label>
      <button className={reviewButtonClass} disabled={busy || !finalSig.trim()} onClick={async () => {
        setBusy(true);
        const saved = await queueSigSample(orderDatasetInput(order, 'technician_confirmed', { suggestion, generatedSig, finalSig: finalSig.trim(), partId: part || undefined, exclusions, comment: comment.trim() || undefined, acceptable }));
        setNotice(saved ? 'Technician-confirmed final SIG saved to the local dataset.' : 'Not durably saved. Check dataset collection status, retry, or download unsaved samples.'); setBusy(false);
      }}>Saved in Framework — record final SIG</button>
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}
