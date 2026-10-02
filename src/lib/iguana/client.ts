import { parseApiQuery } from './payload';
import type { ConnectorConfig, DiagnosticSink } from './types';

export async function queryIguana(config: ConnectorConfig, emit: DiagnosticSink, signal?: AbortSignal, captureResponse?: (body: string) => void) {
  emit('info', 'transport.request', 'Requesting read-only MessageBroker logs through local bridge', {
    channel: config.channel, after: config.after, before: config.before, filter: config.filter,
    limit: config.limit, type: 'info,messages,warnings,errors', method: 'GET', endpoint: '/api_query', authMode: config.authMode,
  });
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch('/connector/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), signal });
  } catch (error) {
    if (signal?.aborted) {
      emit('info', 'transport.stopped', 'Local request was stopped by the operator');
      throw error;
    }
    emit('error', 'transport.unreachable', 'Local bridge is unavailable or request was stopped', { error: String(error), pageProtocol: location.protocol });
    throw new Error('Live intake needs Start-Iguana-Connector.bat and its localhost page. HAR import works in the standalone page.');
  }
  const type = response.headers.get('content-type');
  if (!type?.includes('application/json')) {
    emit('error', 'transport.bridge.profile', 'Response did not come from the connector bridge', { status: response.status, contentType: type });
    throw new Error('This page is not served by the connector bridge. Launch Start-Iguana-Connector.bat.');
  }
  const result = await response.json();
  emit(result.ok ? 'info' : 'error', 'transport.response', 'Local bridge returned an Iguana response', {
    requestId: result.requestId, status: result.status, contentType: result.contentType,
    elapsedMs: Math.round(performance.now() - started), upstreamMs: result.elapsedMs,
    bytes: result.bytes, code: result.code, error: result.error,
    bridgeBuildId: result.bridgeBuildId, bridgeRuntime: result.runtime, serverDate: result.serverDate,
  });
  if (typeof result.body === 'string') captureResponse?.(result.body);
  if (!result.ok) throw new Error(result.error || `Iguana returned HTTP ${result.status}`);
  if (typeof result.body !== 'string') throw new Error('Bridge response has no log export body.');
  const logs = parseApiQuery(result.body, emit);
  const saturated = logs.length >= config.limit;
  if (saturated) emit('error', 'query.limit', 'Query limit reached; automatic polling pauses to avoid silently skipping orders', { entries: logs.length, limit: config.limit, action: 'Narrow the server-time window or increase the limit, then fetch again.' });
  emit('info', 'query.result', 'Log query parsed', { entries: logs.length, saturated, channels: [...new Set(logs.map(log => log.channel))], logTypes: [...new Set(logs.map(log => log.logType))] });
  const matching = logs.filter(log => {
    if (!log.channel || log.channel === config.channel) return true;
    emit('warn', 'query.channel.mismatch', 'Ignoring a log from another channel', { channel: log.channel, expected: config.channel, logId: log.logId });
    return false;
  });
  return { logs: matching, saturated };
}

/** Use server wall-clock strings verbatim; do not assume its timezone is this PC's. */
export function nextAfter(timestamps: (string | undefined)[]): string | undefined {
  const normalized = timestamps.map(time => time?.replace(/^(\d{4})-(\d{2})-(\d{2}) /, '$1/$2/$3 '));
  const dates = normalized.filter((time): time is string => Boolean(time && /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(time)));
  if (dates.length !== timestamps.length || !dates.length) return undefined;
  if (dates.some(time => {
    const iso = time.slice(0, 19).replace(/\//g, '-').replace(' ', 'T');
    const date = new Date(iso + 'Z');
    return !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== iso;
  })) return undefined;
  const latest = dates.sort()[dates.length - 1];
  const instant = new Date(latest.slice(0, 19).replace(/\//g, '-').replace(' ', 'T') + 'Z');
  instant.setUTCSeconds(instant.getUTCSeconds() - 2);
  return instant.toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' ');
}
