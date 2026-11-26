/** TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH
 * Remove/reduce after investigation. Never send source text, PONs, names,
 * field values, raw exceptions, URLs or credentials to this journal.
 */
import { traceLogger, type TraceEvent } from './traceLogger';
import { subscribePilotEvents } from '../pilotDiagnostics';
import { browserRecords, type BrowserRecords } from '../browserDatabase';

export const INTENSIFIED_REMOVAL_MARKER = 'TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH';
export interface JournalEvent { code: string; fields: Record<string, unknown>; at: string; elapsedMs: number; timezoneOffset: number; clientRef?: string }
export interface JournalStatus {
  ok: boolean; active: boolean; configured?: boolean; sessionId?: string; directory?: string; startedAt?: string;
  workflowEvents?: number; translationEvents?: number; droppedWorkflow?: number; droppedTranslation?: number;
  browserDroppedWorkflow?: number; browserDroppedTranslation?: number;
  limitReached?: boolean; fileError?: boolean; stopReason?: string; desktopCode?: string; desktopPartial?: boolean;
  maxStreamBytes?: number; maxDurationMs?: number;
  bundleFile?: string; selectionRequired?: boolean; automaticObservation?: boolean; observationEvents?: number; rawClinicalText?: boolean;
  fileErrorCode?: string;
}
export interface RecorderState {
  available: boolean; status: JournalStatus; pending: number; droppedWorkflow: number; droppedTranslation: number;
  outboxError: boolean; error: string; lastSavedAt?: string;
}
type Batch = { batchId: string; events: JournalEvent[] };
type Outbox = { sessionId: string; overflowRef?: string; batch?: Batch; workflow: JournalEvent[]; translation: JournalEvent[]; droppedWorkflow: number; droppedTranslation: number };
type Api = (action: string, body?: Record<string, unknown>) => Promise<JournalStatus>;
const numeric = ['rawProseLength', 'abnormalitiesCount', 'splitPartsCount'];
const flags = ['isControlled', 'isPaxitSolid', 'requiresSplit', 'hasPackagingNotice', 'isApap'];
const components = ['clinicalEngine', 'doseCalculator', 'frequencyEngine', 'paxitEngine', 'OrderQueueView', 'WorkbenchView', 'citrixStorage', 'sigDictionaryService'];
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
const OUTBOX_HEAD = 'sig_assist_intensified_last_outbox_v1';
const outboxKey = (session: string) => 'sig_assist_intensified_outbox_v1_' + session;
export function summarizeTrace(event: TraceEvent, traceRef: string): Record<string, unknown> {
  const result: Record<string, unknown> = { layer: event.layer, level: event.level, component: components.includes(event.component) ? event.component : 'other', traceRef, messageLength: event.message.length };
  for (const k of numeric) if (typeof event.details?.[k] === 'number') result[k] = event.details[k];
  for (const k of flags) if (typeof event.details?.[k] === 'boolean') result[k] = event.details[k];
  for (const [from, to] of [['drugName', 'drugNameLength'], ['primarySig', 'primarySigLength']] as const) if (typeof event.details?.[from] === 'string') result[to] = (event.details[from] as string).length;
  return result;
}
export async function journalApi(action: string, body: Record<string, unknown> = {}): Promise<JournalStatus> {
  const response = await fetch(`/connector/pilot/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(action === 'start' ? 60000 : 20000) });
  if (response.status === 404) throw new Error(`Start the v${__SIG_ASSIST_VERSION__} connector to use pilot file logging.`);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const code = ['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EIO', 'EROFS', 'ETIMEDOUT', 'ECONNRESET', 'ENOTCONN', 'EBUSY', 'DESTINATION_UNAVAILABLE', 'FILE_IO_ERROR'].includes(data.fileErrorCode) ? ` (${data.fileErrorCode})` : '';
    throw new Error(`Pilot file logging could not complete the request${code}. Check the connector and configured destination.`);
  }
  return data;
}
export class IntensifiedRecorder {
  private state: RecorderState = { available: false, status: { ok: true, active: false }, pending: 0, droppedWorkflow: 0, droppedTranslation: 0, outboxError: false, error: '' };
  private outbox?: Outbox;
  private refs = new Map<string, string>();
  private listeners = new Set<() => void>();
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private started = performance.now();
  private clientRef = id();
  private storage: Storage;
  private writeTail: Promise<void> = Promise.resolve();
  private protectedOutbox = false;
  private generation = 0;
  constructor(private api: Api = journalApi, storage?: Storage, private capacity = 10000, private records: BrowserRecords = browserRecords('sig-assist-pilot-v2')) {
    try { this.storage = storage || localStorage; }
    catch { this.storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } } as unknown as Storage; }
  }
  getState = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<RecorderState> = {}) {
    this.state = { ...this.state, ...patch, pending: this.outbox ? this.outbox.workflow.length + this.outbox.translation.length + (this.outbox.batch?.events.length || 0) : 0, droppedWorkflow: this.outbox?.droppedWorkflow || 0, droppedTranslation: this.outbox?.droppedTranslation || 0 };
    this.listeners.forEach(fn => fn());
  }
  private persist(): Promise<void> {
    if (!this.outbox) return this.writeTail;
    if (this.protectedOutbox) { this.publish({ outboxError: true }); return this.writeTail; }
    // Snapshot now and serialize commits so a late pagehide backup cannot
    // overwrite a newer acknowledged batch. Never write diagnostics to localStorage.
    const snapshot: Outbox = structuredClone(this.outbox);
    this.writeTail = this.writeTail.then(async () => {
      try {
        await this.records.merge([[outboxKey(snapshot.sessionId), snapshot], [OUTBOX_HEAD, snapshot.sessionId]], (_old, incoming) => incoming);
        this.publish({ outboxError: false });
      } catch { this.publish({ outboxError: true }); }
    });
    return this.writeTail;
  }
  private validOutbox(saved: unknown, session: string): saved is Outbox {
    if (!saved || typeof saved !== 'object') return false;
    const value = saved as Outbox;
    return value.sessionId === session && Array.isArray(value.workflow) && Array.isArray(value.translation)
      && value.workflow.length <= this.capacity && value.translation.length <= this.capacity
      && Number.isFinite(value.droppedWorkflow) && Number.isFinite(value.droppedTranslation)
      && (!value.batch || (typeof value.batch.batchId === 'string' && Array.isArray(value.batch.events) && value.batch.events.length <= 250));
  }
  private async migrateLegacy() {
    // Only diagnostic keys. Never clear site storage or touch cases, codes or orders.
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) { const key = this.storage.key(i); if (key?.startsWith('sig_assist_intensified_outbox_v1_')) keys.push(key); }
    for (const key of keys) {
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      let saved: unknown;
      try { saved = JSON.parse(raw); } catch { continue; } // Preserve corrupt legacy data for recovery.
      const session = key.slice('sig_assist_intensified_outbox_v1_'.length);
      if (!this.validOutbox(saved, session)) continue;
      // Keep an exact legacy copy even if this session has a newer database copy.
      await this.records.merge([['legacy:' + key, raw], [key, saved]], (old, incoming) => old === undefined ? incoming : old);
      if (await this.records.get('legacy:' + key) === raw && this.storage.getItem(key) === raw) this.storage.removeItem(key);
    }
    const head = this.storage.getItem(OUTBOX_HEAD);
    if (head && await this.records.get(outboxKey(head)) !== undefined) {
      if (await this.records.get(OUTBOX_HEAD) === undefined) await this.records.put(OUTBOX_HEAD, head);
      if (this.storage.getItem(OUTBOX_HEAD) === head) this.storage.removeItem(OUTBOX_HEAD);
    }
  }
  private async restore(sessionId?: string) {
    await this.writeTail;
    if (this.outbox?.sessionId === sessionId && sessionId) return;
    this.refs.clear(); this.started = performance.now(); this.protectedOutbox = false;
    try {
      await this.migrateLegacy();
      const selected = sessionId || await this.records.get(OUTBOX_HEAD);
      if (typeof selected === 'string') {
        const saved = await this.records.get(outboxKey(selected));
        const legacy = this.storage.getItem(outboxKey(selected));
        if (saved !== undefined) {
          if (!this.validOutbox(saved, selected)) throw new Error('Invalid outbox');
          this.outbox = { ...saved, overflowRef: saved.overflowRef || id() }; return;
        }
        if (legacy) throw new Error('Unreadable legacy outbox');
      }
    } catch { this.protectedOutbox = true; this.publish({ outboxError: true }); }
    if (sessionId) this.outbox = { sessionId, overflowRef: id(), workflow: [], translation: [], droppedWorkflow: 0, droppedTranslation: 0 };
  }
  record = (code: string, fields: Record<string, unknown> = {}) => {
    if (!this.state.status.active || !this.outbox || this.outbox.sessionId !== this.state.status.sessionId) return;
    const stream = code === 'trace' ? 'translation' : 'workflow';
    if (this.outbox[stream].length >= this.capacity) { this.outbox[stream === 'workflow' ? 'droppedWorkflow' : 'droppedTranslation']++; return; }
    this.outbox[stream].push({ code, fields, at: new Date().toISOString(), elapsedMs: performance.now() - this.started, timezoneOffset: new Date().getTimezoneOffset(), clientRef: this.clientRef });
  };
  private attach() {
    if (this.cleanup) return;
    const offTrace = traceLogger.subscribe(event => {
      if (!this.refs.has(event.traceId)) this.refs.set(event.traceId, 'trace-' + (this.refs.size + 1));
      this.record('trace', summarizeTrace(event, this.refs.get(event.traceId)!));
    });
    const offPilot = subscribePilotEvents(event => this.record(event.code, { ...event.fields }));
    const interaction = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest('button,input,select,textarea,a') : null;
      if (!target || target instanceof HTMLInputElement && target.type === 'password') return;
      const tag = target.tagName.toLowerCase(); const fields: Record<string, unknown> = { tag };
      if (target instanceof HTMLInputElement) { fields.inputType = ['text', 'number', 'checkbox', 'radio', 'date', 'datetime-local', 'search', 'button', 'submit'].includes(target.type) ? target.type : 'other'; fields.checked = target.checked; }
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) fields.valueLength = target.value.length;
      this.record(event.type === 'click' ? 'browser.click' : 'browser.change', fields);
    };
    const failure = () => this.record('browser.error');
    const visibility = () => this.record('browser.visibility', { state: document.hidden ? 'hidden' : 'visible' });
    const pagehide = () => { this.record('browser.lifecycle', { state: 'pagehide' }); void this.persist(); };
    document.addEventListener('click', interaction, true); document.addEventListener('change', interaction, true);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('error', failure); window.addEventListener('unhandledrejection', failure); window.addEventListener('pagehide', pagehide);
    this.cleanup = () => { offTrace(); offPilot(); document.removeEventListener('click', interaction, true); document.removeEventListener('change', interaction, true); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('error', failure); window.removeEventListener('unhandledrejection', failure); window.removeEventListener('pagehide', pagehide); this.cleanup = undefined; };
  }
  async connect() {
    const generation = ++this.generation;
    if (!['http:', 'https:'].includes(location.protocol)) { this.publish({ error: 'Start-Iguana-Connector.bat enables local pilot file logging.' }); return; }
    if (this.api === journalApi && !document.querySelector('meta[name="sig-assist-local-connector"][content="pilot-v1"]')) {
      this.publish({ error: 'Open Start-Iguana-Connector.bat from this build to enable local pilot file logging.' }); return;
    }
    try {
      const status = await this.api('status'); if (generation !== this.generation) return;
      await this.restore(status.sessionId); if (generation !== this.generation) return; this.publish({ available: true, status, error: '' });
      if (status.active) this.attach();
      if (!this.timer) this.timer = setInterval(() => { void this.flush(); }, 1500);
    } catch { if (generation === this.generation) this.publish({ error: 'Pilot file logger unavailable. Start the connector from this build, then check again.' }); }
  }
  async start(observeDesktop: boolean, screen: string) {
    const status = await this.api('start', { observeDesktop, appVersion: __SIG_ASSIST_VERSION__, appBuildId: __SIG_ASSIST_BUILD__ });
    await this.restore(status.sessionId); this.publish({ available: true, status, error: '' }); this.attach();
    this.record('screen.open', { screen }); this.record('browser.lifecycle', { state: 'pageshow', port: Number(location.port) }); await this.persist();
    if (!this.timer) this.timer = setInterval(() => { void this.flush(); }, 1500);
    return status;
  }
  async flush() {
    if (this.running) return this.running;
    this.running = (async () => {
      if (!this.state.status.active || !this.outbox) return;
      try {
        // A retry uses the same persisted batch ID. The server acknowledges it once.
        while (this.outbox.batch || this.outbox.workflow.length || this.outbox.translation.length) {
          if (!this.outbox.batch) {
            const events = this.outbox.workflow.splice(0, 180);
            events.push(...this.outbox.translation.splice(0, 200 - events.length));
            events.push({ code: 'browser.overflow', clientRef: this.outbox.overflowRef, fields: { droppedWorkflow: this.outbox.droppedWorkflow, droppedTranslation: this.outbox.droppedTranslation }, at: new Date().toISOString(), elapsedMs: performance.now() - this.started, timezoneOffset: new Date().getTimezoneOffset() });
            this.outbox.batch = { batchId: id(), events }; await this.persist();
          }
          this.publish();
          const status = await this.api('events', { sessionId: this.outbox.sessionId, ...this.outbox.batch });
          this.outbox.batch = undefined; await this.persist(); this.publish({ status, error: '', lastSavedAt: new Date().toISOString() });
          if (!status.active) break;
        }
        const status = await this.api('status'); this.publish({ status, error: '' });
        if (!status.active) { this.cleanup?.(); await this.persist(); }
      } catch {
        await this.persist(); let status = this.state.status;
        try { status = await this.api('status'); if (!status.active) this.cleanup?.(); } catch { /* Unreachable status remains explicitly uncertain. */ }
        this.publish({ status, error: 'Some browser events are unsaved. Check recording status; retry while the connector is running or download pending events before closing.' });
      }
    })().finally(() => { this.running = undefined; });
    return this.running;
  }
  async stop() {
    await this.flush(); const status = await this.api('stop'); this.cleanup?.(); await this.persist(); this.publish({ status });
  }
  async checkpoint(checkpoint: string) {
    await this.flush(); const status = await this.api('checkpoint', { checkpoint }); this.publish({ status });
  }
  async saveBundle() {
    await this.flush(); const status = await this.api('bundle'); this.publish({ status }); return status;
  }
  pendingExport() { void this.persist(); return { marker: INTENSIFIED_REMOVAL_MARKER, format: 'unsaved-browser-events', ...this.outbox }; }
  dispose() { this.generation++; void this.persist(); this.cleanup?.(); clearInterval(this.timer); this.timer = undefined; }
}

export function downloadJournalBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
