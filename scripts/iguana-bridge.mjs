import { createServer } from 'node:http';
import { readFile, writeFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createDesktopSession, desktopBuildId } from './framework-desktop.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const maxBytes = 32 * 1024 * 1024;
const siteProfilePath = process.env.SIG_ASSIST_IGUANA_PROFILE || (path.basename(here) === 'scripts' ? path.join(here, '../config/iguana-site.json') : path.join(here, 'iguana-site.json'));
let siteProfileBytes;
try { siteProfileBytes = readFileSync(siteProfilePath); } catch { siteProfileBytes = Buffer.alloc(0); }
const bridgeBuildId = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).update(siteProfileBytes).digest('hex');
const service = 'sig-assist-iguana-connector';
const log = (stage, details) => console.log(JSON.stringify({ time: new Date().toISOString(), stage, ...details }));
const unavailableMessage = 'The order service is temporarily unavailable. Try the lookup again shortly; saved orders and manual translation are still available.';

export function loadSiteProfile() {
  try { return JSON.parse(siteProfileBytes.toString('utf8')); } catch { return undefined; }
}

function sameServer(config, profile) {
  if (!profile?.serverUrl) return false;
  const target = new URL(config.serverUrl), approved = new URL(profile.serverUrl);
  return target.origin === approved.origin && target.pathname.replace(/\/$/, '') === approved.pathname.replace(/\/$/, '');
}

function siteCredentials(config, profile) {
  if (!profile?.fallbackCredentials || !sameServer(config, profile)) return undefined;
  const { username, password } = profile.fallbackCredentials;
  return typeof username === 'string' && username && typeof password === 'string' && password ? { username, password } : undefined;
}

export function defaultHtmlPath() {
  if (process.env.SIG_ASSIST_HTML_PATH) return process.env.SIG_ASSIST_HTML_PATH;
  return path.basename(here) === 'scripts'
    ? path.join(here, '../windows-demo/index.html')
    : path.join(here, 'index.html');
}

