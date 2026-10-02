import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const maxBytes = 32 * 1024 * 1024;
const bridgeBuildId = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
const service = 'sig-assist-iguana-connector';
const log = (stage, details) => console.log(JSON.stringify({ time: new Date().toISOString(), stage, ...details }));

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
async function portablePage(htmlPath) {
  try {
    const html = await readFile(htmlPath, 'utf8');
    const ok = /<div\b[^>]*\bid=["']root["']/i.test(html) && /<script\b[^>]*type=["']module["'][^>]*>/i.test(html) && !/<(?:script|link)\b[^>]*(?:src|href)\s*=/i.test(html);
    return { html, profile: { ok, path: path.resolve(htmlPath), bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), ...(ok ? {} : { error: 'This index.html is not the standalone build. It references source files or separate assets that this connector cannot serve.' }) } };
  } catch (error) {
    return { profile: { ok: false, path: path.resolve(htmlPath), error: `Portable index.html could not be read (${error.code ?? 'READ_ERROR'}).` } };
  }
}
function startupErrorPage(profile) {
  return `<!DOCTYPE html><html lang="en"><meta charset="UTF-8"><title>Sig-Assist startup error</title><body style="font:16px system-ui;max-width:760px;margin:60px auto;padding:24px"><h1>Sig-Assist could not load</h1><p>${escapeHtml(profile.error)}</p><p>Extract the entire Windows Demo ZIP into one folder, then run Start-Iguana-Connector.bat from that folder. For a source checkout, first run <code>npm run build:demo</code>.</p><p>Checked file: <code>${escapeHtml(profile.path)}</code></p><p><a href="/connector/diagnostics">Open startup diagnostics</a> to save with your error report.</p></body></html>`;
}

