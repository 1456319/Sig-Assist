// TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH
// Local clinical observations. Remove/reduce after workflow investigation.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { helperExecutable, normalizeWorkflowSnapshot } from './framework-desktop.mjs';

const controls = new Set(['BackButton', 'NextButton', 'CancelButton', 'PreviewSigButton', 'PreviewLinkedSigButton', 'AddSplitButton', 'RemoveSplitButton', 'NewBatchButton', 'save', 'done', 'save and close', 'process request', 'refuse request', 'preview sig', 'quit', 'cancel', 'next', 'back', 'button']);
const kinds = new Set(['ready', 'changed', 'invoked', 'uia_unavailable', 'provider_unavailable', 'heartbeat']);
export function nativeObservationEvent(raw) {
  if (!raw || !kinds.has(raw.kind)) return null;
  return { kind: raw.kind, ...(raw.kind === 'invoked' ? { control: controls.has(raw.control) ? raw.control : 'button' } : {}),
    ...(typeof raw.uia === 'boolean' ? { uia: raw.uia } : {}), suppressed: Number.isSafeInteger(raw.suppressed) && raw.suppressed >= 0 ? Math.min(raw.suppressed, 1000000) : 0 };
}

// A small persistent event source. UIA callbacks emit static action identifiers;
// no property traversal runs inside WinEvent hooks. Killed on stop or lost heartbeat.
export async function startNativeEvents(binding, emit, { executable = helperExecutable, spawnImpl = spawn, now = Date.now } = {}) {
  const exe = await executable();
  const child = spawnImpl(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let stopped = false, buffer = '', heard = now();
  function close() { if (stopped) return; stopped = true; clearInterval(watchdog); child.kill(); }
  function unavailable() { if (!stopped) { emit({ kind: 'provider_unavailable' }); close(); } }
  child.stdin.on('error', unavailable);
  child.on('error', unavailable); child.on('exit', unavailable);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    if (stopped) return;
    buffer += chunk;
    if (buffer.length > 65536) { unavailable(); return; }
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).replace(/^\uFEFF/, ''); buffer = buffer.slice(index + 1);
      try { const event = nativeObservationEvent(JSON.parse(line)); if (event) { heard = now(); emit(event); } } catch { /* No arbitrary diagnostics or clinical text in this channel. */ }
    }
  });
  const watchdog = setInterval(() => { if (now() - heard > 12000) unavailable(); }, 2000); watchdog.unref?.();
  child.stdin.end(JSON.stringify({ action: 'watch', entryWindow: binding, parentPid: process.pid }));
  return close;
}

