import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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
  await command({ pon: 'SYNTHETIC:0001' });
  assert.equal((await run({ action: 'detect' })).pon, 'SYNTHETIC:0001');
  await command({ pon: '', ponLabel: 'Prescriber Order Number: SYNTHETIC:0002' });
  assert.equal((await run({ action: 'detect' })).pon, 'SYNTHETIC:0002');
  await command({ pon: 'SYNTHETIC-1', ponLabel: 'PON' });
  await command({ focus: 'sig' });
  const entry = await run({ action: 'window' });
  assert.equal(entry.ok, true, JSON.stringify(entry)); assert.equal(entry.entryWindow.pid, app.pid);
  assert.equal(entry.scanMode, 'chosen-entry');
  const remembered = await run({ action: 'detect', entryWindow: entry.entryWindow });
  assert.equal(remembered.pon, 'SYNTHETIC-1'); assert.equal(remembered.diagnostics.windowsScanned, 1);
  // The dataset reader is a separate passive action. It does not recover,
  // scroll, transfer, infer completion, or return unrelated field values.
  assert.equal((await run({ action: 'dataset-snapshot' })).code, 'SELECTION_REQUIRED');
  const dataset = () => run({ action: 'dataset-snapshot', entryWindow: entry.entryWindow });
  const captured = await dataset();
  assert.deepEqual(captured, { ok: true, code: 'OK', pon: 'SYNTHETIC-1', sig: 'OLD SIG', partial: false });
  assert.doesNotMatch(JSON.stringify(captured), /SOURCE SIG|PREVIEW SIG|PAT-1|FAC-1|Synthetic tablet|PRIVATE VALUE/);
  await command({ pon: 'SYNTHETIC:0003', sig: 'HUMAN EDIT OBSERVED', focus: 'quantity' });
  assert.deepEqual(await dataset(), { ok: true, code: 'OK', pon: 'SYNTHETIC:0003', sig: 'HUMAN EDIT OBSERVED', partial: false });
  await command({ snapshot: 'true' });
  assert.equal(JSON.parse(await readFile(path.join(folder, 'state.json'), 'utf8')).focus, 'quantity');
  await command({ duplicate: 'true' }); assert.equal((await dataset()).code, 'PON_AMBIGUOUS');
  await command({ duplicate: 'false', duplicateSig: 'true' }); assert.equal((await dataset()).code, 'SIG_AMBIGUOUS');
  await command({ duplicateSig: 'false', hidePon: 'true' }); assert.equal((await dataset()).code, 'PON_UNAVAILABLE');
  await command({ hidePon: 'false', ponOutside: 'true' }); assert.equal((await dataset()).code, 'PON_UNAVAILABLE');
  await command({ ponOutside: 'false', hideSig: 'true' }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  await command({ hideSig: 'false', sigPassword: 'true' }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  await command({ sigPassword: 'false', sigLabel: 'Linked SIG' }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  await command({ sigLabel: 'SIG', otherOrder: 'true' }); assert.equal((await dataset()).code, 'CURRENT_ORDER_AMBIGUOUS');
  await command({ otherOrder: 'false', readonly: 'true' }); assert.equal((await dataset()).sig, 'HUMAN EDIT OBSERVED');
  await command({ richSig: 'true' }); assert.equal((await dataset()).sig, 'RICH SIG PRIVATE VALUE');
  await command({ richSigText: 'FIRST LINE\nSECOND LINE' }); assert.equal((await dataset()).sig, 'FIRST LINE\rSECOND LINE');
  await command({ richSigText: 'x'.repeat(4000) }); assert.equal((await dataset()).sig, 'x'.repeat(4000));
  await command({ richSigText: 'x'.repeat(4001) }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  await command({ richSig: 'false', sig: 'x'.repeat(4001) }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  assert.equal((await run({ action: 'dataset-snapshot', entryWindow: { ...entry.entryWindow, id: 'replaced-window' } })).code, 'WINDOW_UNAVAILABLE');
  await command({ pon: 'SYNTHETIC-1', sig: 'OLD SIG', readonly: 'false' });
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
  // Passive pilot snapshots must not leak field values or change the form.
  const key = '12'.repeat(32);
  assert.equal((await run({ action: 'observe', key })).code, 'SELECTION_REQUIRED');
  await command({ wide: 'true', focus: 'quantity', snapshot: 'true' });
  assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'state.json'), 'utf8')), { focus: 'quantity', decorativeControls: 1000 });
  const observed = await run({ action: 'observe', key, entryWindow: entry.entryWindow, scanOffset: 0 });
  assert.equal(observed.ok, true, JSON.stringify(observed)); assert.ok(observed.controls.length > 0);
  assert.ok(observed.cacheReads > 0); assert.ok(observed.prioritySeeds > 0);
  assert.equal(observed.scanOffset, 0);
  const stable = await run({ action: 'observe', key, entryWindow: entry.entryWindow, scanOffset: 173 });
  const reached = new Set([...observed.controls, ...stable.controls].map(c => c.label));
  // This fixture contains synthetic values only. Keep diagnostics to safe
  // labels and counters so a failed Windows run explains its field reach.
  const reachDiagnostics = [observed, stable].map(snapshot => ({
    scanOffset: snapshot.scanOffset, elapsedMs: snapshot.elapsedMs, nodeCount: snapshot.nodeCount,
    visitedCount: snapshot.visitedCount, cacheReads: snapshot.cacheReads, prioritySeeds: snapshot.prioritySeeds,
    errors: snapshot.errors, partial: snapshot.partial,
    labels: snapshot.controls.filter(c => c.label).map(c => c.label),
  }));
  for (const label of ['quantity', 'days supply', 'package type', 'start date']) assert.ok(reached.has(label), `Wide fixture did not reach ${label}: ${JSON.stringify(reachDiagnostics)}`);
  assert.equal(stable.scanOffset, 173);
  const overlap = stable.controls.filter(c => observed.controls.some(old => old.token === c.token));
  assert.ok(overlap.length > 0);
  for (const c of overlap) { const old = observed.controls.find(old => old.token === c.token); assert.equal(c.valueToken, old.valueToken); assert.equal(c.focused, old.focused); }
  const quantityBefore = observed.controls.find(c => c.label === 'quantity');
  assert.ok(quantityBefore?.valueToken); assert.equal(quantityBefore.focused, true);
  await command({ sig: 'SECOND PRIVATE VALUE', quantity: 'CHANGED QUANTITY PRIVATE VALUE' });
  const changedObservation = await run({ action: 'observe', key, entryWindow: entry.entryWindow, scanOffset: 346 });
  const quantityAfter = changedObservation.controls.find(c => c.label === 'quantity');
  assert.ok(quantityAfter?.valueToken); assert.equal(quantityAfter.token, quantityBefore.token);
  assert.notEqual(quantityAfter.valueToken, quantityBefore.valueToken); assert.equal(quantityAfter.focused, true);
  for (const snapshot of [observed, stable, changedObservation]) {
    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(serialized, /APPROVED EXPLICIT TARGET|SECOND PRIVATE VALUE|SYNTHETIC-1|Synthetic tablet|PAT-1|FAC-1|QUANTITY PRIVATE VALUE|DAYS PRIVATE VALUE|PACKAGE PRIVATE VALUE|START PRIVATE VALUE|PASSWORD PRIVATE VALUE|HIDDEN PRIVATE VALUE/);
    for (const privateValue of ['PASSWORD PRIVATE VALUE', 'HIDDEN PRIVATE VALUE']) {
      const privateToken = createHmac('sha256', Buffer.from(key, 'hex')).update('value:' + privateValue).digest('hex').slice(0, 32);
      assert.ok(!serialized.includes(privateToken), 'Protected/hidden value was tokenized');
    }
    assert.ok(snapshot.controls.every(c => c.patternCount >= 0 && c.patternCount <= 4));
    assert.ok(!snapshot.controls.some(c => c.label === 'refills' || c.label === 'delivery date'));
  }
  await command({ snapshot: 'true' });
  assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'state.json'), 'utf8')), { focus: 'quantity', decorativeControls: 1000 });
  await command({ wide: 'false' });
  assert.equal((await run({ action: 'detect', entryWindow: entry.entryWindow })).fields.sig, undefined); // custom label remains unchanged
  const unavailable = await run({ action: 'observe', key, entryWindow: { ...entry.entryWindow, id: 'replaced-window' } });
  assert.equal(unavailable.code, 'WINDOW_UNAVAILABLE');
  console.log('Windows UI Automation passed: passive dataset association/refusals, PON detection, SIG/times read-back, reviewed transfer, readonly refusal, explicit selection, wide-tree field reach, fresh value tokens and passive focus/privacy checks.');

} finally { app?.kill(); await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