function extractZipEntry(zipPath, targetFilename) {
  try {
    const buf = readFileSync(zipPath);
    const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const eocdOffset = buf.lastIndexOf(eocdSig);
    if (eocdOffset === -1) return null;
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const cdEntries = buf.readUInt16LE(eocdOffset + 10);
    let pos = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) break;
      const compression = buf.readUInt16LE(pos + 10);
      const compressedSize = buf.readUInt32LE(pos + 20);
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);
      const localHeaderOffset = buf.readUInt32LE(pos + 42);
      const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
      pos += 46 + nameLen + extraLen + commentLen;
      if (name === targetFilename || name === `./${targetFilename}` || name.endsWith(`/${targetFilename}`)) {
        if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
        const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
        const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compData = buf.subarray(dataOffset, dataOffset + compressedSize);
        if (compression === 0) return compData.toString('utf8');
        if (compression === 8) return inflateRawSync(compData).toString('utf8');
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
async function portablePage(htmlPath) {
  try {
    const html = await readFile(htmlPath, 'utf8');
    const ok = /<div\b[^>]*\bid=["']root["']/i.test(html) && /<script\b[^>]*type=["']module["'][^>]*>/i.test(html) && !/<(?:script|link)\b[^>]*(?:src|href)\s*=/i.test(html);
    return { html, profile: { ok, appVersion: /<meta name="sig-assist-version" content="([^"]+)"/.exec(html)?.[1] ?? null, path: path.resolve(htmlPath), bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), ...(ok ? {} : { error: 'This index.html is not the standalone build. It references source files or separate assets that this connector cannot serve.' }) } };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const isDemoPath = /windows-demo[\\/]index\.html$/i.test(htmlPath) || htmlPath === defaultHtmlPath();
      const zipCandidates = isDemoPath
        ? [path.join(path.dirname(htmlPath), 'Sig-Assist-Windows-Demo.zip'), path.join(here, '../windows-demo/Sig-Assist-Windows-Demo.zip'), path.join(here, 'Sig-Assist-Windows-Demo.zip')]
        : [path.join(path.dirname(htmlPath), 'Sig-Assist-Windows-Demo.zip')];
      for (const zipCandidate of zipCandidates) {
        const extracted = extractZipEntry(zipCandidate, 'index.html');
        if (extracted) {
          const ok = /<div\b[^>]*\bid=["']root["']/i.test(extracted) && /<script\b[^>]*type=["']module["'][^>]*>/i.test(extracted) && !/<(?:script|link)\b[^>]*(?:src|href)\s*=/i.test(extracted);
          if (ok) {
            try { await writeFile(htmlPath, extracted); } catch { /* ignore if destination directory is read-only */ }
            return { html: extracted, profile: { ok: true, path: path.resolve(htmlPath), bytes: Buffer.byteLength(extracted), sha256: createHash('sha256').update(extracted).digest('hex'), recoveredFrom: zipCandidate } };
          }
        }
      }
    }
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
  else if (config.authMode === 'parameters' || !config.authMode) { url.searchParams.set('username', config.username ?? ''); url.searchParams.set('password', config.password ?? ''); }
  else if (config.authMode !== 'login-page') throw new Error('Choose a supported authentication mode.');
  return { url, headers, params };
}

// Read server-supplied form values as data. Browser autofill and JavaScript-only
// values are deliberately not guessed, and no login response code is executed.
export function credentialsFromLoginPage(html) {
  const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, name) => {
    if (!name.startsWith('#')) return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[name.toLowerCase()];
    const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  });
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const candidates = [];
  for (const form of clean.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form\s*>/gi)) {
    const fields = { username: [], password: [] };
    for (const tag of form[1].matchAll(/<input\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
      const attrs = {};
      for (const a of tag[0].slice(6, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
        attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      }
      const name = (attrs.name || attrs.id || '').toLowerCase();
      if ((name === 'username' || name === 'password') && !Object.hasOwn(attrs, 'disabled')) fields[name].push(attrs.value || '');
    }
    if (fields.username.length === 1 && fields.password.length === 1 && fields.username[0] && fields.password[0]) {
      candidates.push({ username: fields.username[0], password: fields.password[0] });
    }
  }
  if (candidates.length !== 1) throw new Error('Iguana login form did not supply one unambiguous filled credential pair.');
  return candidates[0];
}

async function discoverLoginCredentials(config, fetchImpl, signal) {
  const loginUrl = new URL(config.serverUrl);
  loginUrl.pathname = `${loginUrl.pathname.replace(/\/$/, '')}/login.html`;
  loginUrl.search = ''; loginUrl.hash = '';
  const response = await fetchImpl(loginUrl, { method: 'GET', headers: { Accept: 'text/html' }, redirect: 'manual', signal });
  if (!response.ok || !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('content-type') || '')) {
    throw new Error(`Iguana login form could not be read (HTTP ${response.status}).`);
  }
  return credentialsFromLoginPage(response.body ? await limitedText(response.body, 512 * 1024) : '');
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

// An HTTP 200 login page or an unsuccessful XML envelope does not confirm access.
function successfulLogExport(body) {
  const xml = body.trim().replace(/^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*/, '');
  const root = xml.match(/^<export(?=[\s/>])((?:[^"'<>]|"[^"]*"|'[^']*')*)>/i);
  if (!root || /\ssuccess\s*=\s*["'](?:false|0)["']/i.test(root[1])) return false;
  if (root[1].endsWith('/')) return xml.length === root[0].length;
  return /<\/export\s*>$/i.test(xml);
}

async function executeQuery(config, { fetchImpl, signal, siteProfile, discoveryTimeoutMs }, query = makeQuery(config)) {
  const automatic = config.authMode === 'login-page';
  let credentials, authSource = config.authMode || 'parameters';
  const fallback = automatic ? siteCredentials(config, siteProfile) : undefined;
  if (automatic) {
    try {
      credentials = await discoverLoginCredentials(config, fetchImpl, AbortSignal.any([signal, AbortSignal.timeout(discoveryTimeoutMs)]));
      authSource = 'login-page';
    } catch {
      if (signal.aborted) throw signal.reason;
      credentials = fallback; authSource = 'site-profile';
    }
    if (!credentials) throw Object.assign(new Error(unavailableMessage), { code: 'AUTOMATIC_AUTH_UNAVAILABLE' });
  }
  async function read() {
    if (credentials) {
      query.url.searchParams.set('username', credentials.username);
      query.url.searchParams.set('password', credentials.password);
    }
    const response = await fetchImpl(query.url, { method: 'GET', headers: query.headers, signal, redirect: 'manual' });
    const body = response.body ? await limitedText(response.body, maxBytes) : '';
    const ok = response.ok && successfulLogExport(body);
    return { ok, status: response.status, body, contentType: response.headers.get('content-type'), serverDate: response.headers.get('date'), bytes: Buffer.byteLength(body),
      code: ok ? undefined : response.ok ? 'INVALID_LOG_EXPORT' : `IGUANA_HTTP_${response.status}` };
  }
  let result = await read();
  // One known, explicitly approved site account, never a password search. Do
  // not send the site's fallback to another host or retry a server outage.
  if (automatic && !result.ok && [200, 401, 403].includes(result.status) && fallback
      && (credentials.username !== fallback.username || credentials.password !== fallback.password)) {
    credentials = fallback; authSource = 'site-profile'; result = await read();
  }
  return { ...result, authSource, error: result.ok ? undefined : unavailableMessage };
}

export function createBridge({ htmlPath = defaultHtmlPath(), fetchImpl = fetch, timeoutMs = 20000, discoveryTimeoutMs = 3000, siteProfile = loadSiteProfile(), startup = {}, desktop = createDesktopSession() } = {}) {
  let connection = { state: 'not-checked' };
  let probe, probeController;
  const transport = { fetchImpl, siteProfile, discoveryTimeoutMs };
  let generation = 0;
  const record = (version, result) => {
    if (version === generation) connection = { state: result.ok ? 'connected' : 'unavailable', checkedAt: new Date().toISOString(), code: result.code, authSource: result.authSource };
  };
  const server = createServer(async (request, response) => {
    const send = (status, object) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(object)); };
    if (request.method === 'GET' && ['/connector/health', '/connector/diagnostics'].includes(request.url)) {
      const { profile } = await portablePage(htmlPath);
      send(200, { ok: true, service, protocolVersion: 1, bridgeBuildId, desktopBuildId: await desktopBuildId(), readOnly: true, readOnlyScope: 'Iguana upstream', desktopTransfer: true, upstreamEndpoints: ['GET /login.html', 'GET /api_query'], runtime: process.version, pid: process.pid, page: profile, startup, connection }); return;
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
    if (request.method === 'POST' && /^\/connector\/desktop\/(detect|inspect|target|send|docutrack)$/.test(request.url ?? '')) {
      // Local UI writes require a JSON request from this served page, never a
      // form POST from another site. No CORS access is granted.
      if (request.headers['content-type'] !== 'application/json' || (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) || request.headers['sec-fetch-site'] === 'cross-site') {
        send(403, { ok: false, error: 'Open Sig-Assist through this local connector to use Framework integration.' }); return;
      }
      try { send(200, await desktop(request.url.split('/').pop(), JSON.parse(await limitedText(request, 64 * 1024)))); }
      catch { send(400, { ok: false, error: 'Invalid desktop request.' }); }
      return;
    }
    if (request.method !== 'POST' || request.url !== '/connector/query') { send(404, { ok: false, error: 'Unknown local connector endpoint.' }); return; }
    const requestId = randomUUID(); const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    response.on('close', () => { if (!response.writableEnded) controller.abort(); });
    let config, version;
    try {
      config = JSON.parse(await limitedText(request, 64 * 1024));
      if (config.serverUrl === '') {
        if (!siteProfile?.serverUrl) throw new Error('Enter the Iguana base URL in Live connection settings.');
        config.serverUrl = siteProfile.serverUrl;
      }
      const query = makeQuery(config);
      if (sameServer(config, siteProfile) && config.channel === siteProfile.channel) version = ++generation;
      log('query.begin', { requestId, method: 'GET', endpoint: '/api_query', ...query.params });
      const { body, ...upstream } = await executeQuery(config, { ...transport, signal: controller.signal }, query);
      const result = { requestId, bridgeBuildId, runtime: process.version, ...upstream, elapsedMs: Date.now() - started };
      record(version, upstream);
      log('query.end', result);
      send(200, { ...result, ...(upstream.ok ? { body } : {}) });
    } catch (error) {
      const code = controller.signal.aborted ? 'TIMEOUT_OR_STOPPED' : error.cause?.code ?? error.code ?? 'CONNECTOR_ERROR';
      // Fetch exceptions may contain credential-bearing URLs. Export only a safe category.
      const message = config?.authMode === 'login-page' ? unavailableMessage
        : code === 'TIMEOUT_OR_STOPPED' ? 'Iguana request timed out or was stopped.' : code === 'ENOTFOUND' ? 'Iguana hostname could not be resolved from this computer.' : code === 'ECONNREFUSED' ? 'Iguana refused the connection; check host and port.' : code === 'CONNECTOR_ERROR' && error.message && !error.message.includes('http') ? error.message : `Iguana request failed (${code}); check network, URL, account, or TLS configuration.`;
      record(version, { ok: false, code });
      log('query.failed', { requestId, code, error: message, elapsedMs: Date.now() - started });
      send(200, { requestId, ok: false, code, error: message, elapsedMs: Date.now() - started });
    } finally { clearTimeout(timer); }
  });
  server.confirmConnection = () => {
    if (probe) return probe;
    probeController = new AbortController();
    const timer = setTimeout(() => probeController.abort(), timeoutMs);
    const version = ++generation;
    connection = { state: 'checking' };
    probe = Promise.resolve().then(async () => {
      try {
        if (!siteProfile?.serverUrl || !siteProfile?.channel) throw Object.assign(new Error('Missing site profile'), { code: 'SITE_PROFILE_UNAVAILABLE' });
        const day = new Date(); day.setDate(day.getDate() - 1); day.setHours(0, 0, 0, 0);
        const pad = n => String(n).padStart(2, '0');
        const config = { serverUrl: siteProfile.serverUrl, channel: siteProfile.channel, authMode: 'login-page', after: `${day.getFullYear()}/${pad(day.getMonth() + 1)}/${pad(day.getDate())} 00:00:00`, limit: 1 };
        const result = await executeQuery(config, { ...transport, signal: probeController.signal });
        // The probe neither returns order content nor touches the review queue.
        record(version, result);
      } catch (error) {
        record(version, { ok: false, code: probeController.signal.aborted ? 'TIMEOUT_OR_STOPPED' : error.cause?.code ?? error.code ?? 'CONNECTION_CHECK_FAILED' });
      } finally { clearTimeout(timer); probe = undefined; }
      return connection;
    });
    return probe;
  };
  server.on('close', () => probeController?.abort());
  return server;
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
    return health.service === service && health.protocolVersion === 1 && health.readOnly === true && health.bridgeBuildId === bridgeBuildId && health.desktopBuildId === await desktopBuildId() && health.page?.ok === true && health.page.sha256 === pageSha256;
  } catch { return false; }
}
// A second launch must neither stop an unrelated listener nor open an old build.
// Reuse a matching bridge; otherwise search nearby ports, then let Windows pick.
export async function startBridge({ port = 4190, htmlPath = defaultHtmlPath(), onNotice = console.log, checkConnectionOnStart = false, siteProfile = loadSiteProfile(), fetchImpl = fetch } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('SIG_ASSIST_CONNECTOR_PORT must be an integer from 0 to 65535.');
  const { profile } = await portablePage(htmlPath);
  const candidates = port === 0 ? [0] : [...Array.from({ length: Math.min(20, 65536 - port) }, (_, i) => port + i), 0];
  for (const candidate of candidates) {
    const startup = { requestedPort: port };
    const server = createBridge({ htmlPath, startup, siteProfile, fetchImpl });
    try {
      const actualPort = await listen(server, candidate);
      Object.assign(startup, { actualPort, ...(port && actualPort !== port ? { fallbackFrom: port } : {}) });
      if (startup.fallbackFrom) onNotice(`Port ${port} is occupied. Using port ${actualPort}. Saved browser cases stay at their original address; close your earlier Sig-Assist connector and relaunch to return there.`);
      if (checkConnectionOnStart) void server.confirmConnection();
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
  const htmlFlag = process.argv.indexOf('--html') >= 0 ? process.argv[process.argv.indexOf('--html') + 1] : undefined;
  const pageFlag = process.argv.indexOf('--page') >= 0 ? process.argv[process.argv.indexOf('--page') + 1] : undefined;
  let htmlPath = (htmlFlag && !htmlFlag.startsWith('--') ? htmlFlag : undefined)
    || (pageFlag && !pageFlag.startsWith('--') ? pageFlag : undefined)
    || process.env.SIG_ASSIST_HTML_PATH;
  if (!htmlPath) {
    const candidates = [
      path.join(here, 'index.html'),
      path.join(here, '../windows-demo/index.html'),
      path.join(process.cwd(), 'index.html'),
      path.join(process.cwd(), 'windows-demo', 'index.html'),
    ];
    for (const candidate of candidates) {
      try {
        await access(candidate);
        htmlPath = candidate;
        break;
      } catch { /* try next candidate */ }
    }
  }
  if (!htmlPath) htmlPath = defaultHtmlPath();
  try {
    const { profile } = await portablePage(htmlPath);
    log('startup.page', { bridgeBuildId, runtime: process.version, ...profile });
    const { url, reused } = await startBridge({ port, htmlPath, checkConnectionOnStart: true });
    console.log(`Sig-Assist read-only Iguana connector: ${url}\n${reused ? 'The existing connector remains running.' : 'Keep this window open. Stop with Ctrl+C.'} The order connection is checked automatically; use Sig-Assist normally.`);
    if (process.platform === 'win32' && !process.argv.includes('--no-browser')) spawn('cmd.exe', ['/d', '/c', 'start', '', url], { stdio: 'ignore' });
  } catch (error) {
    console.error(`Connector could not start: ${error.code ? `${error.code}: ` : ''}${error.message}`); process.exitCode = 1;
  }
}
