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
  await page.addInitScript(() => {
    if (location.protocol !== 'http:' || localStorage.getItem('smoke.seeded')) return;
    localStorage.setItem('sig_assist_intensified_outbox_v1_synthetic-legacy', JSON.stringify({ sessionId: 'synthetic-legacy', workflow: [], translation: [], droppedWorkflow: 0, droppedTranslation: 0 }));
    localStorage.setItem('citrix_storage_discrepancies', JSON.stringify([{ id: 'synthetic-old', timestamp: '2026-11-16', pon: 'SYNTHETIC', drugName: 'Test', rawProse: 'Original', generatedSig: 'DRAFT', technicianSig: 'CORRECTED', notes: 'Preserve', flaggedForRph: false }]));
    localStorage.setItem('smoke.seeded', 'yes');
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => localStorage.getItem('sig_assist_intensified_outbox_v1_synthetic-legacy') === null);
  await page.getByText('1 saved discrepancy reports', { exact: true }).waitFor();
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
  // Exercise the actual browser quota boundary, not a mocked setItem failure.
  await page.evaluate(() => {
    let low = 0, high = 6 * 1024 * 1024;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      try { localStorage.setItem('synthetic-quota-filler', 'Q'.repeat(middle)); low = middle; }
      catch { high = middle - 1; }
    }
    try { localStorage.setItem('synthetic-quota-filler', 'Q'.repeat(low + 1)); throw new Error('Expected quota limit'); }
    catch (error) { if (error.name !== 'QuotaExceededError') throw error; }
  });
  await page.getByRole('button', { name: 'Workbench Live SIG Parser' }).click();
  await page.getByPlaceholder('e.g. Lisinopril 10mg').fill('Synthetic medication 10mg tablet');
  await page.getByPlaceholder(/Enter free text SIG/).fill('Take 1 tablet by mouth daily.');
  await page.getByRole('button', { name: /Flag Discrepancy/ }).click();
  await page.getByLabel('Notes / Rationale:').fill('Synthetic full-browser-store recovery.');
  await page.getByRole('button', { name: 'Save Discrepancy Report', exact: true }).click();
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export discrepancy cases', exact: true }).click();
  const download = await downloadPromise; const cases = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(cases.caseCount, 2); assert.ok(cases.reports.some(report => report.id === 'synthetic-old'));
  assert.ok(cases.reports.some(report => report.notes === 'Synthetic full-browser-store recovery.'));
  if (process.env.SIG_ASSIST_PILOT_SCREENSHOT) await page.screenshot({ path: process.env.SIG_ASSIST_PILOT_SCREENSHOT, fullPage: true });
  console.log('Pilot recorder browser check passed: first-screen controls, selected window, configured-root fallback, passive snapshots, checkpoints, flush/stop, same-folder bundle, metadata privacy, legacy diagnostic migration, real localStorage quota fallback, report reload and export.');
} finally {
  await browser?.close(); await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); await rm(temp, { recursive: true, force: true });
}
