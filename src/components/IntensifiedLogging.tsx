// TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH — remove/reduce after investigation.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { IntensifiedRecorder, downloadJournalBlob, INTENSIFIED_REMOVAL_MARKER } from '../lib/diagnostics/intensifiedLogging';
import { frameworkDesktop } from '../lib/frameworkDesktop';

export function IntensifiedLogging({ screen }: { screen: string }) {
  const [recorder] = useState(() => new IntensifiedRecorder());
  const state = useSyncExternalStore(recorder.subscribe, recorder.getState, recorder.getState);
  const [expanded, setExpanded] = useState(false);
  const [observe, setObserve] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkpoint, setCheckpoint] = useState('order-opened');
  useEffect(() => { void recorder.connect(); return () => recorder.dispose(); }, [recorder]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setNotice('');
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Pilot logging operation failed.'); }
    finally { setBusy(false); }
  }
  async function exportJournal() {
    const status = await recorder.saveBundle();
    setNotice(`Review bundle saved inside the recording folder: ${status.bundleFile}. Check the pending-event count before sharing.`);
  }
  const active = state.status.active;
  const warning = state.status.fileError || state.status.limitReached || state.outboxError || !!state.error || state.droppedWorkflow > 0 || state.droppedTranslation > 0 || (state.status.droppedWorkflow || 0) > 0 || (state.status.droppedTranslation || 0) > 0;
  const button = 'rounded border border-amber-600/50 px-2 py-1 text-xs disabled:opacity-50';
  return <section aria-label="Temporary intensified logging" className={`border-b px-4 py-2 text-xs ${warning ? 'bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <strong>TEMPORARY INTENSIFIED LOGGING · {active ? 'RECORDING' : 'OFF'}</strong>
      <span>REMOVAL PRIORITY: HIGH — remove or reduce after investigation.</span>
      <button type="button" className="underline" aria-expanded={expanded || active} onClick={() => setExpanded(!expanded)}>{expanded || active ? 'Recording controls' : 'Open recording controls'}</button>
    </div>
    {(expanded || active) && <div className="space-y-2 pt-2">
      <p>Local files only. Captures workflow, translation metadata, failures and optional passive Framework snapshots. Screenshots, keystrokes and exact patient/order text are excluded. Use Feedback for optional explanations.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex gap-1 items-center"><input type="checkbox" checked={observe} disabled={active || busy} onChange={e => setObserve(e.target.checked)} />Observe selected Framework window</label>
        <button type="button" className={button} disabled={busy || active || !state.available || !state.status.configured} onClick={() => void perform(() => recorder.start(observe, screen))}>Start pilot recording</button>
        <button type="button" className={button} disabled={busy || !active} onClick={() => void perform(() => recorder.stop())}>Stop and save recording</button>
        <button type="button" className={button} disabled={busy || !state.status.sessionId} onClick={() => void perform(exportJournal)}>Save review bundle in recording folder</button>
        <button type="button" className={button} disabled={busy} onClick={() => void perform(() => recorder.connect())}>Check connector</button>
        <button type="button" className={button} disabled={busy || !state.available} onClick={() => void perform(async () => {
          setNotice('Click inside the intended Framework entry window within 8 seconds.');
          const result = await frameworkDesktop('detect', { chooseWindow: true });
          if (!result.ok) throw new Error('Framework window selection failed. Use Find E-Rx detection help.');
          setNotice('Framework entry window selected. Passive observation will use that window.');
        })}>Choose observation window</button>
      </div>
      {active && <div className="flex flex-wrap gap-2 items-center">
        <label>Checkpoint <select aria-label="Recording checkpoint" className="bg-background border rounded px-1 text-foreground" value={checkpoint} onChange={e => setCheckpoint(e.target.value)}>
          <option value="order-opened">Order opened</option><option value="product-selected">Product selected</option><option value="sig-reviewed">SIG reviewed</option><option value="fields-ready">Fields ready</option><option value="saved">Saved</option><option value="abandoned">Abandoned</option><option value="problem-observed">Problem observed</option>
        </select></label>
        <button type="button" className={button} disabled={busy} onClick={() => void perform(() => recorder.checkpoint(checkpoint))}>Mark checkpoint</button>
        <span>A checkpoint records your observation; it does not save or submit an order.</span>
      </div>}
      <p role="status">Saved: {state.status.workflowEvents || 0} workflow · {state.status.translationEvents || 0} translation · {state.pending} browser events pending. {state.lastSavedAt && `Last browser save ${new Date(state.lastSavedAt).toLocaleTimeString()}.`}</p>
      {state.status.directory && <p className="break-all">Recording folder: {state.status.directory}</p>}
      {state.status.stopReason && <p>Recording stopped: {state.status.stopReason}.</p>}
      {state.available && !state.status.configured && <p>Recording destination is not configured. Use the workstation update containing your recording-folder configuration.</p>}
      {state.status.maxDurationMs && <p>Limits: {state.status.maxDurationMs / 3600000} hours per recording; {Math.round((state.status.maxStreamBytes || 0) / 1048576)} MB per stream. Existing recordings stay until you delete them.</p>}
      {state.status.desktopCode && <p>Framework observer: {state.status.desktopCode}{state.status.desktopPartial ? ' · partial snapshot' : ''}. {state.status.desktopCode === 'SELECTION_REQUIRED' && 'Choose an observation window or use Detect open E-Rx.'}{state.status.desktopCode === 'WINDOW_UNAVAILABLE' && 'Restore the selected window or choose it again.'}</p>}
      {(warning || notice) && <div role="alert" className="space-y-1">
        {notice && <p>{notice}</p>}{state.error && <p>{state.error}</p>}
        {state.outboxError && <p>Pending-event browser backup is unavailable. Keep this page open until its events are saved, or download pending events.</p>}
        {state.status.fileError && <p>FILE WRITE FAILED. Recording stopped; inspect the destination before restarting.</p>}
        {state.status.limitReached && <p>CAPTURE LIMIT REACHED. Some events were not saved. Start a new recording to continue.</p>}
        {(state.droppedWorkflow > 0 || state.droppedTranslation > 0 || state.status.droppedWorkflow || state.status.droppedTranslation) ? <p>Dropped events: browser workflow {state.droppedWorkflow}, browser translation {state.droppedTranslation}, file workflow {state.status.droppedWorkflow || 0}, file translation {state.status.droppedTranslation || 0}.</p> : null}
      </div>}
      {state.pending > 0 && <div><button type="button" className={button} onClick={() => downloadJournalBlob(new Blob([JSON.stringify(recorder.pendingExport(), null, 2)], { type: 'application/json' }), 'sig-assist-unsaved-browser-events.json')}>Download pending browser events</button><span> Emergency download uses your browser's save location; choose the recording folder.</span></div>}
      <code className="block break-all text-[10px]">{INTENSIFIED_REMOVAL_MARKER}</code>
    </div>}
  </section>;
}
