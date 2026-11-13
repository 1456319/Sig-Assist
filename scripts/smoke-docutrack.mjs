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
async function until(name) {
  for (let i = 0; i < 100; i++) {
    if (fixture.exitCode !== null) throw new Error('Synthetic fixture exited before ' + name);
    try { await access(path.join(folder, name)); return; } catch { await wait(150); }
  }
  throw new Error('Synthetic fixture did not reach ' + name);
}
function scan() {
  return new Promise((resolve, reject) => {
    const child = execFile(helper, ['--test-process', 'powershell'], { timeout: 30000 }, (err, stdout) => {
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
  const args = ['/nologo','/target:exe','/platform:anycpu','/out:'+probe,'/reference:System.Web.Extensions.dll',
    ...['UIAutomationClient','UIAutomationTypes','WindowsBase'].map(n=>'/reference:'+path.join(fx,'WPF',n+'.dll')),
    path.resolve('pilot/workstation-probe/WorkstationProbe.cs')];
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
  console.log('Pilot probe returned scoped controls and read capabilities; sensitive fixture values stayed out of its reports.');
  console.log('Verified scoped DocuTrack folder, exact PON/document ID and rejection after switching folders.');
} finally {
  fixture.kill(); await rm(folder, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
