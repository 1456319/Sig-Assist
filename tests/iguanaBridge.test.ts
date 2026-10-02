// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
// Runtime script deliberately uses no package dependencies.
// @ts-expect-error JavaScript bridge is tested in its native Node runtime.
import { createBridge, makeQuery } from '../scripts/iguana-bridge.mjs';

const servers: Server[] = [];
const config = { serverUrl: '', username: 'demo', password: 'test-secret', authMode: 'parameters', channel: 'MessageBroker', after: '2026/10/02 00:00:00', before: '', filter: 'DEMO-PON', limit: 20 };
async function listen(server: Server) { servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${(server.address() as AddressInfo).port}`; }
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }))); });

describe('local read-only bridge', () => {
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
  it('validates query bounds and supports a separate Basic authentication mode', () => {
    expect(() => makeQuery({ ...config, serverUrl: 'http://example.invalid', after: '' })).toThrow('After is required');
    expect(() => makeQuery({ ...config, serverUrl: 'http://example.invalid', limit: 5001 })).toThrow('1–5000');
    const result = makeQuery({ ...config, serverUrl: 'http://example.invalid', authMode: 'basic' });
    expect(result.url.searchParams.has('password')).toBe(false); expect(result.headers.Authorization).toMatch(/^Basic /);
  });
});
