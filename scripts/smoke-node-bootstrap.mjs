// CI harness only. The user launcher itself requires no Node, npm or PowerShell.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (process.platform !== 'win32') throw new Error('Run this launcher check on Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'sig-node-bootstrap-'));
const folder = path.join(temp, 'launcher folder ! & (test)');
const profile = path.join(temp, 'user profile ! & (test)');
const launcher = path.join(folder, 'Start-Iguana-Connector.bat');
const source = await readFile(path.join(root, 'windows-demo/Start-Iguana-Connector.bat'), 'utf8');
const version = source.match(/set "SIG_VERSION=([\d.]+)"/)[1];
const expectedHash = source.match(/if "%SIG_ARCH%"=="x64" set "SIG_SHA=([a-f0-9]{64})"/)[1];
const cachedNode = path.join(profile, 'Sig-Assist', 'runtime', `node-v${version}-win-x64`, 'node.exe');
// Windows keys are case-insensitive. Canonicalize before overriding so Node's
// case-variant de-duplication cannot silently select an inherited value.
const env = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key.toUpperCase(), value]));
env.LOCALAPPDATA = profile;
env.PATH = path.join(process.env.SystemRoot, 'System32');
env.PROCESSOR_ARCHITECTURE = 'AMD64';
delete env.PROCESSOR_ARCHITEW6432;
let live;
let occupied;
function run(file, args, environment = env) {
  const child = spawn(process.env.ComSpec, ['/d', '/s', '/c', `""${file}" ${args}"`], {
    cwd: process.env.SystemRoot, env: environment, windowsVerbatimArguments: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      spawn(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F']);
      reject(new Error(`Launcher timed out: ${output}`));
    }, 420000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); resolve({ code, output }); });
  });
  return { child, done, output: () => output };
}
async function check(file = launcher, environment = env) {
  const result = await run(file, '--check', environment).done;
  if (result.code !== 0) throw new Error(result.output);
  return result.output;
}
try {
  const probe = spawnSync(process.env.ComSpec, ['/d', '/c', 'set PROCESSOR'], { env, encoding: 'utf8' });
  console.log(`Setup test architecture environment: ${probe.stdout.trim()}`);
  assert.match(probe.stdout, /PROCESSOR_ARCHITECTURE=AMD64/i);
  await mkdir(folder, { recursive: true });
  await writeFile(launcher, source);
  await cp(path.join(root, 'scripts/iguana-bridge.mjs'), path.join(folder, 'iguana-bridge.mjs'));
  await cp(path.join(root, 'windows-demo/index.html'), path.join(folder, 'index.html'));

  // Missing Node: real official download, real certutil checksum, user-only cache.
  const first = await check();
  assert.match(first, /Setting up Node.js/);
  assert.match(first, /Verifying the official SHA-256/);
  const bytes = await readFile(cachedNode);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  assert.ok((await stat(cachedNode)).size > 1000000);
  assert.match(first, new RegExp(`v${version.replaceAll('.', '\\.')}`));
  console.log('PASS: without Node on PATH, the actual BAT downloads, verifies and runs a private user runtime in a path with spaces, !, & and parentheses.');

  // Second launch reuses the exact cache; there is no network setup.
  const reused = await check();
  assert.doesNotMatch(reused, /Downloading|Setting up/);
  assert.equal((await readFile(cachedNode)).equals(bytes), true);
  console.log('PASS: cached runtime reused without downloading again.');

  // Existing PATH Node is selected even with no writable user profile.
  const installed = await check(launcher, { ...env, PATH: `${path.dirname(process.execPath)};${env.PATH}`, LOCALAPPDATA: '' });
  assert.doesNotMatch(installed, /Downloading|Setting up/);
  console.log('PASS: compatible installed Node reused without requiring profile setup.');

  // An offline portable copy is also supported.
  await cp(cachedNode, path.join(folder, 'node.exe'));
  const portable = await check(launcher, { ...env, LOCALAPPDATA: '' });
  assert.doesNotMatch(portable, /Downloading|Setting up/);
  await rm(path.join(folder, 'node.exe'));
  console.log('PASS: offline node.exe beside the launcher works without an installation.');

  // Start the real connector with downloaded Node, without opening a browser.
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  live = run(launcher, '--no-browser', { ...env, SIG_ASSIST_CONNECTOR_PORT: String(port) });
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/connector/health`, { signal: AbortSignal.timeout(1000) });
      assert.equal((await response.json()).readOnly, true);
      healthy = true; break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.equal(healthy, true, live.output());
  assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), await readFile(path.join(folder, 'index.html'), 'utf8'));
  console.log('PASS: downloaded runtime starts the real read-only connector and serves the portable app.');
  const duplicate = run(launcher, '--no-browser', { ...env, SIG_ASSIST_CONNECTOR_PORT: String(port) });
  duplicate.child.stdin.end('\r\n');
  const reopened = await duplicate.done;
  assert.equal(reopened.code, 0, reopened.output);
  assert.match(reopened.output, /Reusing the matching Sig-Assist connector/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/connector/health`)).status, 200);
  console.log('PASS: launching the actual BAT twice reuses the existing matching connector and preserves its origin.');
  spawn(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(live.child.pid), '/T', '/F']);
  await live.done; live = undefined;

  occupied = createHttpServer((_request, response) => response.end('Unrelated listener'));
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const busyPort = occupied.address().port;
  live = run(launcher, '--no-browser', { ...env, SIG_ASSIST_CONNECTOR_PORT: String(busyPort) });
  let fallbackUrl;
  for (let i = 0; i < 100; i++) {
    fallbackUrl = live.output().match(/Sig-Assist read-only Iguana connector: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
    if (fallbackUrl) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(fallbackUrl, live.output());
  assert.notEqual(Number(new URL(fallbackUrl).port), busyPort);
  assert.equal(await (await fetch(`http://127.0.0.1:${busyPort}/`)).text(), 'Unrelated listener');
  const fallbackHealth = await (await fetch(new URL('/connector/health', fallbackUrl))).json();
  assert.equal(fallbackHealth.startup.fallbackFrom, busyPort);
  assert.match(await (await fetch(fallbackUrl)).text(), /Saved browser cases belong to their original address/);
  console.log('PASS: an occupied port is handled by the actual BAT without stopping the unrelated listener; the page explains browser storage.');
  spawn(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(live.child.pid), '/T', '/F']);
  await live.done; live = undefined;
  await new Promise(resolve => { occupied.closeAllConnections(); occupied.close(resolve); }); occupied = undefined;

  // A failed verification must never create an executable cache. Change only
  // the isolated test copy's expected digest; the shipped pin stays untouched.
  const wrongHash = path.join(folder, 'wrong-hash.bat');
  await writeFile(wrongHash, source.replace(expectedHash, '0'.repeat(64)));
  const badProfile = path.join(temp, 'bad-hash-user');
  const failed = await run(wrongHash, '--check', { ...env, LOCALAPPDATA: badProfile }).done;
  assert.equal(failed.code, 1, failed.output);
  assert.match(failed.output, /checksum could not be verified/);
  const badRuntime = path.join(badProfile, 'Sig-Assist/runtime', `node-v${version}-win-x64`);
  await assert.rejects(stat(path.join(badRuntime, 'node.exe')));
  assert.match(await readFile(path.join(badRuntime, 'node-setup.log'), 'utf8'), /Download=https:\/\/nodejs.org/);
  console.log('PASS: checksum failure leaves no executable and preserves a diagnostic setup log.');

  const blocked = path.join(temp, 'unwritable-profile');
  await writeFile(blocked, 'This is a file, not a writable profile directory.');
  const denied = await run(launcher, '--check', { ...env, LOCALAPPDATA: blocked }).done;
  assert.equal(denied.code, 1, denied.output);
  assert.match(denied.output, /Cannot write the user runtime folder/);
  console.log('PASS: an unwritable user folder reports the cause and exits without elevation.');
} finally {
  if (live) {
    spawn(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(live.child.pid), '/T', '/F']);
    await live.done;
  }
  if (occupied) await new Promise(resolve => { occupied.closeAllConnections(); occupied.close(resolve); });
  await rm(temp, { recursive: true, force: true });
}
