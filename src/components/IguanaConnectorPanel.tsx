import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useReviewSession } from '../hooks/use-review-session';
import { ConnectorDiagnostics } from '../lib/iguana/diagnostics';
import { diagnosticPayload, parseApiQuery, parseHar, parseScriptLog } from '../lib/iguana/payload';
import { ingestScriptEvents, type IntakeSummary } from '../lib/iguana/intake';
import { nextAfter, queryIguana } from '../lib/iguana/client';
import { initialConnectorConfig, yesterdayMidnight } from '../lib/iguana/config';
import type { ConnectorConfig, IguanaLog } from '../lib/iguana/types';
import { translateClinicalSig } from '../lib/clinical/clinicalEngine';
import { orderKey } from '../lib/orderQueue';
import { reviewButtonClass, reviewInputClass } from './SigReviewPanel';

export function IguanaConnectorPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const { orders, setOrders, ready } = useReviewSession();
  const latestOrders = useRef(orders); latestOrders.current = orders;
  const select = useRef(onSelect); select.current = onSelect;
  const [diagnostics] = useState(() => new ConnectorDiagnostics());
  const [, redraw] = useState(0);
  const [config, setConfig] = useState(() => initialConnectorConfig());
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready · import a capture or open Live connection settings to fetch logs');
  const [summary, setSummary] = useState<IntakeSummary>();
  const [includePayloads, setIncludePayloads] = useState(false);
  const captureEnabled = useRef(false); captureEnabled.current = includePayloads;
  const snapshots = useRef<{ origin: Record<string, unknown>; payload: string }[]>([]);
  const droppedSnapshots = useRef(0);
  const active = useRef(false);
  const abort = useRef<AbortController>();
  const cursor = useRef('');
  const failures = useRef(0);

  useEffect(() => diagnostics.subscribe(() => redraw(value => value + 1)), [diagnostics]);
  useEffect(() => () => { abort.current?.abort(); }, []);

  const capture = useCallback((payload: string, origin: Record<string, unknown>) => {
    if (!captureEnabled.current) return;
    snapshots.current.push({ origin: { ...origin, originalCharacters: payload.length, truncated: payload.length > 1000000 }, payload: diagnosticPayload(payload).slice(0, 1000000) });
    if (snapshots.current.length > 20) { snapshots.current.shift(); droppedSnapshots.current++; }
  }, []);

  const applyLogs = useCallback((logs: IguanaLog[]) => {
    const failedBefore = diagnostics.counts['decode.failed'] ?? 0;
    const events = logs.flatMap(log => { const { payload, ...origin } = log; capture(payload, origin); return parseScriptLog(log, diagnostics.emit); });
    const before = latestOrders.current;
    const result = ingestScriptEvents(before, events, source => translateClinicalSig({
      id: orderKey(source), pon: source.pon, drugName: source.drug, rawProse: source.directions,
      sourceFormat: 'ncpdp_xml', traceId: `IGUANA_${source.iguana?.messageId}`,
    }).primarySig, diagnostics.emit);
    const decodeFailures = (diagnostics.counts['decode.failed'] ?? 0) - failedBefore;
    result.summary.quarantined += decodeFailures;
    if (decodeFailures) diagnostics.emit('error', 'intake.decode.quarantine', 'Undecodable source logs need investigation', { logs: decodeFailures });
    latestOrders.current = result.orders;
    setOrders(result.orders);
    setSummary(result.summary);
    if (result.summary.added || result.summary.revised) {
      const changed = result.orders.find(order => !before.some(old => old.id === order.id && old.revision === order.revision));
      if (changed) select.current(changed.id);
    }
    if (result.summary.quarantined) toast.error(`${result.summary.quarantined} intake events need investigation. Export connector diagnostics.`);
    return result;
  }, [capture, diagnostics, setOrders]);

  const runQuery = useCallback(async () => {
    if (active.current) return;
    active.current = true; setBusy(true);
    abort.current = new AbortController();
    try {
      const effective = { ...config, after: cursor.current || config.after };
      const result = await queryIguana(effective, diagnostics.emit, abort.current.signal, body => capture(body, { source: 'api_query_response' }));
      const intake = applyLogs(result.logs);
      failures.current = 0;
      if (intake.summary.quarantined) {
        setPolling(false); setStatus('Paused: intake events need investigation. Export connector diagnostics; the cursor has not advanced.');
      } else if (result.saturated) {
        setPolling(false); setStatus('Paused: log query limit reached. Narrow the time window or increase the limit.');
      } else {
        const next = nextAfter(result.logs.map(log => log.timestamp));
        if (next && next > effective.after && !config.before) {
          cursor.current = next;
          diagnostics.emit('debug', 'query.cursor', 'Advanced server-time cursor with a two-second overlap', { after: next });
        } else if (result.logs.length && !config.before) {
          diagnostics.emit('warn', 'query.cursor.unavailable', 'Server time format unavailable; retain the current window and deduplicate repeated orders', { after: effective.after });
        }
        setStatus(`Last fetch: ${result.logs.length} logs · ${intake.summary.added} added · ${intake.summary.quarantined} need investigation`);
      }
    } catch (error) {
      if (abort.current.signal.aborted) setStatus('Stopped');
      else {
        failures.current++;
        diagnostics.emit('error', 'query.failed', 'Intake fetch failed; queue is unchanged', { error: String(error), consecutiveFailures: failures.current });
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally { active.current = false; setBusy(false); }
  }, [applyLogs, capture, config, diagnostics]);

  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      await runQuery();
      if (!stopped) timer = setTimeout(tick, Math.min(120000, 15000 * 2 ** Math.min(failures.current, 3)));
    }
    void tick();
    return () => { stopped = true; clearTimeout(timer); abort.current?.abort(); };
  }, [polling, runQuery]);

  async function importFile(file: File) {
    if (active.current) return;
    active.current = true; setBusy(true);
    const controller = new AbortController(); abort.current = controller;
    try {
      const text = await file.text();
      if (controller.signal.aborted) { setStatus('Stopped'); return; }
      diagnostics.emit('info', 'import.file', 'Reading a local capture', { filename: file.name, bytes: file.size });
      const trimmed = text.trim();
      const logs = trimmed.startsWith('{') ? parseHar(text, diagnostics.emit) : /^(?:<\?xml[\s\S]*?\?>\s*)?<(?:[\w.-]+:)?export(?:\s|>)/i.test(trimmed) ? parseApiQuery(text, diagnostics.emit) : [{ payload: text }];
      const result = applyLogs(logs);
      setStatus(`Capture imported: ${logs.length} logs · ${result.summary.added} added · ${result.summary.duplicates} duplicates · ${result.summary.quarantined} need investigation`);
    } catch (error) {
      diagnostics.emit('error', 'import.failed', 'Local capture import failed', { error: String(error), filename: file.name });
      setStatus(String(error)); toast.error(String(error));
    } finally { active.current = false; setBusy(false); }
  }

  function exportBundle() {
    const bundle = diagnostics.export({
      buildId: __SIG_ASSIST_BUILD__, connection: { serverUrl: config.serverUrl, channel: config.channel, after: config.after, before: config.before, filter: config.filter, limit: config.limit, authMode: config.authMode, cursor: cursor.current },
      runtime: { userAgent: navigator.userAgent, pageProtocol: location.protocol, localTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, polling, status }, summary,
      queue: latestOrders.current.filter(order => order.iguana).map(order => ({ id: order.id, revision: order.revision, pon: order.pon, drug: order.drug, directions: order.directions, cancelled: order.cancelled, metadata: order.iguana })),
      payloadSnapshots: includePayloads ? snapshots.current : [], droppedSnapshots: droppedSnapshots.current,
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `sig-assist-iguana-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const canLive = location.protocol === 'http:' || location.protocol === 'https:';
  return <details className="rounded-lg border border-primary/40 bg-card p-4" open>
    <summary className="cursor-pointer font-semibold">Iguana intake · read-only</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm" role="status">{polling ? 'Polling · ' : ''}{status}</p>
      <div className="flex gap-3 flex-wrap items-center">
        <label className={`${reviewButtonClass} cursor-pointer`}>Import HAR / log XML
          <input aria-label="Import Iguana capture" className="hidden" type="file" accept=".har,.json,.xml,.txt" disabled={busy || polling || ready === false} onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} />
        </label>
        <button className={reviewButtonClass} onClick={exportBundle}>Export connector diagnostics</button>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" role="switch" checked={includePayloads} onChange={event => setIncludePayloads(event.target.checked)} />Include payload evidence</label>
      </div>
      <p className="text-xs text-muted-foreground">Imports inspect captured responses only. Diagnostics contain exact order data and resident references. Payload evidence records up to 20 snapshots of 1 MB each while enabled; authentication fields are omitted. Export before closing this page.</p>
      {summary && <p className="text-sm">Added {summary.added} · revised {summary.revised} · duplicates {summary.duplicates} · cancelled {summary.cancelled} · status events {summary.ignored} · investigate {summary.quarantined}</p>}
      <details>
        <summary className="cursor-pointer text-sm">Live connection settings</summary>
        <fieldset disabled={busy || polling} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {(['serverUrl', 'username', 'password', 'channel', 'after', 'before', 'filter'] as const).map(field => <label key={field} className="text-sm space-y-1">
            <span>{{ serverUrl: 'Iguana base URL', username: 'Username', password: 'Password', channel: 'Channel', after: 'After · Iguana server time', before: 'Before · optional server time', filter: 'Text / PON filter · optional' }[field]}</span>
            <input className={reviewInputClass} type={field === 'password' ? 'password' : 'text'} autoComplete="off" value={config[field]} placeholder={field === 'after' || field === 'before' ? 'YYYY/MM/DD HH:MM:SS' : undefined} onChange={event => { cursor.current = ''; setConfig(value => ({ ...value, [field]: event.target.value })); }} />
          </label>)}
          <label className="text-sm space-y-1"><span>Authentication mode</span><select className={reviewInputClass} value={config.authMode} onChange={event => setConfig(value => ({ ...value, authMode: event.target.value as ConnectorConfig['authMode'] }))}><option value="parameters">Iguana API parameters</option><option value="basic">HTTP Basic</option></select></label>
          <label className="text-sm space-y-1"><span>Log limit · 1–5000</span><input className={reviewInputClass} type="number" min={1} max={5000} value={config.limit} onChange={event => setConfig(value => ({ ...value, limit: Number(event.target.value) }))} /></label>
        </fieldset>
        <p className="text-xs text-muted-foreground my-3">Shared connection settings are prefilled. After starts at yesterday’s midnight on this computer; adjust it if Iguana uses a different clock. Every fetch authenticates independently of the Iguana browser login. Keep the connector window open. Polls run every 15 seconds with retry backoff. A full query pauses polling. Leaving Order Queue stops polling.</p>
        {!canLive && <p className="text-sm">This standalone page supports capture import. Launch the connector for live polling.</p>}
        <div className="flex gap-2">
          <button className={reviewButtonClass} disabled={busy || polling} onClick={() => { cursor.current = ''; setConfig(value => ({ ...value, after: yesterdayMidnight(), before: '' })); }}>Use yesterday’s midnight</button>
          <button className={reviewButtonClass} disabled={!canLive || busy || polling || ready === false} onClick={() => { cursor.current = ''; void runQuery(); }}>Fetch once</button>
          <button className={reviewButtonClass} disabled={!canLive || busy || polling || ready === false} onClick={() => { cursor.current = ''; setPolling(true); }}>Start polling</button>
          <button className={reviewButtonClass} disabled={!busy && !polling} onClick={() => { setPolling(false); abort.current?.abort(); setStatus('Stopped'); }}>Stop intake</button>
        </div>
      </details>
      <details><summary className="cursor-pointer text-sm">Recent intake diagnostics ({diagnostics.events.length} retained · {diagnostics.dropped} dropped)</summary>
        <div className="max-h-56 overflow-auto text-xs font-mono mt-2 space-y-1">{diagnostics.events.slice(-40).reverse().map(event => <p key={event.seq} className={event.level === 'error' ? 'text-red-400' : event.level === 'warn' ? 'text-amber-400' : ''}>{event.timestamp} [{event.level}] {event.stage}: {event.message}</p>)}</div>
      </details>
    </div>
  </details>;
}
