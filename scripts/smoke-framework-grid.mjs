import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { helperExecutable } from './framework-desktop.mjs';
const exec = promisify(execFile);
if (process.platform !== 'win32') throw new Error('This smoke test needs Windows UI Automation.');
const folder = await mkdtemp(path.join(tmpdir(), 'sig-grid-'));
const apps = new Set();
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
  await stop(opened.app); opened = await launch('empty-provider', 'open', 'empty');
  const empty = await run({ action: 'detect' });
  const emptyGrid = empty.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.deepEqual(empty.pons, []); assert.equal(emptyGrid.complete, false); assert.equal(emptyGrid.ponFound, false);
  assert.equal(emptyGrid.rows.length, 0); assert.ok(emptyGrid.nullCells > 0);
  assert.ok(emptyGrid.viewports.some(v => v.view === 'raw' && v.sample.length > 0));
  assert.ok(emptyGrid.issues.every(issue => !issue.includes('NullReferenceException')));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '76');
  console.log('Multi-instance UIA passed: remembered-window-only detection, diagnostics and sending; unrelated open E-Rx ignored; stale/closed window handling; PON-first indexed/scroll/raw reads and optional review positioning.');
} finally {
  for (const app of apps) await stop(app);
  await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
