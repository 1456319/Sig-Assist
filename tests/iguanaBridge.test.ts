// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Runtime script deliberately uses no package dependencies.
// @ts-expect-error JavaScript bridge is tested in its native Node runtime.
import { createBridge, makeQuery, startBridge } from '../scripts/iguana-bridge.mjs';

const servers: Server[] = [];
const folders: string[] = [];
const config = { serverUrl: '', username: 'demo', password: 'test-secret', authMode: 'parameters', channel: 'MessageBroker', after: '2026/10/02 00:00:00', before: '', filter: 'DEMO-PON', limit: 20 };
async function listen(server: Server) { servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${(server.address() as AddressInfo).port}`; }
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
  await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
});
async function pageFile(html: string) {
  const folder = await mkdtemp(path.join(tmpdir(), 'sig-bridge-')); folders.push(folder);
  const htmlPath = path.join(folder, 'index.html'); await writeFile(htmlPath, html); return htmlPath;
}
const portableHtml = '<!DOCTYPE html><html><body><div id="root"></div><script type="module">document.getElementById("root").textContent="READY";</script></body></html>';
async function start(options: Record<string, unknown> = {}) {
  const result = await startBridge({ port: 0, onNotice: () => {}, ...options });
  if (result.server) servers.push(result.server); return result;
}

describe('local read-only bridge', () => {
  it('isolates desktop operations and rejects cross-origin and non-JSON requests', async () => {
    const calls: string[] = [];
    const bridge = await listen(createBridge({ desktop: async (action: string) => { calls.push(action); return { ok: true }; } }));
    const url = `${bridge}/connector/desktop/detect`;
    expect((await fetch(url, { method: 'POST', body: '{}' })).status).toBe(403);
    expect((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' }, body: '{}' })).status).toBe(403);
    expect(calls).toEqual([]);
    expect(await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: bridge }, body: '{}' })).json()).toEqual({ ok: true });
    expect(calls).toEqual(['detect']);
    expect((await fetch(`${bridge}/connector/desktop/submit`, { method: 'POST' })).status).toBe(404);
  });
  it('serves health and sends only GET api_query requests, including Info logs', async () => {
    const calls: { method?: string; url?: string }[] = [];
    const upstream = await listen(createServer((request, response) => { calls.push({ method: request.method, url: request.url }); response.setHeader('content-type', 'application/xml'); response.end('<export/>'); }));
    const bridge = await listen(createBridge());
    expect(await (await fetch(`${bridge}/connector/health`)).json()).toMatchObject({ readOnly: true });
    const response = await fetch(`${bridge}/connector/query`, { method: 'POST', body: JSON.stringify({ ...config, serverUrl: upstream }) });
    expect(await response.json()).toMatchObject({ ok: true, body: '<export/>', status: 200 });
    expect(calls).toHaveLength(1); expect(calls[0].method).toBe('GET');
    const url = new URL(calls[0].url!, upstream);
    expect(url.pathname).toBe('/api_query'); expect(url.searchParams.get('type')).toContain('info'); expect(url.searchParams.get('reverse')).toBe('false');
    expect((await fetch(`${bridge}/update_channel`, { method: 'POST' })).status).toBe(404);
    expect(calls).toHaveLength(1);
  });
  it('reports 401/403 and connection timeouts without returning credential-bearing errors', async () => {
    const rejected = await listen(createServer((_request, response) => { response.writeHead(403); response.end('private server response'); }));
    const bridge = await listen(createBridge({ timeoutMs: 40 }));
    const query = (serverUrl: string) => fetch(`${bridge}/connector/query`, { method: 'POST', body: JSON.stringify({ ...config, serverUrl }) }).then(r => r.json());
    expect(await query(rejected)).toMatchObject({ ok: false, status: 403 });
    const slow = await listen(createServer(() => {}));
    const timeout = await query(slow);
    expect(timeout).toMatchObject({ ok: false, code: 'TIMEOUT_OR_STOPPED' });
    expect(JSON.stringify(timeout)).not.toContain('test-secret');
  });
  it('authenticates every query without relying on a 15-minute browser session', async () => {
    let elapsedMinutes = 0;
    const calls: { minute: number; username: string | null; password: string | null; cookie?: string }[] = [];
    const upstream = await listen(createServer((request, response) => {
      const url = new URL(request.url!, 'http://localhost');
      const username = url.searchParams.get('username');
      const password = url.searchParams.get('password');
      calls.push({ minute: elapsedMinutes, username, password, cookie: request.headers.cookie });
      const validCredentials = username === config.username && password === config.password;
      const validBrowserSession = elapsedMinutes < 15 && request.headers.cookie === 'session=synthetic';
      response.writeHead(validCredentials || validBrowserSession ? 200 : 401, {
        'Content-Type': 'application/xml', 'Set-Cookie': 'session=synthetic; Max-Age=900',
      });
      response.end(validCredentials || validBrowserSession ? '<export success="true"/>' : '<export success="false"/>');
    }));
    const bridge = await listen(createBridge());
    for (const minute of [0, 16, 31]) {
      elapsedMinutes = minute;
      const result = await fetch(`${bridge}/connector/query`, { method: 'POST', body: JSON.stringify({ ...config, serverUrl: upstream }) });
      expect(await result.json()).toMatchObject({ ok: true, status: 200, body: '<export success="true"/>' });
    }
    expect(calls).toEqual([0, 16, 31].map(minute => ({ minute, username: config.username, password: config.password, cookie: undefined })));
  });
  it('validates query bounds and supports a separate Basic authentication mode', () => {
    expect(() => makeQuery({ ...config, serverUrl: 'http://example.invalid', after: '' })).toThrow('After is required');
    expect(() => makeQuery({ ...config, serverUrl: 'http://example.invalid', limit: 5001 })).toThrow('1–5000');
    const result = makeQuery({ ...config, serverUrl: 'http://example.invalid', authMode: 'basic' });
    expect(result.url.searchParams.has('password')).toBe(false); expect(result.headers.Authorization).toMatch(/^Basic /);
  });
  it('serves a valid portable page at root and index.html with a matching page fingerprint', async () => {
    const htmlPath = await pageFile(portableHtml);
    const result = await start({ htmlPath });
    expect(result.port).toBeGreaterThan(0);
    for (const pathname of ['/', '/index.html']) expect(await (await fetch(new URL(pathname, result.url))).text()).toBe(portableHtml);
    const health = await (await fetch(new URL('/connector/health', result.url))).json();
    expect(health).toMatchObject({ service: 'sig-assist-iguana-connector', protocolVersion: 1, startup: { requestedPort: 0, actualPort: result.port }, page: { ok: true, path: htmlPath } });
    expect(health.page.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('reuses the same bridge without starting another process or changing the origin', async () => {
    const htmlPath = await pageFile(portableHtml);
    const first = await start({ htmlPath });
    const second = await start({ htmlPath, port: first.port });
    expect(second).toMatchObject({ reused: true, server: null, url: first.url });
    expect((await fetch(first.url)).status).toBe(200);
  });
  it('opens a new port when another listener occupies the requested one and leaves it running', async () => {
    const occupied = await listen(createServer((_request, response) => { response.end('Unrelated application'); }));
    const port = Number(new URL(occupied).port);
    const result = await start({ htmlPath: await pageFile(portableHtml), port });
    expect(result.port).not.toBe(port); expect(result.reused).toBe(false);
    expect(await (await fetch(occupied)).text()).toBe('Unrelated application');
    expect(await (await fetch(result.url)).text()).toContain('Saved browser cases belong to their original address');
    const health = await (await fetch(new URL('/connector/diagnostics', result.url))).json();
    expect(health.startup).toMatchObject({ requestedPort: port, actualPort: result.port, fallbackFrom: port });
    expect((await start({ htmlPath: health.page.path, port })).url).toBe(result.url);
  });
  it('does not reuse an outdated bridge even when its page fingerprint matches', async () => {
    const htmlPath = await pageFile(portableHtml);
    const current = await start({ htmlPath });
    const health = await (await fetch(new URL('/connector/health', current.url))).json();
    const stale = await listen(createServer((_request, response) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ ...health, bridgeBuildId: 'old-build' })); }));
    const result = await start({ htmlPath, port: Number(new URL(stale).port) });
    expect(result.reused).toBe(false); expect(result.url).not.toBe(`${stale}/`);
  });
  it('does not reuse the current bridge script when it serves an older page', async () => {
    const older = await start({ htmlPath: await pageFile(portableHtml.replace('READY', 'OLDER BUILD')) });
    const updated = await start({ htmlPath: await pageFile(portableHtml), port: older.port });
    expect(updated.reused).toBe(false); expect(updated.port).not.toBe(older.port);
    expect(await (await fetch(older.url)).text()).toContain('OLDER BUILD');
  });
  it('shows an actionable HTML error instead of serving a source shell or missing page', async () => {
    for (const html of ['<div id="root"></div><script type="module" src="/src/main.tsx"></script>', '<div id="root"></div><script type="module" src="/assets/app.js"></script>']) {
      const result = await start({ htmlPath: await pageFile(html) });
      const response = await fetch(result.url); expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain('not the standalone build');
      expect((await (await fetch(new URL('/connector/health', result.url))).json()).page.ok).toBe(false);
    }
    const result = await start({ htmlPath: path.join(tmpdir(), 'sig-assist-nonexistent-file.html') });
    const response = await fetch(result.url); expect(response.status).toBe(500);
    expect(await response.text()).toContain('Extract the entire Windows Demo ZIP');
  });
  it('rejects invalid configured ports clearly', async () => {
    for (const port of [-1, 65536, 4190.5, NaN]) await expect(start({ port })).rejects.toThrow('SIG_ASSIST_CONNECTOR_PORT');
  });
});
