import { useEffect, useRef, useState } from 'react';
import { useReviewSession } from '../hooks/use-review-session';
import { sourceStamp, type QueueOrder } from '../lib/orderQueue';
import { sigDatasetStore } from '../lib/sigDataset';
import { datasetCaptureState, orderDatasetInput, pendingDatasetExport, queueSigSample, retryDatasetCapture, setDatasetCaptureEnabled, subscribeDatasetCapture } from '../lib/sigDatasetCapture';
import { reviewButtonClass, reviewInputClass } from './SigReviewPanel';
import { findDatasetSource, frameworkSnapshotStatus, readFrameworkSigSnapshot } from '../lib/frameworkSigDataset';

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
  const [cursorReady, setCursorReady] = useState(false), [exportError, setExportError] = useState('');
  const [frameworkEnabled, setFrameworkEnabled] = useState(false), [frameworkStatus, setFrameworkStatus] = useState('Passive Framework collection is stopped.');
  const seen = useRef(new Map<string, string>());
  const latestOrders = useRef(orders); latestOrders.current = orders;
  useEffect(() => subscribeDatasetCapture(() => setCapture(datasetCaptureState())), []);
  useEffect(() => {
    let mounted = true;
    sigDatasetStore.exportPosition().then(value => { if (mounted) { setCursor(value); setCursorReady(true); } })
      .catch(() => { if (mounted) setExportError('The saved export position could not be read. Reopen this page to retry; dataset samples are retained.'); });
    return () => { mounted = false; };
  }, []);
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
    const enrichment = new Map<string, Set<string>>();
    let enriching = false;
    let last = '', lastError = '';
    async function enrichSources() {
      if (enriching) return;
      enriching = true;
      try {
        for (const [pon, values] of enrichment) {
          if (stopped) break;
          let source: QueueOrder | undefined;
          try { source = await findDatasetSource(pon, controller.signal); }
          catch { lastError = 'Iguana source lookup unavailable; field observations remain saved without an original/final pairing.'; }
          if (stopped) break;
          const stillUnambiguous = (candidate: QueueOrder) => {
            const loaded = latestOrders.current.filter(order => order.pon.trim() === pon);
            return loaded.length === 0 || (loaded.length === 1 && sourceStamp(loaded[0]) === sourceStamp(candidate));
          };
          if (source && !stillUnambiguous(source)) { enrichment.delete(pon); continue; }
          sources.set(pon, source || null);
          if (sources.size > 200) sources.delete(sources.keys().next().value!);
          if (source) for (const value of values) {
            if (stopped || !stillUnambiguous(source)) break;
            await queueSigSample(orderDatasetInput(source, 'framework_observed', { finalSig: value }));
          }
          enrichment.delete(pon);
        }
      } finally { enriching = false; }
    }
    function enrichLater(pon: string, value: string) {
      if (sources.has(pon)) return;
      if (!enrichment.has(pon)) {
        if (enrichment.size >= 200) { lastError = 'Source enrichment is behind capture; unpaired observations are retained.'; return; }
        enrichment.set(pon, new Set());
      }
      enrichment.get(pon)!.add(value);
      void enrichSources();
    }
    async function tick() {
      try {
        const result = await readFrameworkSigSnapshot(controller.signal);
        if (stopped) return;
        if (!result.ok || !result.pon?.trim() || !result.sig?.trim()) {
          setFrameworkStatus(frameworkSnapshotStatus(result));
        } else {
          const pon = result.pon.trim(), value = result.sig.trim(), identity = JSON.stringify([pon, value]);
          if (identity !== last) {
            const loaded = latestOrders.current.filter(order => order.pon.trim() === pon);
            const source = loaded.length === 1 ? loaded[0] : loaded.length === 0 ? sources.get(pon) || undefined : undefined;
            if (!stopped) {
              const input = source ? orderDatasetInput(source, 'framework_observed', { finalSig: value }) : {
                orderKey: `framework:${pon}`, revision: 1, drug: result.drug || '', rawSig: value, finalSig: value,
                stage: 'framework_observed' as const, captureKind: 'framework_sig_observation' as const, origin: 'framework' as const,
              };
              const saved = await queueSigSample(input);
              if (stopped) return;
              if (saved) last = identity;
              setFrameworkStatus(saved ? `Field observation saved locally${source ? ' with its exact incoming source' : '; original E-Rx prose was not available'}. This is not a verified save. ${lastError}` : 'Observation is pending local storage. Check dataset status.');
              // Preserve the observation immediately. Slow Iguana enrichment
              // must not delay the next native read and miss the next E-Rx.
              if (saved && !source && loaded.length === 0) enrichLater(pon, value);
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
    setBusy(true); setNotice(''); setExportError('');
    try {
      const page = await sigDatasetStore.page(cursor, 1000);
      if (!page.records.length) { setNotice('No additional samples at this export position. Reset the export position to download earlier samples again.'); return; }
      const policies = Object.entries(page.policies || {}).map(([id, exclusions]) => ({ type: 'exclusion_policy', id, exclusions }));
      downloadDataset([{ type: 'sig_dataset_batch', schemaVersion: 1, appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, afterSeq: cursor, throughSeq: page.nextSeq }, ...policies, ...page.records], `sig-dataset-${cursor + 1}-${page.nextSeq}.jsonl`);
      await sigDatasetStore.setExportPosition(page.nextSeq);
      setCursor(page.nextSeq);
      setNotice(`Download requested for ${page.records.length} samples. Check the saved file. ${page.hasMore ? 'More samples remain.' : 'Export is current.'} Dataset records are retained.`);
    } catch (failure) { setExportError(`Export did not finish: ${failure instanceof Error ? failure.message : 'Dataset export failed.'} The position was not advanced; retry may download the same batch again.`); }
    finally { setBusy(false); }
  }
  async function resetExport() {
    setBusy(true); setExportError('');
    try {
      await sigDatasetStore.setExportPosition(0);
      setCursor(0); setNotice('Export position reset. Existing dataset samples are unchanged.');
    } catch { setExportError('Export position could not be reset. Dataset samples and the prior export position are retained.'); }
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
        <button className={reviewButtonClass} disabled={busy || !cursorReady} onClick={() => void exportBatch()}>Download next 1,000 samples</button>
        <button className={reviewButtonClass} disabled={busy || !cursorReady || !cursor} onClick={() => void resetExport()}>Reset export position</button>
        <button className={reviewButtonClass} onClick={() => retryDatasetCapture()}>Retry pending dataset writes</button>
        {!!capture.pending && <button className={reviewButtonClass} onClick={() => downloadDataset(pendingDatasetExport(), 'sig-dataset-unsaved.jsonl')}>Download unsaved samples</button>}
        <button className={reviewButtonClass} disabled={!['http:', 'https:'].includes(location.protocol)} onClick={() => setFrameworkEnabled(value => !value)}>{frameworkEnabled ? 'Stop passive Framework SIG collection' : 'Start passive Framework SIG collection'}</button>
      </div>
      <p className="text-xs text-muted-foreground">Export position: {cursorReady ? cursor : 'loading'}. This position is saved between sessions; samples are retained.</p>
      <p role="status">{frameworkStatus}</p>
      <p className="text-xs text-muted-foreground">Passive collection reads the remembered entry window without scrolling, clicking, or submitting anything. It can retain field edits observed between five-second checks; it cannot prove every processed order or detect a save from field presence alone.</p>
      {(error || capture.error) && <p role="alert" className="text-destructive">{capture.error || error} {capture.pending ? 'Keep this page open; retry or download unsaved samples before closing.' : ''}</p>}
      {exportError && <p role="alert" className="text-destructive">{exportError}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}

export function SigDatasetConfirmation({ order, suggestion, generatedSig, parts = [], exclusions, warnings }: {
  order: QueueOrder; suggestion: string; generatedSig?: string; parts?: Array<{ id: string; label: string; sig: string; suggestion?: string }>;
  exclusions: import('../lib/reviewPolicy').SigExclusion[];
  warnings?: string[];
}) {
  const [part, setPart] = useState(parts[0]?.id ?? '');
  const selectedPart = parts.find(p => p.id === part) ?? parts[0];
  const partId = selectedPart?.id;
  const key = partId ?? '';
  const [responses, setResponses] = useState<Record<string, { finalSig?: string; comment?: string; acceptable?: boolean }>>({});
  const response = responses[key];
  const finalSig = response?.finalSig ?? selectedPart?.sig ?? order.draft;
  const comment = response?.comment ?? '', acceptable = response?.acceptable;
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const update = (patch: { finalSig?: string; comment?: string; acceptable?: boolean }) => {
    setResponses(previous => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  };
  return <details className="rounded-lg border border-border p-3" aria-label="Completed E-Rx dataset sample">
    <summary className="cursor-pointer text-sm font-medium">Finished in Framework? Save the final SIG to the dataset</summary>
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground">Use after Framework has saved. Correct the text below if you changed it there. This records your confirmation; it does not submit or refuse an order.</p>
      {!!parts.length && <label className="block text-sm">Completed order part<select className={reviewInputClass} value={partId} disabled={busy} onChange={e => { setPart(e.target.value); setNotice(''); }}>{parts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
      <label className="block text-sm">Actual final SIG in Framework<textarea className={reviewInputClass} value={finalSig} onChange={e => update({ finalSig: e.target.value })} /></label>
      <div className="flex items-center gap-2 text-sm">Was the suggestion acceptable?<button className={reviewButtonClass} aria-label="Suggestion acceptable: Yes" aria-pressed={acceptable === true} onClick={() => update({ acceptable: true })}>Yes</button><button className={reviewButtonClass} aria-label="Suggestion acceptable: No" aria-pressed={acceptable === false} onClick={() => update({ acceptable: false })}>No</button></div>
      <label className="block text-sm">Dataset comment (optional)<textarea className={reviewInputClass} value={comment} onChange={e => update({ comment: e.target.value })} /></label>
      <button className={reviewButtonClass} disabled={busy || !finalSig.trim()} onClick={async () => {
        setBusy(true);
        const saved = await queueSigSample(orderDatasetInput(order, 'technician_confirmed', { suggestion: selectedPart ? selectedPart.suggestion : suggestion, generatedSig, finalSig: finalSig.trim(), partId, exclusions, warnings, comment: comment.trim() || undefined, acceptable }));
        setNotice(saved ? 'Technician-confirmed final SIG saved to the local dataset.' : 'Not durably saved. Check dataset collection status, retry, or download unsaved samples.'); setBusy(false);
      }}>Saved in Framework — record final SIG</button>
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>;
}
