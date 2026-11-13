import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { helperExecutable } from './framework-desktop.mjs';

if (process.platform !== 'win32') throw new Error('Windows UI Automation is required for this test.');
const folder = await mkdtemp(path.join(tmpdir(), 'docutrack-fixture-'));
const helper = await helperExecutable();
const fixture = spawn('powershell.exe', ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('tests/fixtures/DocuTrackQueueFixture.ps1'), folder], { stdio: 'inherit' });
let outlineFixture;
async function until(name, host = fixture) {
  for (let i = 0; i < 100; i++) {
    if (host.exitCode !== null) throw new Error('Synthetic fixture exited before ' + name);
    try { await access(path.join(folder, name)); return; } catch { await wait(150); }
  }
  throw new Error('Synthetic fixture did not reach ' + name);
}
function scan(processName = 'powershell') {
  return new Promise((resolve, reject) => {
    const child = execFile(helper, ['--test-process', processName], { timeout: 30000 }, (err, stdout) => {
      if (err) reject(err); else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } }
    });
    child.stdin.end(JSON.stringify({ action: 'docutrack' }));
  });
}
try {
  await until('ready');
  const result = await scan();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.capture.unreadable, 0);
  assert.deepEqual(result.capture.headers, ['Document Type','Text 3','Document #']);
  assert.deepEqual(result.capture.rows, [['E-DC Order','SYN:0001','00012345'],['Order','SYN:0002','00012346']]);
  const fx = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319');
  const exec = promisify(execFile);
  const probe = path.join(folder,'PilotProbe.exe');
  const args = ['/nologo','/target:exe','/platform:anycpu','/out:'+probe,'/reference:System.Web.Extensions.dll','/reference:Accessibility.dll',
    ...['UIAutomationClient','UIAutomationTypes','WindowsBase'].map(n=>'/reference:'+path.join(fx,'WPF',n+'.dll')),
    path.resolve('pilot/workstation-probe/WorkstationProbe.cs'), path.resolve('pilot/workstation-probe/FolderSelectionProbe.cs')];
  await exec(path.join(fx,'csc.exe'),args);
  await assert.rejects(exec(probe,['docutrack','powershell']));
  await exec(path.join(fx,'csc.exe'),['/define:PROBE_FIXTURE',...args]);
  async function probeFixture() {
    const { stdout } = await exec(probe,['docutrack','powershell'],{timeout:30000});
    for(const canary of ['SYN:0001','00012345','Synthetic DocuTrack folder reader','Private Canary','555-0199','Secret Lane']) assert.ok(!stdout.includes(canary), 'Private fixture content escaped');
    return JSON.parse(stdout);
  }
  const map = await probeFixture();
  assert.ok(map.nodes.some(n=>n.role==='DataGrid' && n.patterns.includes('Grid') && n.columns===3));
  assert.ok(map.nodes.some(n=>n.label==='Process' && n.selected));
  assert.ok(map.nodes.some(n=>n.label==='Text 3'));
  assert.ok(map.nodes.some(n=>n.label==='Refuse Request' && n.patterns.includes('Invoke')));
  assert.ok(map.nodes.every((n,i)=>n.id===i+1 && n.parent<n.id));
  await writeFile(path.join(folder,'wrong-folder'),'1'); await until('switched');
  assert.equal((await scan()).ok, false);
  const changed = await probeFixture();
  assert.ok(changed.nodes.some(n=>n.label==='PV1' && n.selected));
  assert.ok(!changed.nodes.some(n=>n.label==='Process' && n.selected));
  const outlineExe = path.join(folder, 'PilotFolderFixture.exe');
  await exec(path.join(fx,'csc.exe'), ['/nologo', '/target:winexe', '/out:'+outlineExe,
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:Accessibility.dll', '/reference:System.Xaml.dll',
    ...['PresentationCore','PresentationFramework','UIAutomationTypes','UIAutomationProvider','WindowsBase','WindowsFormsIntegration'].map(n=>'/reference:'+path.join(fx,'WPF',n+'.dll')),
    path.resolve('tests/fixtures/DocuTrackFolderFixture.cs')]);
  outlineFixture = spawn(outlineExe, [folder]);
  await until('outline-ready', outlineFixture);
  async function folderReport() {
    const { stdout } = await exec(probe, ['folder', 'PilotFolderFixture'], {timeout:30000});
    assert.ok(!stdout.includes('Private Canary'));
    const report = JSON.parse(stdout);
    assert.equal(report.format, 'sig-assist-folder-selection');
    assert.equal(report.outlines, 1, stdout);
    return report.trees[0];
  }
  assert.deepEqual(await folderReport(), { installerControl: true, selectedState:true, outcome:'selected-path-observed',
    folder:'Process', cabinet:'Order Processing', businessUnit:'Richmond Pharmacy' });
  const native = await scan('PilotFolderFixture');
  assert.equal(native.ok, true, JSON.stringify(native));
  assert.deepEqual(native.capture, { headers: ['Doc. Type', 'Text 3'], rows: [['E-DC Order', '00-SYN-A']], unreadable: 1, exposedRowsOnly: true });
  assert.ok(!JSON.stringify(native.diagnostics).includes('00-SYN-A'));
  await writeFile(path.join(folder, 'select-triage'), '1'); await until('triage-ready', outlineFixture);
  assert.equal((await scan('PilotFolderFixture')).ok, false);
  const triage = await folderReport();
  assert.equal(triage.folder, 'Triage'); assert.equal(triage.outcome, 'selected-path-observed');
  await writeFile(path.join(folder, 'unknown-unit'), '1'); await until('unknown-ready', outlineFixture);
  const unknown = await folderReport();
  assert.equal(unknown.businessUnit, null); assert.equal(unknown.outcome, 'path-incomplete');
  console.log('Pilot probe returned scoped controls and read capabilities; sensitive fixture values stayed out of its reports.');
  console.log('Verified scoped DocuTrack folder, exact PON/document ID and rejection after switching folders.');
} finally {
  if (outlineFixture) outlineFixture.kill();
  fixture.kill(); await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
