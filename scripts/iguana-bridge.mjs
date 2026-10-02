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
const log = (stage, details) => console.log(JSON.stringify({ time: new Date().toISOString(), stage, ...details }));

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

export function createBridge({ htmlPath = path.join(here, '../windows-demo/index.html'), fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  return createServer(async (request, response) => {
    const send = (status, object) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(object)); };
    if (request.method === 'GET' && request.url === '/connector/health') { send(200, { ok: true, readOnly: true, upstreamEndpoints: ['GET /api_query'], runtime: process.version }); return; }
    if (request.method === 'GET' && request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (request.method === 'GET' && request.url === '/') {
      try { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(await readFile(htmlPath)); }
      catch { send(500, { ok: false, error: 'Portable index.html missing. Run npm run build:demo or extract the complete ZIP.' }); }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SIG_ASSIST_CONNECTOR_PORT ?? 4190);
  const packaged = path.join(here, 'index.html');
  let htmlPath;
  try { await readFile(packaged); htmlPath = packaged; } catch { htmlPath = path.join(here, '../windows-demo/index.html'); }
  const server = createBridge({ htmlPath });
  server.on('error', error => { console.error(`Connector could not listen on localhost:${port}: ${error.code}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Sig-Assist read-only Iguana connector: ${url}\nKeep this window open. Stop with Ctrl+C. Configure Iguana in Order Queue.`);
    if (process.platform === 'win32' && !process.argv.includes('--no-browser')) spawn('cmd.exe', ['/d', '/c', 'start', '', url], { stdio: 'ignore' });
  });
}
