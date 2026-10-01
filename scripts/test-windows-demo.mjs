import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../windows-demo/', import.meta.url));
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const command = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const child = spawn(command, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${root}serve.ps1`, '-NoBrowser', '-Port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
let launchError;
child.on('error', error => { launchError = error; });
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
const url = `http://127.0.0.1:${port}`;

try {
  let ready = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for PowerShell startup. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Server did not become ready: ${output}`);
  const response = await fetch(url);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.equal(html, await readFile(`${root}app/index.html`, 'utf8'));
  const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map(match => match[1]);
  assert.ok(assets.length >= 2, 'Built JS and CSS are referenced');
  for (const asset of assets) {
    const assetResponse = await fetch(new URL(asset, url));
    assert.equal(assetResponse.status, 200, asset);
    assert.match(assetResponse.headers.get('content-type'), asset.endsWith('.js') ? /javascript/ : /text\/css/);
    assert.ok((await assetResponse.arrayBuffer()).byteLength > 0);
  }
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${url}/missing.js`)).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  console.log('Windows demo server passed: HTML, JS, CSS, HEAD, missing asset and unsupported method.');
} finally {
  child.kill();
}