export function makeQuery(config) {
  const base = new URL(config.serverUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Enter the Iguana HTTP/HTTPS base URL; use the separate username/password fields.');
  if (!config.channel?.trim()) throw new Error('Channel is required.');
  if (!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(config.after ?? '')) throw new Error('After is required in Iguana server time: YYYY/MM/DD HH:MM:SS.');
  if (config.before && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(config.before)) throw new Error('Before must be YYYY/MM/DD HH:MM:SS.');
  const limit = Number(config.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('Limit must be 1–5000.');
  const url = new URL(base);
  url.pathname = `${base.pathname.replace(/\/$/, '')}/api_query`;
  url.search = ''; url.hash = '';
  const params = { source: config.channel.trim(), type: 'info,messages,warnings,errors', after: config.after, deleted: 'false', reverse: 'false', limit: String(limit) };
  if (config.before) params.before = config.before;
  if (config.filter) params.filter = config.filter;
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const headers = { Accept: 'application/xml' };
  if (config.authMode === 'basic') headers.Authorization = `Basic ${Buffer.from(`${config.username ?? ''}:${config.password ?? ''}`).toString('base64')}`;
  else { url.searchParams.set('username', config.username ?? ''); url.searchParams.set('password', config.password ?? ''); }
  return { url, headers, params };
}

async function limitedText(stream, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw new Error(`Response exceeds ${limit} bytes; narrow the log window.`);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createBridge({ htmlPath = path.join(here, '../windows-demo/index.html'), fetchImpl = fetch, timeoutMs = 20000, startup = {} } = {}) {
  return createServer(async (request, response) => {
    const send = (status, object) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(object)); };
    if (request.method === 'GET' && ['/connector/health', '/connector/diagnostics'].includes(request.url)) {
      const { profile } = await portablePage(htmlPath);
      send(200, { ok: true, service, protocolVersion: 1, bridgeBuildId, readOnly: true, upstreamEndpoints: ['GET /api_query'], runtime: process.version, pid: process.pid, page: profile, startup }); return;
    }
    if (request.method === 'GET' && request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (request.method === 'GET' && ['/', '/index.html'].includes(request.url)) {
      const { html, profile } = await portablePage(htmlPath);
      response.writeHead(profile.ok ? 200 : 500, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      if (!profile.ok) { response.end(startupErrorPage(profile)); return; }
      if (startup.fallbackFrom) {
        const info = JSON.stringify(startup).replace(/</g, '\\u003c');
        response.end(html.replace('</body>', `<script type="application/json" id="sig-assist-connector-startup">${info}</script><aside id="sig-assist-port-notice" role="status" style="position:fixed;bottom:16px;left:16px;right:16px;z-index:9999;background:#fff8dd;color:#292211;border:1px solid #b69539;padding:12px;border-radius:8px;font:14px system-ui">Connector opened on port ${startup.actualPort} because port ${startup.fallbackFrom} is busy. Saved browser cases belong to their original address. To return to that address, close your earlier Sig-Assist connector window and relaunch. <button id="sig-assist-dismiss-port-notice" type="button">Dismiss</button></aside></body>`));
      } else response.end(html);
      return;
    }
    if (request.method !== 'POST' || request.url !== '/connector/query') { send(404, { ok: false, error: 'Unknown local connector endpoint.' }); return; }
    const requestId = randomUUID(); const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    response.on('close', () => { if (!response.writableEnded) controller.abort(); });
    let config;
    try {
      config = JSON.parse(await limitedText(request, 64 * 1024));
      const query = makeQuery(config);
      log('query.begin', { requestId, method: 'GET', endpoint: '/api_query', ...query.params });
      // Fixed endpoint + GET only. No browser session or HAR credentials are reused.
      const upstream = await fetchImpl(query.url, { method: 'GET', headers: query.headers, signal: controller.signal, redirect: 'manual' });
      const body = upstream.body ? await limitedText(upstream.body, maxBytes) : '';
      const result = { requestId, bridgeBuildId, runtime: process.version, ok: upstream.ok, status: upstream.status, contentType: upstream.headers.get('content-type'), serverDate: upstream.headers.get('date'), elapsedMs: Date.now() - started, bytes: Buffer.byteLength(body) };
      log('query.end', result);
      const error = upstream.ok ? undefined : upstream.status === 401 || upstream.status === 403 ? 'Iguana rejected this account or its log/channel permissions.' : `Iguana returned HTTP ${upstream.status}; check the base URL and authentication mode.`;
      send(200, { ...result, body, error });
    } catch (error) {
      const code = controller.signal.aborted ? 'TIMEOUT_OR_STOPPED' : error.cause?.code ?? 'CONNECTOR_ERROR';
      // Fetch exceptions may contain credential-bearing URLs. Export only a safe category.
      const message = code === 'TIMEOUT_OR_STOPPED' ? 'Iguana request timed out or was stopped.' : code === 'ENOTFOUND' ? 'Iguana hostname could not be resolved from this computer.' : code === 'ECONNREFUSED' ? 'Iguana refused the connection; check host and port.' : code === 'CONNECTOR_ERROR' && error.message && !error.message.includes('http') ? error.message : `Iguana request failed (${code}); check network, URL, account, or TLS configuration.`;
      log('query.failed', { requestId, code, error: message, elapsedMs: Date.now() - started });
      send(200, { requestId, ok: false, code, error: message, elapsedMs: Date.now() - started });
    } finally { clearTimeout(timer); }
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const failed = error => { server.off('listening', ready); reject(error); };
    const ready = () => { server.off('error', failed); resolve(server.address().port); };
    server.once('error', failed); server.once('listening', ready); server.listen(port, '127.0.0.1');
  });
}
async function matchingBridge(port, pageSha256) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/connector/health`, { signal: AbortSignal.timeout(500), redirect: 'error' });
    if (!response.ok) return false;
    const health = JSON.parse(await limitedText(response.body, 32 * 1024));
    return health.service === service && health.protocolVersion === 1 && health.readOnly === true && health.bridgeBuildId === bridgeBuildId && health.page?.ok === true && health.page.sha256 === pageSha256;
  } catch { return false; }
}
// A second launch must neither stop an unrelated listener nor open an old build.
// Reuse a matching bridge; otherwise search nearby ports, then let Windows pick.
export async function startBridge({ port = 4190, htmlPath = path.join(here, '../windows-demo/index.html'), onNotice = console.log } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('SIG_ASSIST_CONNECTOR_PORT must be an integer from 0 to 65535.');
  const { profile } = await portablePage(htmlPath);
  const candidates = port === 0 ? [0] : [...Array.from({ length: Math.min(20, 65536 - port) }, (_, i) => port + i), 0];
  for (const candidate of candidates) {
    const startup = { requestedPort: port };
    const server = createBridge({ htmlPath, startup });
    try {
      const actualPort = await listen(server, candidate);
      Object.assign(startup, { actualPort, ...(port && actualPort !== port ? { fallbackFrom: port } : {}) });
      if (startup.fallbackFrom) onNotice(`Port ${port} is occupied. Using port ${actualPort}. Saved browser cases stay at their original address; close your earlier Sig-Assist connector and relaunch to return there.`);
      return { server, reused: false, port: actualPort, url: `http://127.0.0.1:${actualPort}/` };
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (profile.ok && await matchingBridge(candidate, profile.sha256)) {
        onNotice(`Reusing the matching Sig-Assist connector already running on port ${candidate}. Keep its original console window open.`);
        return { server: null, reused: true, port: candidate, url: `http://127.0.0.1:${candidate}/` };
      }
      onNotice(`Port ${candidate} is busy and does not match this Sig-Assist build. Checking another port.`);
    }
  }
  throw new Error('No local connector port could be opened.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SIG_ASSIST_CONNECTOR_PORT ?? 4190);
  const packaged = path.join(here, 'index.html');
  let htmlPath;
  try { await readFile(packaged); htmlPath = packaged; } catch { htmlPath = path.join(here, '../windows-demo/index.html'); }
  try {
    const { profile } = await portablePage(htmlPath);
    log('startup.page', { bridgeBuildId, runtime: process.version, ...profile });
    const { url, reused } = await startBridge({ port, htmlPath });
    console.log(`Sig-Assist read-only Iguana connector: ${url}\n${reused ? 'The existing connector remains running.' : 'Keep this window open. Stop with Ctrl+C.'} Configure Iguana in Order Queue.`);
    if (process.platform === 'win32' && !process.argv.includes('--no-browser')) spawn('cmd.exe', ['/d', '/c', 'start', '', url], { stdio: 'ignore' });
  } catch (error) {
    console.error(`Connector could not start: ${error.code ? `${error.code}: ` : ''}${error.message}`); process.exitCode = 1;
  }
}
