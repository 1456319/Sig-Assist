// TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH
// Remove/reduce after the E-Rx investigation. Opt-in, local files, no raw PHI.
import { mkdir, open, writeFile, stat, access } from 'node:fs/promises';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';

export const REMOVAL_PRIORITY = 'TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH';
export const CONTROL_IDS = new Set(('ERxQueueButton ERxGrid ERxPatientOrderGrid FolderGridControl DirectionsView paneRichEdit RxEntryViewControl RxEntryPrescription_QtyEdit RxEntryPrescription_DaysSupplyEdit RxEntryPrescription_ProfileOnly ProductSelectionView CompoundAutoSuggestEdit RxBatch MoveRxBatchUserControl PatientViewControl chkPatientProfileReviewed WorkQueueView PART_Editor PART_OkButton PART_YesButton PART_NoButton PART_Item PART_GridControl PART_Content PART_DockLayoutManager Name Value Display Title CloseButton CancelButton OrderSigTextBox LinkedSigTextBox ERxWorkQueueWizardView ERxWorkQueueDirectionsView PrescriptionTabDirectionsView ERxWorkQueueView RxEntryView ERxTriageManagerView PatientOrdersView FrameworkEcmPopup').split(' '));
const labels = new Set("sig|prescription sig|sig code|order sig|linked sig|directions|structured sig|preview sig|quantity|qty|days supply|days' supply|times/day|times per day|administration times|admin times|start date|delivery date|dispensed date|dispense date|effective date|expire date|status date|package type|profile only|cycle fill|unit dose|partial tablet|delivery id|rx batch|batch|product|drug|drug name|patient|patient id|facility|facility id|patient profile reviewed|allergies|no known allergies|allergy/adverse event information|refills|next|back|finish|cancel|ok|yes|no|save|continue saving|select compound/iv|search|accept|close|pon|prescriber order number".split('|'));
const codes = new Set(('screen.open customization.count dictionary.save connector.request connector.response connector.failed desktop.response feedback.save discrepancy.save browser.click browser.change browser.error browser.visibility browser.lifecycle browser.overflow checkpoint trace').split(' '));
const enums = {
  outcome: ['ok', 'failed', 'unavailable', 'unknown', 'changed', 'file_system', 'browser_cache', 'browser_database'],
  screen: ['queue', 'workbench', 'dictionary', 'rules', 'expansions', 'settings'],
  operation: ['detect', 'inspect', 'target', 'send', 'docutrack', 'observe'],
  metric: ['dictionary', 'rules', 'expansions'],
  layer: ['intake', 'clinical', 'packaging', 'assembly', 'storage', 'ui'],
  level: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
  component: ['clinicalEngine', 'doseCalculator', 'frequencyEngine', 'paxitEngine', 'OrderQueueView', 'WorkbenchView', 'citrixStorage', 'sigDictionaryService', 'other'],
  checkpoint: ['order-opened', 'product-selected', 'sig-reviewed', 'fields-ready', 'saved', 'abandoned', 'problem-observed'],
  tag: ['button', 'input', 'select', 'textarea', 'a', 'other'],
  inputType: ['text', 'number', 'checkbox', 'radio', 'date', 'datetime-local', 'search', 'button', 'submit', 'other'],
  state: ['visible', 'hidden', 'pagehide', 'pageshow'],
  reason: ['AUTOMATIC_AUTH_UNAVAILABLE', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'TIMEOUT_OR_STOPPED', 'INVALID_LOG_EXPORT', 'IGUANA_HTTP_401', 'IGUANA_HTTP_403', 'BRIDGE_UNREACHABLE', 'UNCLASSIFIED'],
};
const numbers = new Set(('durationMs count beforeCount afterCount httpStatus port headers unreadable messageLength valueLength rawProseLength primarySigLength drugNameLength abnormalitiesCount splitPartsCount droppedWorkflow droppedTranslation recovered pendingCount nodeCount visitedCount errors elapsedMs limit rowCount columnCount').split(' '));
const booleans = new Set(('uncertain verified checked isControlled isPaxitSolid requiresSplit hasPackagingNotice isApap hidden disabled writable hasFilter').split(' '));
const version = x => typeof x === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(x) ? x : 'unknown';
const fileCodes = ['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EIO', 'EROFS', 'ETIMEDOUT', 'ECONNRESET', 'ENOTCONN', 'EBUSY', 'DESTINATION_UNAVAILABLE'];
const token = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x) ? x : undefined;
export function safeFields(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const out = {};
  for (const [k, values] of Object.entries(enums)) if (values.includes(raw[k])) out[k] = raw[k];
  for (const k of numbers) if (Number.isFinite(raw[k]) && raw[k] >= 0) out[k] = Math.min(1e12, Math.round(raw[k]));
  for (const k of booleans) if (typeof raw[k] === 'boolean') out[k] = raw[k];
  if (typeof raw.traceRef === 'string' && /^trace-[0-9]{1,8}$/.test(raw.traceRef)) out.traceRef = raw.traceRef;
  return out;
}
export function safeBrowserEvent(raw) {
  if (!raw || !codes.has(raw.code)) return null;
  const event = { code: raw.code, fields: safeFields(raw.fields) };
  if (token(raw.clientRef)) event.clientRef = raw.clientRef;
  if (typeof raw.at === 'string' && Number.isFinite(Date.parse(raw.at))) event.clientAt = new Date(raw.at).toISOString();
  if (Number.isFinite(raw.elapsedMs) && raw.elapsedMs >= 0) event.clientElapsedMs = Math.round(raw.elapsedMs);
  if (Number.isFinite(raw.timezoneOffset) && Math.abs(raw.timezoneOffset) <= 900) event.timezoneOffset = Math.round(raw.timezoneOffset);
  return event;
}
export function safeDesktop(raw) {
  const reason = ['SELECTION_REQUIRED', 'WINDOW_UNAVAILABLE', 'OBSERVATION_FAILED', 'BUSY', 'OK'].includes(raw?.code) ? raw.code : 'OBSERVATION_FAILED';
  const result = { code: reason, ok: raw?.ok === true, partial: raw?.partial === true, ...safeFields(raw), controls: [] };
  if (typeof raw?.observedAt === 'string' && Number.isFinite(Date.parse(raw.observedAt))) result.observedAt = new Date(raw.observedAt).toISOString();
  for (const c of Array.isArray(raw?.controls) ? raw.controls.slice(0, 800) : []) {
    if (!token(c.token)) continue;
    const item = { token: c.token };
    if (token(c.parent)) item.parent = c.parent;
    for (const k of ['idToken', 'classToken', 'nameToken', 'valueToken']) if (token(c[k])) item[k] = c[k];
    if (CONTROL_IDS.has(c.automationId)) item.automationId = c.automationId;
    if (CONTROL_IDS.has(c.view)) item.view = c.view;
    if (labels.has(c.label)) item.label = c.label;
    for (const k of ['x', 'y', 'width', 'height']) if (Number.isFinite(c[k]) && Math.abs(c[k]) < 100000 && (['x', 'y'].includes(k) || c[k] >= 0)) item[k] = Math.round(c[k]);
    if (Array.isArray(c.patterns)) item.patterns = c.patterns.filter(p => Number.isInteger(p) && p >= 10000 && p < 10100).slice(0, 30);
    if (typeof c.type === 'string' && /^ControlType\.(Button|Calendar|CheckBox|ComboBox|Edit|Hyperlink|Image|ListItem|List|Menu|MenuBar|MenuItem|ProgressBar|RadioButton|ScrollBar|Slider|Spinner|StatusBar|Tab|TabItem|Text|ToolBar|ToolTip|Tree|TreeItem|Custom|Group|Thumb|DataGrid|DataItem|Document|SplitButton|Window|Pane|Header|HeaderItem|Table|TitleBar|Separator)$/.test(c.type)) item.type = c.type;
    if (['known-view', 'winforms', 'wpf', 'other'].includes(c.family)) item.family = c.family;
    for (const k of ['enabled', 'offscreen', 'focused', 'writable', 'selected', 'hasValue', 'valueReadable']) if (typeof c[k] === 'boolean') item[k] = c[k];
    for (const k of ['depth', 'valueLength', 'nameLength', 'toggle', 'rows', 'columns', 'patternCount']) if (Number.isFinite(c[k]) && c[k] >= 0) item[k] = Math.min(1e9, Math.round(c[k]));
    result.controls.push(item);
  }
  return result;
}