export function createWorkflowObserver({ desktop, onRecord, subscribeNative = startNativeEvents, now = Date.now,
  fallbackMs = 5000, settleMs = 500, minReadMs = 1000, maxWaitMs = 2000, ringLimit = 300 } = {}) {
  let sessionId, running = false, accepting = false, generation = 0, sequence = 0, ring = [], ringDropped = 0, queueDropped = 0, reportedDrops = 0;
  let timer, fallback, unsubscribe, bindingKey, subscribing = false, subscriptionRetryAt = 0, subscriptionGeneration = 0;
  let reading = false, requested = false, firstRequestAt = 0, lastReadAt = -Infinity, resumeAt = 0, failures = 0;
  let previous, lastCode, lastStatusAt = -Infinity, status = 'STOPPED', eventSource = 'waiting', writeChain = Promise.resolve();
  const iso = () => new Date(now()).toISOString();
  const active = () => running;
  function publish(frame, version = generation) {
    // Serialize local writes, acknowledge only saved records into the browser ring.
    // Bound native event backlog independently from the bounded snapshot ring.
    if (queuedWrites >= 100) { queueDropped++; return; }
    queuedWrites++;
    const frameSession = sessionId;
    writeChain = writeChain.then(async () => {
      if (version !== generation || !running) return;
      try {
        if (queueDropped > reportedDrops) {
          const dropped = queueDropped - reportedDrops;
          const gap = { sessionId: frameSession, id: ++sequence, observedAt: iso(), kind: 'observation_gap', dropped, evidence: 'queue_overflow', outcome: 'unverified' };
          if (await onRecord(gap, frameSession) === false) { status = 'LOCAL_WRITE_STOPPED'; stop(); return; }
          if (version !== generation || !running) return;
          reportedDrops += dropped; ring.push(gap);
        }
        const record = { ...frame, sessionId: frameSession, id: ++sequence, observedAt: frame.observedAt || iso() };
        const saved = await onRecord(record, frameSession);
        if (version !== generation || !running) return;
        if (saved === false) { status = 'LOCAL_WRITE_STOPPED'; stop(); return; }
        ring.push(record);
        while (ring.length > ringLimit) { ring.shift(); ringDropped++; }
      } catch { if (version === generation) { status = 'LOCAL_WRITE_FAILED'; stop(); } }
    }).finally(() => { queuedWrites--; });
  }
  let queuedWrites = 0;
  function native(event, version) {
    if (!accepting || !running || version !== generation) return;
    if (event.kind === 'heartbeat') return;
    if (event.kind === 'ready') eventSource = event.uia ? 'uia_and_windows_events' : 'windows_events';
    // UIA and WinEvent are independent providers in the same sidecar. A
    // missing UIA subscription does not retire working Windows event hooks.
    if (event.kind === 'uia_unavailable') eventSource = 'windows_events';
    if (event.kind === 'provider_unavailable') {
      unsubscribe?.(); unsubscribe = undefined; subscriptionGeneration++; subscribing = false;
      eventSource = 'polling_fallback'; subscriptionRetryAt = now() + 30000;
    }
    if (event.kind === 'invoked') publish({ kind: 'button_invoked', control: event.control, evidence: 'invoke_event', outcome: 'unverified',
      candidatePon: previous?.pon ?? null, association: 'preceding_observation_only' }, version);
    request();
  }
  function binding() { return desktop.observationBinding?.(); }
  function refreshBinding() {
    const current = binding(), key = current ? JSON.stringify([current.pid, current.started, current.id, current.handle]) : '';
    if (key !== bindingKey) {
      unsubscribe?.(); unsubscribe = undefined; subscriptionGeneration++; subscribing = false;
      bindingKey = key; previous = undefined; lastCode = undefined; resumeAt = 0; failures = 0;
      eventSource = current ? 'connecting' : 'selection_required';
      subscriptionRetryAt = 0;
    }
    if (current && !unsubscribe && !subscribing && now() >= subscriptionRetryAt) {
      subscribing = true; const version = generation, subscription = ++subscriptionGeneration;
      Promise.resolve().then(() => subscribeNative(current, event => {
        const normalized = nativeObservationEvent(event);
        if (normalized && subscription === subscriptionGeneration) native(normalized, version);
      })).then(close => {
        if (!running || generation !== version || subscription !== subscriptionGeneration) { close?.(); return; }
        unsubscribe = close; subscribing = false;
      }).catch(() => { if (version === generation && subscription === subscriptionGeneration) { subscribing = false; eventSource = 'polling_fallback'; subscriptionRetryAt = now() + 30000; } });
    }
    return key;
  }
  function request() {
    if (!running || !accepting) return;
    const time = now();
    if (!requested) firstRequestAt = time;
    requested = true;
    if (reading) return;
    clearTimeout(timer);
    const due = Math.max(resumeAt, lastReadAt + minReadMs, Math.min(time + settleMs, firstRequestAt + maxWaitMs));
    timer = setTimeout(() => void read(), Math.max(0, due - time)); timer.unref?.();
  }
  async function read() {
    if (!running || reading) return;
    const version = generation, key = refreshBinding();
    reading = true; requested = false; lastReadAt = now();
    try {
      const raw = await desktop('workflow-snapshot');
      if (!running || !accepting || generation !== version || key !== (binding() ? JSON.stringify([binding().pid, binding().started, binding().id, binding().handle]) : '')) return;
      const snapshot = normalizeWorkflowSnapshot(raw);
      if (!snapshot.ok) {
        status = snapshot.code;
        if (['READ_TIMEOUT', 'FRAMEWORK_NOT_RESPONDING', 'WORKFLOW_SNAPSHOT_FAILED'].includes(status)) {
          failures++; resumeAt = now() + Math.min(60000, 10000 * 2 ** (failures - 1));
        } else if (snapshot.retryAfterMs) resumeAt = now() + snapshot.retryAfterMs;
        if (lastCode !== status || now() - lastStatusAt >= 30000) {
          publish({ kind: 'observation_unavailable', code: status, readDurationMs: Math.max(0, now() - lastReadAt), evidence: 'read_attempt', outcome: 'unverified' }, version); lastStatusAt = now();
        }
        lastCode = status; previous = undefined; return;
      }
      failures = 0; resumeAt = 0; status = Object.values(snapshot.fields).some(value => value.trim()) ? 'OBSERVING' : snapshot.pon ? 'IDENTITY_ONLY' : 'VIEW_ONLY'; lastCode = 'OK';
      const changed = Object.keys(snapshot.fields).filter(role => previous?.fields?.[role] !== snapshot.fields[role]);
      const removed = previous ? Object.keys(previous.fields).filter(role => !(role in snapshot.fields)) : [];
      const boundary = !previous ? 'order_visible' : snapshot.pon !== previous.pon ? 'order_changed' : snapshot.view !== previous.view ? 'view_changed' : 'fields_changed';
      if (!previous || changed.length || removed.length || snapshot.pon !== previous.pon || snapshot.view !== previous.view || snapshot.sigMode !== previous.sigMode || JSON.stringify(snapshot.unavailable) !== JSON.stringify(previous.unavailable)) {
        publish({ kind: boundary, ...snapshot, changed, removed, readDurationMs: Math.max(0, now() - lastReadAt), evidence: 'visible_fields', outcome: 'unverified' }, version);
      }
      previous = snapshot;
    } catch {
      if (running && generation === version) { status = 'WORKFLOW_SNAPSHOT_FAILED'; failures++; resumeAt = now() + Math.min(60000, 10000 * 2 ** (failures - 1)); }
    } finally { reading = false; if (requested && running) request(); }
  }
  function stop() {
    running = false; accepting = false; generation++; subscriptionGeneration++; clearTimeout(timer); clearInterval(fallback);
    unsubscribe?.(); unsubscribe = undefined; subscribing = false; previous = undefined; bindingKey = undefined; requested = false;
    if (!status.startsWith('LOCAL_WRITE')) status = 'STOPPED';
  }
  return {
    start(id = randomUUID()) {
      if (running && id === sessionId) return;
      stop(); sessionId = id; running = true; accepting = true; sequence = 0; ring = []; ringDropped = 0; queueDropped = 0; reportedDrops = 0; status = 'STARTING';
      lastReadAt = -Infinity; firstRequestAt = 0; resumeAt = 0; failures = 0; lastCode = undefined; refreshBinding();
      request(); fallback = setInterval(() => { refreshBinding(); request(); }, fallbackMs); fallback.unref?.();
    },
    stop, request, active, drain: () => writeChain,
    async finish() { accepting = false; clearTimeout(timer); clearInterval(fallback); unsubscribe?.(); unsubscribe = undefined; subscriptionGeneration++; await writeChain; stop(); },
    updates(after = 0, expectedSession) {
      const cursor = expectedSession === sessionId && Number.isSafeInteger(after) && after >= 0 ? after : 0;
      const oldest = ring[0]?.id ?? sequence + 1;
      return { active: running, sessionId, status, eventSource, cursor: ring.at(-1)?.id ?? 0,
        gaps: cursor < oldest - 1 ? oldest - 1 - cursor : 0, dropped: queueDropped, retiredFrames: ringDropped, frames: ring.filter(row => row.id > cursor) };
    },
  };
}
