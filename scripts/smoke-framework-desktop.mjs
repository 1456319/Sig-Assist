import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { helperExecutable } from './framework-desktop.mjs';
const exec = promisify(execFile);
if (process.platform !== 'win32') throw new Error('This smoke test needs Windows UI Automation.');
const folder = await mkdtemp(path.join(tmpdir(), 'sig-desktop-'));
let app;
async function until(predicate) {
  const end = Date.now() + 10000;
  while (Date.now() < end) { try { if (await predicate()) return; } catch { /* starting */ } await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Synthetic window did not become ready.');
}
try {
  const helper = await helperExecutable();
  const exe = path.join(folder, 'SigAssistFrameworkFixture.exe');
  const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework/v4.0.30319/csc.exe');
  await exec(compiler, ['/nologo', '/target:winexe', `/out:${exe}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', path.resolve('tests', 'fixtures', 'FrameworkDesktopFixture.cs')]);
  app = spawn(exe, [folder], { stdio: 'ignore' });
  await until(() => readFile(path.join(folder, 'ready')));
  const run = input => new Promise((resolve, reject) => {
    const child = execFile(helper, ['--test-process', 'SigAssistFrameworkFixture'], { timeout: 20000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error); else { try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); } }
    }); child.stdin.end(JSON.stringify(input));
  });
  async function command(changes) {
    const text = JSON.stringify({ nonce: String(Date.now()), ...changes });
    await writeFile(path.join(folder, 'command.json'), text);
    await until(async () => await readFile(path.join(folder, 'ack.json'), 'utf8') === text);
  }
  const first = await run({ action: 'detect' });
  assert.equal(first.ok, true, JSON.stringify(first)); assert.equal(first.pon, 'SYNTHETIC-1');
  assert.equal(first.fields.sig.value, 'OLD SIG'); assert.equal(first.fields.times.value, '0900, 2100');
  const written = await run({ action: 'send', expected: first, field: 'sig', value: '1T PO BID — REVIEWED' });
  assert.equal(written.verified, true, JSON.stringify(written));
  const times = await run({ action: 'send', expected: written.detected, field: 'times', value: '0800, 2000' });
  assert.equal(times.verified, true, JSON.stringify(times));
  const beforeChange = await run({ action: 'detect' });
  await command({ pon: 'SYNTHETIC-2' });
  const changed = await run({ action: 'send', expected: beforeChange, field: 'sig', value: 'TECH APPROVED CURRENT ORDER' });
  assert.equal(changed.verified, true, JSON.stringify(changed));
  assert.ok(changed.warnings.some(w => w.includes('PONs changed')));
  const beforeEdit = await run({ action: 'detect' }); await command({ sig: 'TECH EDIT' });
  const replaced = await run({ action: 'send', expected: beforeEdit, field: 'sig', value: 'APPROVED REPLACEMENT' });
  assert.equal(replaced.verified, true); assert.ok(replaced.warnings.some(w => w.includes('destination text changed')));
  await command({ duplicate: 'true', pon: 'SYNTHETIC-1' });
  const multiple = await run({ action: 'detect' });
  assert.equal(multiple.ok, true); assert.equal(multiple.pons.length, 2);
  const withWarning = await run({ action: 'send', expected: multiple, field: 'sig', value: 'APPROVED WITH TWO PONS' });
  assert.equal(withWarning.verified, true); assert.ok(withWarning.warnings.some(w => w.includes('Multiple PONs')));
  await command({ readonly: 'true' }); assert.equal((await run({ action: 'detect' })).fields.sig, undefined);
  const readOnly = await run({ action: 'send', expected: multiple, field: 'sig', value: 'CANNOT WRITE READONLY' });
  assert.equal(readOnly.ok, false);
  await command({ readonly: 'false', sigLabel: 'Custom text field', focus: 'sig' });
  assert.equal((await run({ action: 'detect' })).fields.sig, undefined);
  const picked = await run({ action: 'target', field: 'sig' });
  assert.equal(picked.ok, true, JSON.stringify(picked)); assert.equal(picked.fields.sig.manual, true);
  const manual = await run({ action: 'send', expected: picked, field: 'sig', value: 'APPROVED EXPLICIT TARGET' });
  assert.equal(manual.verified, true, JSON.stringify(manual));
  console.log('Windows UI Automation passed: PON detection, SIG/times read-back, technician-approved context changes, multiple-PON warnings, readonly refusal and explicit field selection.');

} finally { app?.kill(); await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
