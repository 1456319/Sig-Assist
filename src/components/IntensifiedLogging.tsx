// TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH — remove/reduce after investigation.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { IntensifiedRecorder, downloadJournalBlob, INTENSIFIED_REMOVAL_MARKER } from '../lib/diagnostics/intensifiedLogging';
import { frameworkDesktop } from '../lib/frameworkDesktop';
import { workflowObservationState, subscribeWorkflowObservation } from '../lib/workflowObservation';

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
  async function chooseWindow() {
    setNotice('Click inside the intended Framework entry window within 8 seconds.');
    const result = await frameworkDesktop('detect', { chooseWindow: true });
    if (!result.ok) throw new Error('Framework window selection failed. Recording remains active; choose the observation window to retry.');
    setNotice('Framework window selected. Continue processing normally; checkpoints are optional.');
  }
  async function start() {
    const status = await recorder.start(observe, screen);
    if (observe && status.selectionRequired) await chooseWindow();
  }
  const observation = useSyncExternalStore(subscribeWorkflowObservation, workflowObservationState);
  const active = state.status.active;
  const browserDroppedWorkflow = Math.max(state.droppedWorkflow, state.status.browserDroppedWorkflow || 0);
  const browserDroppedTranslation = Math.max(state.droppedTranslation, state.status.browserDroppedTranslation || 0);
  const warning = state.status.fileError || state.status.limitReached || state.outboxError || !!state.error || browserDroppedWorkflow > 0 || browserDroppedTranslation > 0 || (state.status.droppedWorkflow || 0) > 0 || (state.status.droppedTranslation || 0) > 0;
  const button = 'rounded border border-amber-600/50 px-2 py-1 text-xs disabled:opacity-50';
  return <section aria-label="Temporary intensified logging" className={`border-b px-4 py-2 text-xs ${warning ? 'bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <strong>TEMPORARY INTENSIFIED LOGGING · {active ? state.error ? 'CHECK CONNECTION · BUFFERING' : 'RECORDING' : 'OFF'}</strong>
      <span>REMOVAL PRIORITY: HIGH — remove or reduce after investigation.</span>
      <button type="button" className="underline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide recording controls' : 'Open recording controls'}</button>
    </div>
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <button type="button" className={button} disabled={busy || active || !state.available || !state.status.configured} onClick={() => void perform(start)}>Start automatic recording</button>
      <button type="button" className={button} disabled={busy || !active} onClick={() => void perform(() => recorder.stop())}>Stop and save recording</button>
      <span>Process prescriptions normally. No per-order checkpoints required.</span>
    </div>
    {active && <p role="status">Automatic observer: {state.status.desktopCode || observation.status}. Saved observations: {state.status.observationEvents || 0}. {observation.eventSource.replace(/_/g, ' ')}.</p>}
    <p>Recording stores clinical SIG text, PONs and readable order fields locally in the recording folder. No automatic upload, screenshots or keystroke capture.</p>
    {active && state.status.desktopCode === 'SELECTION_REQUIRED' && <button type="button" className={button} disabled={busy} onClick={() => void perform(chooseWindow)}>Choose observation window</button>}
    {(warning || notice || observation.error) && <p role="alert">{notice || state.error || observation.error || 'Recording needs attention. Open recording controls for details.'}</p>}
    {expanded && <div className="space-y-2 pt-2">
      <p>Advanced diagnostics and optional manual markers. Readable incoming, linked, default and draft SIGs retain separate labels. A button invocation or field observation does not prove a prescription was saved. Use Feedback for optional explanations.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex gap-1 items-center"><input type="checkbox" checked={observe} disabled={active || busy} onChange={e => setObserve(e.target.checked)} />Observe selected Framework window</label>
        <button type="button" className={button} disabled={busy || !state.status.sessionId} onClick={() => void perform(exportJournal)}>Save review bundle in recording folder</button>
        <button type="button" className={button} disabled={busy} onClick={() => void perform(() => recorder.connect())}>Check connector</button>
        <button type="button" className={button} disabled={busy || !state.available} onClick={() => void perform(chooseWindow)}>Choose observation window</button>
      </div>
      {active && <div className="flex flex-wrap gap-2 items-center">
        <label>Optional manual checkpoint <select aria-label="Recording checkpoint" className="bg-background border rounded px-1 text-foreground" value={checkpoint} onChange={e => setCheckpoint(e.target.value)}>
          <option value="order-opened">Order opened</option><option value="product-selected">Product selected</option><option value="sig-reviewed">SIG reviewed</option><option value="fields-ready">Fields ready</option><option value="saved">Saved</option><option value="abandoned">Abandoned</option><option value="problem-observed">Problem observed</option>
        </select></label>
        <button type="button" className={button} disabled={busy} onClick={() => void perform(() => recorder.checkpoint(checkpoint))}>Mark checkpoint</button>
        <span>Mark AFTER the action finishes and the screen settles. Use Saved only after Framework finishes saving. Checkpoints are optional observations; they do not submit an order.</span>
      </div>}
      <p role="status">Saved: {state.status.workflowEvents || 0} workflow · {state.status.translationEvents || 0} translation · {state.pending} browser events pending. {state.lastSavedAt && `Last browser save ${new Date(state.lastSavedAt).toLocaleTimeString()}.`}</p>
      {state.status.directory && <p className="break-all">Recording folder: {state.status.directory}</p>}
      {state.status.stopReason && <p>Recording stopped: {state.status.stopReason}.</p>}
      {state.available && !state.status.configured && <p>Recording destination is not configured. Use the workstation update containing your recording-folder configuration.</p>}
      {state.status.maxDurationMs && <p>Limits: {state.status.maxDurationMs / 3600000} hours per recording; {Math.round((state.status.maxStreamBytes || 0) / 1048576)} MB per stream. Existing recordings stay until you delete them.</p>}
      {state.status.desktopCode && <p>Framework observer: {state.status.desktopCode}{state.status.desktopPartial ? ' · partial snapshot' : ''}. {state.status.desktopCode === 'SELECTION_REQUIRED' && 'Choose an observation window or use Detect open E-Rx.'}{state.status.desktopCode === 'WINDOW_UNAVAILABLE' && 'Restore the selected window or choose it again.'}</p>}
      {(warning || notice) && <div role="alert" className="space-y-1">
        
        {state.outboxError && <p>Pending-event browser backup is unavailable. Keep this page open until its events are saved, or download pending events.</p>}
        {state.status.fileError && <p>FILE WRITE FAILED{state.status.fileErrorCode ? ` (${state.status.fileErrorCode})` : ''}. Recording stopped; inspect the destination before restarting.</p>}
        {state.status.limitReached && <p>CAPTURE LIMIT REACHED. Some events were not saved. Start a new recording to continue.</p>}
        {(browserDroppedWorkflow > 0 || browserDroppedTranslation > 0 || state.status.droppedWorkflow || state.status.droppedTranslation) ? <p>Dropped events: browser workflow {browserDroppedWorkflow}, browser translation {browserDroppedTranslation}, file workflow {state.status.droppedWorkflow || 0}, file translation {state.status.droppedTranslation || 0}.</p> : null}
      </div>}
      {state.pending > 0 && <div><button type="button" className={button} onClick={() => downloadJournalBlob(new Blob([JSON.stringify(recorder.pendingExport(), null, 2)], { type: 'application/json' }), 'sig-assist-unsaved-browser-events.json')}>Download pending browser events</button><span> Emergency download uses your browser's save location; choose the recording folder.</span></div>}
      <code className="block break-all text-[10px]">{INTENSIFIED_REMOVAL_MARKER}</code>
    </div>}
  </section>;
}
