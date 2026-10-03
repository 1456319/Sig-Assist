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
    const child = execFile(helper, ['--test-process', 'SigAssistGridFixture'], { timeout: 35000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error); else { try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); } }
    }); child.stdin.end(JSON.stringify(input));
  });
  const summary = found => JSON.stringify({ ...found, diagnostics: found.diagnostics?.windows.map(w => ({ pid: w.pid, openErx: w.openErx, incomplete: w.incomplete, grids: w.grids, controls: w.controls.length })) });
  const idle = await launch('idle1', 'idle'); await launch('idle2', 'idle'); await launch('idle3', 'idle');
  const triage = await launch('triage', 'triage'); let opened = await launch('opened', 'open');
  const direct = await run({ action: 'detect' });
  assert.equal(direct.ok, true, summary(direct)); assert.equal(direct.instances, 5, summary(direct));
  assert.equal(direct.openErxWindows, 1, summary(direct)); assert.deepEqual(direct.pons, ['SYNTHETIC-OPEN'], summary(direct));
  assert.equal(direct.fields.sig.value, 'OLD OPEN SIG');
  const grid = direct.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.equal(grid.initialRows, 30); assert.equal(grid.rowCount, 80); assert.equal(grid.complete, true); assert.equal(grid.pages, 0);
  assert.ok(grid.rows.some(r => r.index === 67 && r.value === 'SYNTHETIC-OPEN'));
  // No read/scroll of the other instance's queue grid, despite an identical ID.
  await assert.rejects(readFile(path.join(triage.dir, 'state')));
  await stop(opened.app); opened = await launch('scroll-opened', 'open', 'scroll');
  const scrolled = await run({ action: 'detect' });
  assert.deepEqual(scrolled.pons, ['SYNTHETIC-OPEN'], summary(scrolled));
  const scrollGrid = scrolled.diagnostics.windows.find(w => w.openErx).grids[0];
  assert.ok(scrollGrid.pages >= 3, summary(scrolled)); assert.equal(scrollGrid.complete, true); assert.equal(scrollGrid.scrollRestored, true);
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '10');
  await stop(idle.app); await launch('second', 'open-second');
  const multiple = await run({ action: 'detect' });
  assert.equal(multiple.instances, 5); assert.equal(multiple.openErxWindows, 2); assert.equal(multiple.pon, null);
  assert.deepEqual(multiple.pons, ['SYNTHETIC-OPEN', 'SYNTHETIC-SECOND']);
  assert.ok(multiple.warnings.some(w => w.startsWith('Multiple PONs')));
  // Sending to the technician's already identified field stays available.
  const sent = await run({ action: 'send', expected: scrolled, field: 'sig', value: 'TECHNICIAN APPROVED' });
  assert.equal(sent.verified, true, summary(sent));
  await stop(opened.app); opened = await launch('failed-scroll', 'open', 'fail');
  const partial = await run({ action: 'detect' });
  const partialGrid = partial.diagnostics.windows.find(w => w.pid === opened.app.pid).grids[0];
  assert.equal(partialGrid.complete, false); assert.equal(partialGrid.scrollRestored, true);
  assert.ok(partialGrid.issues.some(issue => issue.includes('inspection failed')));
  assert.equal((await readFile(path.join(opened.dir, 'state'), 'utf8')).split(',')[0], '10');
  console.log('Multi-instance UIA passed: 5 processes, wizard selection, hidden/triage exclusion, PON after row 30, direct grid read, scroll fallback/restoration, partial-read diagnostics and two-open-order sending.');
} finally {
  for (const app of apps) await stop(app);
  await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
