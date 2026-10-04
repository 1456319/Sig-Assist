import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { helperExecutable } from './framework-desktop.mjs';
const exec = promisify(execFile);
if (process.platform !== 'win32') throw new Error('This smoke test needs Windows UI Automation.');
const folder = await mkdtemp(path.join(tmpdir(), 'sig-grid-'));
const apps = new Set();
const guards = new Set();
let restoreAccessibility;
async function until(predicate) {
  const end = Date.now() + 10000;
  while (Date.now() < end) { try { if (await predicate()) return; } catch { /* starting */ } await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Synthetic grid window did not become ready.');
}
async function stop(app) {
  if (app.exitCode !== null) return;
  await new Promise(resolve => { app.once('exit', resolve); app.kill(); }); apps.delete(app);
}
try {
  const helper = await helperExecutable();
  const exe = path.join(folder, 'SigAssistGridFixture.exe');
  const framework = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319');
  await exec(path.join(framework, 'csc.exe'), ['/nologo', '/target:winexe', `/out:${exe}`,
    ...['PresentationFramework', 'PresentationCore', 'WindowsBase', 'UIAutomationTypes', 'UIAutomationProvider'].map(name => `/reference:${path.join(framework, 'WPF', `${name}.dll`)}`),
    '/reference:System.Xaml.dll', path.resolve('tests', 'fixtures', 'FrameworkGridFixture.cs')]);
  const accessibility = async mode => (await exec(exe, ['--screen-reader', mode])).stdout.trim();
  const originalAccessibility = await accessibility('get');
  restoreAccessibility = () => accessibility(originalAccessibility);
  async function launch(name, role, mode = 'grid') {
    const dir = path.join(folder, name); await mkdir(dir);
    const app = spawn(exe, [dir, role, mode], { stdio: 'ignore' }); apps.add(app);
    await until(() => readFile(path.join(dir, 'ready'))); return { app, dir };
  }
  const run = input => new Promise((resolve, reject) => {
    const child = execFile(helper, ['--test-process', 'SigAssistGridFixture'], { timeout: 45000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error); else { try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); } }
    }); child.stdin.end(JSON.stringify(input));
  });
  const summary = found => JSON.stringify({ ...found, diagnostics: found.diagnostics?.windows.map(w => ({ pid: w.pid, openErx: w.openErx, incomplete: w.incomplete, grids: w.grids, controls: w.controls.length })) });
  const idle = await launch('idle1', 'idle'); await launch('idle2', 'idle'); await launch('idle3', 'idle');
  const triage = await launch('triage', 'triage');
  const queueOnly = await run({ action: 'detect' });
  assert.equal(queueOnly.openErxWindows, 0); assert.deepEqual(queueOnly.pons, [], summary(queueOnly));
  let opened = await launch('opened', 'open');
  const direct = await run({ action: 'detect' });
  assert.equal(direct.ok, true, summary(direct)); assert.equal(direct.instances, 1, summary(direct));
  assert.equal(direct.entryWindow.pid, opened.app.pid); assert.equal(direct.diagnostics.windowsScanned, 1);
  assert.equal(direct.openErxWindows, 1, summary(direct)); assert.deepEqual(direct.pons, ['SYNTHETIC-OPEN'], summary(direct));
  assert.equal(direct.fields.sig.value, 'OLD OPEN SIG');
  const grid = direct.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(grid.initialRows, 30); assert.equal(grid.rowCount, 80); assert.equal(grid.complete, false); assert.equal(grid.pages, 0, summary(direct));
  assert.ok(grid.rows.some(r => r.index === 67 && r.value === 'SYNTHETIC-OPEN'));
  assert.equal(grid.ponFound, true); assert.equal(grid.stopReason, 'pon-found'); assert.equal(grid.rows.length, 68);
  assert.equal(grid.reviewPosition, 'unchanged'); assert.equal(grid.anchorVisible, false);
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[1], '0');
  assert.ok(!direct.warnings.some(w => w.includes('could not be read')));
  assert.equal(grid.accessibility.status, 'not-needed');
  const positioned = await run({ action: 'detect', positionReview: true, entryWindow: direct.entryWindow });
  assert.equal(positioned.diagnostics.scanMode, 'remembered-entry'); assert.equal(positioned.diagnostics.windowsScanned, 1);
  assert.equal(positioned.diagnostics.windows.find(w => w.openErx).grids[0].reviewPosition, 'rxfill-visible');
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '38');
  // No read/scroll of the other instance's queue grid, despite an identical ID.
  await assert.rejects(readFile(path.join(triage.dir, 'state')));
  await stop(opened.app); opened = await launch('scroll-opened', 'open', 'scroll');
  const scrolled = await run({ action: 'detect' });
  assert.deepEqual(scrolled.pons, ['SYNTHETIC-OPEN'], summary(scrolled));
  const scrollGrid = scrolled.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.ok(scrollGrid.pages >= 3, summary(scrolled)); assert.equal(scrollGrid.ponFound, true); assert.equal(scrollGrid.reviewPosition, 'unchanged');
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '50');
  await stop(idle.app); const second = await launch('second', 'open-second');
  const secondBefore = await readFile(path.join(second.dir, 'state'), 'utf8');
  const pinned = await run({ action: 'detect', entryWindow: scrolled.entryWindow });
  assert.equal(pinned.instances, 1); assert.equal(pinned.openErxWindows, 1); assert.equal(pinned.pon, 'SYNTHETIC-OPEN');
  assert.equal(pinned.diagnostics.windowsScanned, 1); assert.equal(pinned.diagnostics.scanMode, 'remembered-entry');
  assert.deepEqual(pinned.diagnostics.windows.map(w => w.pid), [opened.app.pid]);
  assert.ok(!pinned.warnings.some(w => w.startsWith('Multiple PONs')));
  assert.equal(await readFile(path.join(second.dir, 'state'), 'utf8'), secondBefore);
  const inspected = await run({ action: 'inspect', entryWindow: scrolled.entryWindow });
  assert.deepEqual(inspected.diagnostics.windows.map(w => w.pid), [opened.app.pid]);
  assert.equal(await readFile(path.join(second.dir, 'state'), 'utf8'), secondBefore);
  const wrongStart = await run({ action: 'detect', entryWindow: { ...scrolled.entryWindow, started: '0' } });
  assert.equal(wrongStart.ok, false); assert.equal(wrongStart.windowSelectionRequired, true); assert.equal(wrongStart.diagnostics.windowsScanned, 0);
  // Even after another open E-Rx comes to the front, sends inspect only their
  // previously chosen destination window and do not change the entry selection.
  const sent = await run({ action: 'send', expected: scrolled, field: 'sig', value: 'TECHNICIAN APPROVED' });
  assert.equal(sent.verified, true, summary(sent));
  assert.equal(await readFile(path.join(second.dir, 'state'), 'utf8'), secondBefore);
  await stop(opened.app);
  const missing = await run({ action: 'detect', entryWindow: scrolled.entryWindow });
  assert.equal(missing.ok, false); assert.equal(missing.windowSelectionRequired, true); assert.equal(missing.diagnostics.windowsScanned, 0);
  assert.equal(await readFile(path.join(second.dir, 'state'), 'utf8'), secondBefore);
  await stop(second.app); opened = await launch('failed-scroll', 'open', 'fail');
  const partial = await run({ action: 'detect', positionReview: true });
  const partialGrid = partial.diagnostics.windows.find(w => w.pid === opened.app.pid).grids[0];
  assert.equal(partialGrid.complete, false); assert.equal(partialGrid.reviewPosition, 'bottom');
  assert.ok(partialGrid.issues.some(issue => issue.includes('inspection failed')));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '50');
  assert.ok(!partial.warnings.some(w => w.includes('restored')));
  await stop(opened.app);
  opened = await launch('raw-delayed', 'open', 'raw-delay');
  const raw = await run({ action: 'detect' });
  assert.deepEqual(raw.pons, ['SYNTHETIC-OPEN'], summary(raw));
  const rawGrid = raw.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(rawGrid.rowCount, 106); assert.ok(rawGrid.nullCells > 0); assert.equal(rawGrid.ponFound, true, summary(raw));
  assert.equal(rawGrid.reviewPosition, 'unchanged', summary(raw));
  assert.ok(rawGrid.viewports.some(v => v.view === 'raw' && v.rows > 0));
  assert.ok(rawGrid.viewports.some(v => v.attempt > 0 && v.rows > 0));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '75');
  const rawPositioned = await run({ action: 'detect', positionReview: true, entryWindow: raw.entryWindow });
  assert.equal(rawPositioned.diagnostics.windows.find(w => w.openErx).grids[0].reviewPosition, 'rxfill-visible', summary(rawPositioned));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '64');
  await stop(opened.app); opened = await launch('indexed-visible', 'open', 'indexed-visible');
  const indexedVisible = await run({ action: 'detect' });
  assert.equal(indexedVisible.pon, 'SYNTHETIC-OPEN', summary(indexedVisible));
  const indexedGrid = indexedVisible.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(indexedGrid.initialRows, 0);
  assert.ok(indexedGrid.viewports.some(v => v.view === 'indexed-viewport' && v.rows > 0));
  for (const mode of ['point-only', 'point-narrow']) {
    await stop(opened.app); opened = await launch(mode, 'open', mode);
    const pointed = await run({ action: 'detect' });
    assert.equal(pointed.pon, 'SYNTHETIC-OPEN', summary(pointed));
    assert.equal(pointed.diagnostics.windowsScanned, 1);
    const pointGrid = pointed.diagnostics.windows.find(w => w.openErx).grids[0];
    assert.equal(pointGrid.initialRows, 0); assert.ok(pointGrid.nullCells > 0);
    assert.ok(pointGrid.viewports.some(v => v.view === 'point' && v.rows > 0), summary(pointed));
    assert.equal(pointGrid.ponFound, true); assert.equal(pointGrid.reviewPosition, 'unchanged');
  }
  await stop(opened.app); opened = await launch('empty-provider', 'open', 'empty');
  const empty = await run({ action: 'detect' });
  const emptyGrid = empty.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.deepEqual(empty.pons, []); assert.equal(emptyGrid.complete, false); assert.equal(emptyGrid.ponFound, false);
  assert.equal(emptyGrid.rows.length, 0); assert.ok(emptyGrid.nullCells > 0);
  assert.ok(emptyGrid.viewports.some(v => v.view === 'raw' && v.sample.length > 0));
  assert.ok(emptyGrid.viewports.some(v => v.view === 'point' && v.rows === 0));
  assert.ok(emptyGrid.issues.every(issue => !issue.includes('NullReferenceException')));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '76');
  await stop(opened.app); opened = await launch('point-overlay', 'open', 'point-overlay');
  const overlay = await run({ action: 'detect' });
  assert.deepEqual(overlay.pons, [], summary(overlay));
  assert.ok(overlay.diagnostics.windows.find(w => w.openErx).grids[0].viewports.some(v => v.view === 'point' && v.rejected > 0), summary(overlay));
  await stop(opened.app); opened = await launch('compound-pon', 'open', 'compound-pon');
  const compound = await run({ action: 'detect' });
  assert.equal(compound.pon, '123456789:0000123456', summary(compound));
  const compoundGrid = compound.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(compoundGrid.rowCount, 114); assert.equal(compoundGrid.ponCandidates[0].accepted, true);
  assert.equal(compoundGrid.ponCandidates[0].index, 113);
  await stop(opened.app); opened = await launch('auto-scroll-delayed', 'open', 'auto-scroll-delayed');
  const delayedIndex = await run({ action: 'detect' });
  assert.equal(delayedIndex.pon, 'SYNTHETIC-OPEN', summary(delayedIndex));
  const delayedGrid = delayedIndex.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(delayedGrid.initialRows, 0);
  assert.ok(delayedGrid.viewports.some(v => v.view === 'indexed-viewport' && v.retries > 0), summary(delayedIndex));
  await stop(opened.app); opened = await launch('auto-scroll-empty', 'open', 'auto-scroll-empty');
  const moved = await run({ action: 'detect' });
  assert.deepEqual(moved.pons, [], summary(moved));
  const movedGrid = moved.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.ok(movedGrid.pages >= 5, summary(moved));
  assert.ok(movedGrid.viewports.some(v => v.view === 'indexed-viewport' && v.viewportRestore === 'restored'), summary(moved));
  assert.ok(movedGrid.viewports.filter(v => v.view === 'indexed-viewport').every(v => v.probes <= 3), summary(moved));
  assert.equal(movedGrid.finalVerticalPercent, 100, summary(moved));
  // A provider that stops exposing cells in the SAME remembered window. This
  // reproduces the reported failure instead of merely testing a different window.
  await stop(opened.app); await accessibility('off');
  opened = await launch('accessibility-lost', 'open', 'accessibility-lost');
  const healthy = await run({ action: 'detect' });
  assert.equal(healthy.pon, 'SYNTHETIC-OPEN', summary(healthy));
  assert.equal(healthy.diagnostics.windows[0].grids[0].accessibility.status, 'not-needed');
  await writeFile(path.join(opened.dir, 'lose-cells'), 'simulate discarded provider peers');
  // The fixture polls for the trigger; its old viewport must become empty first.
  await new Promise(resolve => setTimeout(resolve, 250));
  const unrelated = await launch('unrelated-during-recovery', 'open-second');
  const unrelatedBefore = await readFile(path.join(unrelated.dir, 'state'), 'utf8');
  for (let attempt = 0; attempt < 2; attempt++) {
    const recovered = await run({ action: 'detect', entryWindow: healthy.entryWindow });
    assert.equal(recovered.pon, 'SYNTHETIC-OPEN', summary(recovered));
    assert.equal(recovered.diagnostics.windowsScanned, 1);
    assert.deepEqual(recovered.diagnostics.windows.map(w => w.pid), [opened.app.pid]);
    const recoveredGrid = recovered.diagnostics.windows[0].grids[0];
    assert.equal(recoveredGrid.initialRows, 0, summary(recovered));
    assert.equal(recoveredGrid.accessibility.status, 'enabled-temporarily', summary(recovered));
    assert.equal(recoveredGrid.accessibility.rowsRecovered, true);
    assert.equal(recoveredGrid.accessibility.cleanup, 'restored', summary(recovered));
    assert.equal(recoveredGrid.accessibility.before, false); assert.equal(recoveredGrid.accessibility.after, false);
    assert.ok(recoveredGrid.accessibility.refreshedGridId);
    assert.equal(await accessibility('get'), 'off');
    assert.equal(await readFile(path.join(unrelated.dir, 'state'), 'utf8'), unrelatedBefore);
  }
  await stop(unrelated.app); await stop(opened.app);
  opened = await launch('accessibility-fault', 'open', 'accessibility-fault');
  const faulted = await run({ action: 'detect' });
  assert.deepEqual(faulted.pons, [], summary(faulted));
  assert.equal(faulted.diagnostics.windows[0].grids[0].accessibility.cleanup, 'restored', summary(faulted));
  assert.equal(await accessibility('get'), 'off');
  // The owner must preserve a pre-existing screen-reader flag even when an
  // empty provider never recovers, and must restore after abrupt reader death.
  await stop(opened.app); await accessibility('on');
  opened = await launch('already-accessible-empty', 'open', 'empty');
  const enabled = await run({ action: 'detect' });
  assert.deepEqual(enabled.pons, [], summary(enabled));
  const enabledRecovery = enabled.diagnostics.windows[0].grids[0].accessibility;
  assert.equal(enabledRecovery.status, 'already-enabled'); assert.equal(enabledRecovery.cleanup, 'unchanged');
  assert.equal(await accessibility('get'), 'on');
  assert.ok(enabled.warnings.some(w => w.includes('Close and reopen the E-Rx detail screen')));
  await accessibility('off');
  const owner = spawn(helper, ['--accessibility-lease', String(opened.app.pid), enabled.entryWindow.started], { stdio: ['pipe', 'pipe', 'inherit'] });
  guards.add(owner);
  const ownerLines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  const ownerExit = new Promise((resolve, reject) => { owner.on('error', reject); owner.on('exit', code => code === 0 ? resolve() : reject(new Error(`Accessibility owner exited ${code}`))); });
  const ready = JSON.parse((await ownerLines.next()).value);
  assert.equal(ready.status, 'enabled-temporarily'); assert.equal(await accessibility('get'), 'on');
  // Leave its input pipe OPEN: the watchdog, not EOF, must detect the killed parent.
  await stop(opened.app);
  const cleaned = JSON.parse((await ownerLines.next()).value);
  assert.equal(cleaned.cleanup, 'restored'); await ownerExit; guards.delete(owner);
  assert.equal(await accessibility('get'), 'off');
  console.log('Multi-instance UIA passed: remembered-window-only detection, diagnostics and sending; unrelated open E-Rx ignored; stale/closed window handling; PON-first indexed/scroll/raw reads and optional review positioning.');
  console.log('Empty-cell recovery passed: discarded peers in a remembered window, repeat detection, unrelated instances untouched, provider failure cleanup, existing accessibility state preserved, killed-parent cleanup.');
} finally {
  for (const guard of guards) { guard.stdin.end(); await new Promise(resolve => { guard.once('exit', resolve); setTimeout(resolve, 5000); }); }
  for (const app of apps) await stop(app);
  if (restoreAccessibility) await restoreAccessibility();
  await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
