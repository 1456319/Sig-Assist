// Synthetic end-to-end recorder check. Never uses a pharmacy profile or live records.
import { chromium } from 'playwright';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBridge } from './iguana-bridge.mjs';
import { createPilotJournal } from './pilot-journal.mjs';
const temp = await mkdtemp(path.join(tmpdir(), 'sig-pilot-browser-'));
const root = path.join(temp, 'Synthetic Recording Root'); await mkdir(root);
const journal = createPilotJournal({ baseDirs: [path.join(temp, 'unavailable-root'), root] });
let selected = false, browser;
const server = createBridge({ journal, siteProfile: undefined, observationIntervalMs: 100, fetchImpl: () => { throw new Error('Recording must not query an upstream'); }, desktop: async action => {
  if (action === 'detect') { selected = true; return { ok: true, fields: {} }; }
  return selected ? { ok: true, code: 'OK', controls: [{ token: 'a'.repeat(32), automationId: 'RxEntryPrescription_QtyEdit', type: 'ControlType.Edit', valueToken: 'b'.repeat(32), valueLength: 1, value: 'PRIVATE-FIELD-VALUE', name: 'PRIVATE-RESIDENT-NAME' }] } : { ok: false, code: 'SELECTION_REQUIRED' };
} });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole('button', { name: 'Open recording controls', exact: true }).click();
  await page.getByRole('button', { name: 'Choose observation window', exact: true }).click();
  await page.getByText('Framework entry window selected.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Start pilot recording', exact: true }).click();
  await page.getByText(root, { exact: false }).waitFor();
  await page.getByText('Framework observer: OK', { exact: false }).waitFor();
  await page.getByLabel('Recording checkpoint', { exact: true }).selectOption('sig-reviewed');
  await page.getByRole('button', { name: 'Mark checkpoint', exact: true }).click();
  await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  await page.getByRole('button', { name: 'Start pilot recording', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Save review bundle in recording folder', exact: true }).click();
  await page.getByText('Review bundle saved inside the recording folder:', { exact: false }).waitFor();
  const status = journal.status(); assert.equal(status.active, false); assert.equal(path.dirname(status.directory), root);
  const output = await readFile(path.join(status.directory, status.bundleFile), 'utf8');
  assert.match(output, /TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH/);
  assert.match(output, /sig-reviewed/); assert.match(output, /RxEntryPrescription_QtyEdit/);
  assert.doesNotMatch(output, /PRIVATE-FIELD-VALUE|PRIVATE-RESIDENT-NAME/);
  assert.ok(status.workflowEvents > 3); assert.equal(errors.length, 0, errors.join('\n'));
  if (process.env.SIG_ASSIST_PILOT_SCREENSHOT) await page.screenshot({ path: process.env.SIG_ASSIST_PILOT_SCREENSHOT, fullPage: true });
  console.log('Pilot recorder browser check passed: first-screen controls, selected window, configured-root fallback, passive snapshots, checkpoints, flush/stop, same-folder bundle, and metadata privacy.');
} finally {
  await browser?.close(); await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); await rm(temp, { recursive: true, force: true });
}
