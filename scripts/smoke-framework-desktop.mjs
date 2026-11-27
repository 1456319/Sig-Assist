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
let eventWatcher;
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
    const commandPath = path.join(folder, 'command.json');
    for (let attempt = 0; ; attempt++) {
      try { await writeFile(commandPath, text); break; }
      catch (error) {
        // The WinForms timer may hold the file open for a read.
        if (attempt === 19 || !['EBUSY', 'EPERM'].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
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
  const workflow = () => run({ action: 'workflow-snapshot', entryWindow: entry.entryWindow });
  const workflowObserved = await workflow();
  assert.equal(workflowObserved.ok, true, JSON.stringify(workflowObserved));
  assert.equal(workflowObserved.pon, 'SYNTHETIC-1');
  assert.equal(workflowObserved.fields.draft_sig, 'OLD SIG');
  assert.equal(workflowObserved.fields.order_sig, 'SOURCE SIG PRIVATE VALUE');
  assert.equal(workflowObserved.fields.linked_sig, 'PREVIEW SIG PRIVATE VALUE');
  assert.equal(workflowObserved.fields.quantity, 'QUANTITY PRIVATE VALUE');
  assert.equal(workflowObserved.fields.admin_times, '0900, 2100');
  assert.doesNotMatch(JSON.stringify(workflowObserved), /PAT-1|FAC-1|PASSWORD PRIVATE VALUE|HIDDEN PRIVATE VALUE/);
  await command({ quantityAliases: 'true' });
  const aliases = await workflow();
  assert.equal(aliases.fields.quantity, 'QUANTITY PRIVATE VALUE', JSON.stringify(aliases));
  assert.ok(aliases.aliasesCollapsed >= 1, 'A named wrapper and its inner editor are one field.');
  await command({ independentQuantity: 'true' });
  const independent = await workflow();
  assert.equal(independent.fields.quantity, undefined);
  assert.equal(independent.unavailableReasons.quantity, 'AMBIGUOUS_CONTROLS');
  await command({ quantityAliases: 'false', independentQuantity: 'false' });
  await command({ observationGrid: 'true' });
  const besideGrid = await workflow();
  assert.equal(besideGrid.ok, true, JSON.stringify(besideGrid));
  assert.equal(besideGrid.fields.draft_sig, 'OLD SIG', 'A dense adjacent detail table must not starve field capture.');
  await command({ observationGrid: 'false' });
  const events = []; let eventBuffer = '';
  eventWatcher = spawn(helper, ['--test-process', 'SigAssistFrameworkFixture'], { stdio: ['pipe', 'pipe', 'pipe'] });
  eventWatcher.stdout.setEncoding('utf8');
  eventWatcher.stdout.on('data', chunk => {
    eventBuffer += chunk; let end;
    while ((end = eventBuffer.indexOf('\n')) >= 0) {
      const line = eventBuffer.slice(0, end); eventBuffer = eventBuffer.slice(end + 1);
      try { events.push(JSON.parse(line)); } catch { /* Wait for complete JSONL records only. */ }
    }
  });
  eventWatcher.stdin.end(JSON.stringify({ action: 'watch', entryWindow: entry.entryWindow, parentPid: process.pid }));
  await until(() => events.some(event => event.kind === 'ready'));
  const eventCount = events.length;
  await command({ sig: 'AUTOMATIC EVENT SYNTHETIC SIG' });
  await until(() => events.slice(eventCount).some(event => event.kind === 'changed'));
  assert.equal((await workflow()).fields.draft_sig, 'AUTOMATIC EVENT SYNTHETIC SIG');
  assert.doesNotMatch(JSON.stringify(events), /AUTOMATIC EVENT|PRIVATE VALUE|SYNTHETIC-1/);
  eventWatcher.kill(); eventWatcher = undefined;
  // Force only the UIA subscription to fail in the test-only helper mode.
  // Real WinEvent hooks must remain alive and forward subsequent field changes.
  events.length = 0; eventBuffer = '';
  eventWatcher = spawn(helper, ['--test-process', 'SigAssistFrameworkFixture'], { stdio: ['pipe', 'pipe', 'pipe'] });
  eventWatcher.stdout.setEncoding('utf8');
  eventWatcher.stdout.on('data', chunk => {
    eventBuffer += chunk; let end;
    while ((end = eventBuffer.indexOf('\n')) >= 0) {
      const line = eventBuffer.slice(0, end); eventBuffer = eventBuffer.slice(end + 1);
      try { events.push(JSON.parse(line)); } catch { /* Complete records only. */ }
    }
  });
  eventWatcher.stdin.end(JSON.stringify({ action: 'watch', entryWindow: entry.entryWindow, parentPid: process.pid, testUiaUnavailable: true }));
  await until(() => events.some(event => event.kind === 'uia_unavailable'));
  const degradedCount = events.length;
  await command({ sig: 'WINDOWS EVENT FALLBACK SYNTHETIC SIG' });
  await until(() => events.slice(degradedCount).some(event => event.kind === 'changed'));
  assert.ok(!events.some(event => event.kind === 'provider_unavailable'));
  assert.equal((await workflow()).fields.draft_sig, 'WINDOWS EVENT FALLBACK SYNTHETIC SIG');
  assert.doesNotMatch(JSON.stringify(events), /SYNTHETIC SIG|PRIVATE VALUE|SYNTHETIC-1/);
  eventWatcher.kill(); eventWatcher = undefined;
  await command({ sig: 'OLD SIG' });
  // Exercise actual Windows responsiveness without relying on a mocked helper
  // timeout. The fixture acknowledges before blocking its own UI thread.
  await command({ hangMs: '15000' });
  await new Promise(resolve => setTimeout(resolve, 6500));
  const hungStart = Date.now();
  assert.equal((await dataset()).code, 'FRAMEWORK_NOT_RESPONDING');
  assert.equal((await run({ action: 'observe', key: '12'.repeat(32), entryWindow: entry.entryWindow })).code, 'FRAMEWORK_NOT_RESPONDING');
  assert.ok(Date.now() - hungStart < 7000, 'Frozen-window hints should return before the passive helper timeout.');
  await command({ snapshot: 'true' });
  assert.deepEqual(await dataset(), captured, 'Passive reads recover after the fixture resumes.');
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
  await command({ sig: 'x'.repeat(1999) }); assert.equal((await dataset()).sig, 'x'.repeat(1999));
  await command({ richSig: 'true' }); assert.equal((await dataset()).sig, 'RICH SIG PRIVATE VALUE');
  await command({ richSigText: 'FIRST LINE\nSECOND LINE' }); assert.equal((await dataset()).sig, 'FIRST LINE\rSECOND LINE');
  await command({ richSigText: 'x'.repeat(4000) }); assert.equal((await dataset()).sig, 'x'.repeat(4000));
  await command({ richSigText: 'x'.repeat(4001) }); assert.equal((await dataset()).code, 'SIG_UNAVAILABLE');
  await command({ richSig: 'false', sig: 'x'.repeat(4001), datasetState: 'true' });
  const plainOverlength = await dataset();
  let overlengthDiagnostics;
  if (plainOverlength.code !== 'SIG_UNAVAILABLE') {
    // Synthetic fixture diagnostics only: no captured value, path or identifier
    // is printed. Keep the original refusal assertion even if a later read settles.
    const metadata = value => ({
      ok: value.ok, code: value.code, partial: value.partial,
      sigLength: typeof value.sig === 'string' ? value.sig.length : null,
      syntheticKind: value.sig === 'HUMAN EDIT OBSERVED' ? 'previous-plain'
        : value.sig === 'RICH SIG PRIVATE VALUE' ? 'initial-rich'
          : typeof value.sig === 'string' && /^x+$/.test(value.sig) ? 'boundary-x' : 'other',
    });
    const initialFixture = JSON.parse(await readFile(path.join(folder, 'dataset-state.json'), 'utf8'));
    await command({ datasetState: 'true' });
    overlengthDiagnostics = JSON.stringify({
      first: metadata(plainOverlength), initialFixture,
      later: metadata(await dataset()),
      laterFixture: JSON.parse(await readFile(path.join(folder, 'dataset-state.json'), 'utf8')),
    });
  }
  assert.equal(plainOverlength.code, 'SIG_UNAVAILABLE', overlengthDiagnostics);
  assert.equal((await run({ action: 'dataset-snapshot', entryWindow: { ...entry.entryWindow, id: 'replaced-window' } })).code, 'WINDOW_UNAVAILABLE');
  await command({ pon: 'SYNTHETIC-1', sig: 'OLD SIG', readonly: 'false' });
  // Password/rich/plain fixture switches recreate native control handles.
  // Bind the current field after passive tests rather than reuse a stale handle.
  const afterDataset = await run({ action: 'detect' });
  assert.equal(afterDataset.ok, true, JSON.stringify(afterDataset));
  const written = await run({ action: 'send', expected: afterDataset, field: 'sig', value: '1T PO BID — REVIEWED' });
  assert.equal(written.verified, true, JSON.stringify(written));
  const times = await run({ action: 'send', expected: written.detected, field: 'times', value: '0800, 2000' });
  assert.equal(times.verified, true, JSON.stringify(times));
  const beforeChange = await run({ action: 'detect' });
  await command({ pon: 'SYNTHETIC-2' });
  const changed = await run({ action: 'send', expected: beforeChange, field: 'sig', value: 'TECH APPROVED CURRENT ORDER' });
  assert.equal(changed.ok, false, JSON.stringify(changed));
  assert.match(changed.error, /PONs changed/);
  const beforeEdit = await run({ action: 'detect' }); await command({ sig: 'TECH EDIT' });
  const replaced = await run({ action: 'send', expected: beforeEdit, field: 'sig', value: 'APPROVED REPLACEMENT' });
  assert.equal(replaced.ok, false); assert.match(replaced.error, /destination text changed/);
  await command({ showDcOption: 'true' });
  const inspected = await run({ action: 'inspect', entryWindow: entry.entryWindow });
  const dcOption = inspected.diagnostics.windows.flatMap(window => window.controls).find(control => control.name === 'Dummy D/C option');
  assert.equal(dcOption?.type, 'ControlType.CheckBox');
  assert.ok(dcOption.supportedPatterns.includes('TogglePatternIdentifiers.Pattern'));
  assert.equal(dcOption.toggleState, 'On');
  await command({ showDcOption: 'false' });
  const draft = await run({ action: 'entry-fields', entryWindow: entry.entryWindow });
  assert.equal(draft.draftReady, true, JSON.stringify(draft));
  assert.deepEqual(Object.keys(draft.fields), ['quantity', 'daysSupply', 'startDate']);
  await command({ deliveryDate: 'true' });
  const ready = await run({ action: 'entry-fields', entryWindow: entry.entryWindow });
  assert.equal(ready.draftReady, true);
  const values = { quantity: '12.5', daysSupply: '5', startDate: '11/25/2026', deliveryDate: '11/26/2026' };
  const fill = (expected, replacements = values) =>
    run({ action: 'fill', entryWindow: entry.entryWindow, expected, pon: 'SYNTHETIC-2', values: replacements });
  const result = await fill(ready);
  assert.equal(result.verified, true, JSON.stringify(result));
  assert.deepEqual(result.completed, Object.keys(values));
  await command({ draftState: 'true' });
  assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'draft-state.json'), 'utf8')), values);
  const refresh = await run({ action: 'entry-fields', entryWindow: entry.entryWindow });
  const invalid = await fill(refresh, { quantity: '42', startDate: '02/30/2026' });
  assert.equal(invalid.ok, false); assert.deepEqual(invalid.completed, []);
  await command({ patient: 'PAT-2' });
  const stalePatient = await fill(refresh, { quantity: '42' });
  assert.equal(stalePatient.ok, false); assert.deepEqual(stalePatient.completed, []);
  await command({ patient: 'PAT-1', quantity: 'TECHNICIAN EDIT' });
  const staleField = await fill(refresh, { daysSupply: '21', quantity: '42' });
  assert.equal(staleField.ok, false); assert.deepEqual(staleField.completed, []);
  await command({ draftState: 'true', deliveryDate: 'false' });
  assert.equal(JSON.parse(await readFile(path.join(folder, 'draft-state.json'), 'utf8')).daysSupply, '5');
  await command({ recalculateDays: 'true' });
  const dependent = await run({ action: 'entry-fields', entryWindow: entry.entryWindow });
  const partial = await fill(dependent, { quantity: '42', daysSupply: '21' });
  assert.equal(partial.ok, false); assert.equal(partial.uncertain, true);
  assert.deepEqual(partial.completed, ['quantity']);
  await command({ draftState: 'true', recalculateDays: 'false' });
  const partialDraft = JSON.parse(await readFile(path.join(folder, 'draft-state.json'), 'utf8'));
  assert.equal(partialDraft.quantity, '42'); assert.equal(partialDraft.daysSupply, '3');
  await command({ quantity: 'QUANTITY PRIVATE VALUE', daysSupply: 'DAYS PRIVATE VALUE', startDate: 'START PRIVATE VALUE' });
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

} finally { eventWatcher?.kill(); app?.kill(); await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