export function createPilotJournal({ baseDir, baseDirs = baseDir ? [baseDir] : [], maxStreamBytes = 64 * 1024 * 1024, rotateBytes = 2 * 1024 * 1024, maxDurationMs = 8 * 60 * 60 * 1000, now = Date.now, monotonic = () => performance.now(), sync = true } = {}) {
  let session, chain = Promise.resolve(), key, previous = new Map(), fileErrorCode; const unsynced = new Set();
  const serialize = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  const status = () => session ? { ok: true, marker: REMOVAL_PRIORITY, configured: baseDirs.length > 0, ...Object.fromEntries(Object.entries(session).filter(([k]) => !['streams', 'batches', 'files', 'startedTick', 'browserDrops'].includes(k))), ...(fileErrorCode ? { fileErrorCode } : {}), maxStreamBytes, maxDurationMs } : { ok: true, marker: REMOVAL_PRIORITY, active: false, configured: baseDirs.length > 0, ...(fileErrorCode ? { fileError: true, fileErrorCode } : {}) };
  const pseudonym = value => key && typeof value === 'string' && value ? createHmac('sha256', key).update(value).digest('hex').slice(0, 32) : undefined;
  async function manifest() {
    await writeFile(path.join(session.directory, 'manifest.json'), JSON.stringify({ ...status(), directory: undefined, files: session.files }, null, 2), { mode: 0o600 });
  }
  async function append(stream, code, fields, flush = true) {
    if (!session?.active) { if (session) session[stream === 'workflow' ? 'droppedWorkflow' : 'droppedTranslation']++; return false; }
    const elapsedMs = Math.max(0, Math.round(monotonic() - session.startedTick));
    if (elapsedMs > maxDurationMs) { session.active = false; session.stopReason = 'DURATION_LIMIT'; session.limitReached = true; session[stream === 'workflow' ? 'droppedWorkflow' : 'droppedTranslation']++; await manifest(); return false; }
    const state = session.streams[stream];
    const record = { marker: REMOVAL_PRIORITY, sessionId: session.sessionId, seq: ++session.seq, at: new Date(now()).toISOString(), elapsedMs, timezoneOffset: new Date(now()).getTimezoneOffset(), stream, code, ...fields };
    const bytes = Buffer.from(JSON.stringify(record) + '\n');
    if (bytes.length > 1024 * 1024 || state.bytes + bytes.length > maxStreamBytes) { session[stream === 'workflow' ? 'droppedWorkflow' : 'droppedTranslation']++; session.limitReached = true; return false; }
    if (state.partBytes && state.partBytes + bytes.length > rotateBytes) { state.part++; state.partBytes = 0; }
    const name = `${stream}-${String(state.part).padStart(4, '0')}.jsonl`;
    const handle = await open(path.join(session.directory, name), 'a', 0o600);
    try { await handle.writeFile(bytes); if (sync && flush) await handle.sync(); else if (sync) unsynced.add(path.join(session.directory, name)); } finally { await handle.close(); }
    if (!session.files.includes(name)) session.files.push(name);
    state.bytes += bytes.length; state.partBytes += bytes.length; session[stream === 'workflow' ? 'workflowEvents' : 'translationEvents']++;
    return true;
  }
  async function guarded(fn) {
    try { return await fn(); }
    catch (error) {
      if (typeof error?.code !== 'string') throw new Error('Invalid or unavailable pilot logging operation. Existing files were preserved.');
      fileErrorCode = fileCodes.includes(error.code) ? error.code : 'FILE_IO_ERROR';
      if (session) { session.active = false; session.stopReason = 'FILE_WRITE_FAILED'; session.fileError = true; }
      throw new Error('Pilot journal could not write its local files. Existing files were preserved.');
    }
  }
  return {
    status, pseudonym, observationKey: () => key?.toString('hex'),
    start: body => serialize(() => guarded(async () => {
      if (session?.active) return status();
      const sessionId = randomUUID(); const startedMs = now();
      if (!baseDirs.length) throw new Error('No recording destination configured.');
      const name = `${new Date(startedMs).toISOString().replace(/[:.]/g, '-')}-${sessionId}`;
      let directory;
      for (const root of baseDirs) {
        // An unavailable UNC/mapped root never redirects recording to AppData or TEMP.
        // Probe only existing roots; create only this session's child directory.
        try {
          let timer; try { await Promise.race([access(root), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Root unavailable')), 6000); })]); } finally { clearTimeout(timer); }
          const candidate = path.join(root, name); await mkdir(candidate, { mode: 0o700 }); directory = candidate; break;
        } catch { /* Try only the explicitly configured alternative root. */ }
      }
      if (!directory) throw Object.assign(new Error('Configured recording destinations are unavailable.'), { code: 'DESTINATION_UNAVAILABLE' });
      key = randomBytes(32); previous = new Map(); unsynced.clear(); fileErrorCode = undefined;
      session = { sessionId, directory, active: true, startedMs, startedTick: monotonic(), startedAt: new Date(startedMs).toISOString(), appVersion: version(body?.appVersion), observeDesktop: body?.observeDesktop !== false, seq: 0, workflowEvents: 0, translationEvents: 0, droppedWorkflow: 0, droppedTranslation: 0, browserDroppedWorkflow: 0, browserDroppedTranslation: 0, browserDrops: new Map(), limitReached: false, fileError: false, batches: new Set(), files: [], streams: { workflow: { bytes: 0, part: 1, partBytes: 0 }, translation: { bytes: 0, part: 1, partBytes: 0 } } };
      for (const field of ['appBuildId', 'bridgeBuildId', 'desktopBuildId']) if (/^[a-f0-9]{64}$/.test(body?.[field] || '')) session[field] = body[field];
      await append('workflow', 'session.start', { appVersion: session.appVersion, nodeVersion: process.version, platform: process.platform, arch: process.arch, observeDesktop: session.observeDesktop }); await manifest(); return status();
    })),
    record: (code, fields = {}) => serialize(() => guarded(async () => {
      if (!session?.active) return;
      if (!['connector.begin', 'connector.end', 'connector.failed', 'desktop.begin', 'desktop.end', 'desktop.failed', 'checkpoint', 'recorder.heartbeat'].includes(code)) return;
      await append('workflow', code, { fields: safeFields(fields), ...(token(fields.orderRef) ? { orderRef: fields.orderRef } : {}) });
    })),
    ingest: body => serialize(() => guarded(async () => {
      if (!session || body?.sessionId !== session.sessionId) throw new Error('Pilot session changed. Refresh recording status.');
      if (typeof body.batchId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.batchId) || !Array.isArray(body.events) || body.events.length > 250) throw new Error('Invalid pilot event batch.');
      if (session.batches.has(body.batchId)) return { ...status(), duplicate: true };
      if (!session.active) throw new Error('Pilot recording stopped. Pending events were not saved to this session.');
      for (const event of body.events.map(safeBrowserEvent).filter(Boolean)) {
        await append(event.code === 'trace' ? 'translation' : 'workflow', 'browser.' + event.code, event, false);
        if (event.code === 'browser.overflow') {
          const ref = event.clientRef || 'legacy'; const previous = session.browserDrops.get(ref) || { workflow: 0, translation: 0 };
          session.browserDrops.set(ref, { workflow: Math.max(previous.workflow, event.fields.droppedWorkflow || 0), translation: Math.max(previous.translation, event.fields.droppedTranslation || 0) });
          session.browserDroppedWorkflow = [...session.browserDrops.values()].reduce((sum, item) => sum + item.workflow, 0);
          session.browserDroppedTranslation = [...session.browserDrops.values()].reduce((sum, item) => sum + item.translation, 0);
        }
      }
      for (const filename of unsynced) { const handle = await open(filename, 'r+'); try { await handle.sync(); } finally { await handle.close(); } }
      unsynced.clear();
      session.batches.add(body.batchId);
      // A session is bounded; reject further clients visibly rather than evict retry IDs.
      if (session.batches.size >= 100000) { session.active = false; session.stopReason = 'BATCH_LIMIT'; }
      await manifest(); return status();
    })),
    desktop: (raw, expectedSessionId) => serialize(() => guarded(async () => {
      if (!session?.active || expectedSessionId && session.sessionId !== expectedSessionId) return;
      const snapshot = safeDesktop(raw); const next = new Map(snapshot.controls.map(c => [c.token, c]));
      const changed = snapshot.controls.filter(c => JSON.stringify(previous.get(c.token)) !== JSON.stringify(c));
      const removed = !snapshot.ok || snapshot.partial ? [] : [...previous.keys()].filter(k => !next.has(k));
      const { controls, ...summary } = snapshot;
      await append('workflow', 'desktop.snapshot', { summary, changed, removed, unchanged: controls.length - changed.length });
      if (snapshot.ok) previous = snapshot.partial ? new Map([...previous, ...next]) : next;
      session.desktopCode = snapshot.code; session.desktopPartial = snapshot.partial; await manifest();
    })),
    stop: (reason = 'TECHNICIAN_STOPPED') => serialize(() => guarded(async () => {
      if (session?.active) {
        await append('workflow', 'session.stop', { reason: reason === 'CONNECTOR_CLOSED' ? reason : 'TECHNICIAN_STOPPED' });
        session.active = false; session.stoppedAt = new Date(now()).toISOString(); session.stopReason = reason === 'CONNECTOR_CLOSED' ? reason : 'TECHNICIAN_STOPPED'; await manifest();
      }
      return status();
    })),
    saveBundle: () => serialize(() => guarded(async () => {
      if (!session) throw new Error('No pilot recording exists.');
      const name = `TEMPORARY-INTENSIFIED-review-${randomUUID()}.jsonl`;
      const file = await open(path.join(session.directory, name), 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify({ code: 'session.manifest', ...status(), directory: undefined }) + '\n');
        for (const part of session.files) for await (const chunk of createReadStream(path.join(session.directory, part))) await file.writeFile(chunk);
        if (sync) await file.sync();
      } finally { await file.close(); }
      session.bundleFile = name; await manifest(); return status();
    })),
    export: () => serialize(async () => {
      if (!session) throw new Error('No pilot recording exists in this connector session.');
      // Snapshot only acknowledged files; export has no key, directory, source text or raw exceptions.
      const metadata = { ...status(), directory: undefined };
      const files = [];
      for (const name of session.files) { const filename = path.join(session.directory, name); files.push({ filename, bytes: (await stat(filename)).size }); }
      return { metadata, files };
    }),
  };
}
