import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileArgument = process.argv.indexOf('--file');
const fileMode = fileArgument !== -1;
const pagePath = fileMode && process.argv[fileArgument + 1] ? process.argv[fileArgument + 1] : path.join(root, 'windows-demo/index.html');
const url = fileMode ? pathToFileURL(pagePath).href : 'http://127.0.0.1:4189/';
let server;
let browser;
try {
  if (!fileMode && process.platform === 'win32') {
    server = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'windows-demo/Serve-Demo.ps1'), '-Port', '4189', '-NoBrowser'], { stdio: 'inherit' });
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(`${url}__health`)).ok) break; } catch { /* waiting for server start */ }
      if (server.exitCode !== null) throw new Error('Windows launcher exited before browser check.');
      if (attempt === 49) throw new Error('Windows launcher did not become ready.');
      await delay(100);
    }
  } else if (!fileMode) {
    const html = await readFile(path.join(root, 'windows-demo/index.html'));
    server = createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); });
    await new Promise(resolve => server.listen(4189, '127.0.0.1', resolve));
  }
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true });
  const context = await browser.newContext(fileMode ? {} : { permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url)) externalRequests.push(request.url()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url);
  await page.getByRole('button', { name: 'Load demo queue' }).click();
  const draft = page.getByLabel('Final SIG · editable, uppercase');
  assert.equal(await draft.inputValue(), '1T PO BID X7D');
  const copy = page.getByRole('button', { name: 'Copy reviewed SIG', exact: true });
  assert.equal(await copy.isDisabled(), true);
  await draft.fill('1t po bid x7d with food');
  await page.getByRole('button', { name: /Flag Discrepancy/ }).click();
  assert.equal(await page.getByLabel('Technician Preferred / Corrected SIG:').inputValue(), '1T PO BID X7D WITH FOOD');
  await page.getByLabel('Notes / Rationale:').fill('Synthetic example: compare edited draft with original output.');
  await page.getByRole('button', { name: 'Save Discrepancy Report', exact: true }).click();
  await page.getByText('1 saved discrepancy reports', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close Feedback', exact: true }).click();
  await page.getByRole('checkbox').check();
  await copy.click();
  if (fileMode) {
    // Require the user-click write to succeed before granting read access to verify it.
    await page.getByText('Reviewed SIG copied. Match the PON and preview it in Framework.', { exact: true }).waitFor();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '1T PO BID X7D WITH FOOD');
  await page.getByRole('button', { name: 'Revise source', exact: true }).click();
  assert.equal(await copy.isDisabled(), true);
  await page.getByRole('button', { name: 'Discard source edit' }).click();
  await page.getByRole('button').filter({ has: page.getByText('DEMO-002', { exact: true }) }).click();
  const split = page.getByLabel('Draft SIG (Order 1 of 2)');
  assert.match(await split.inputValue(), /^2T/);
  await split.fill('2T PO QAM WITH FOOD');
  await page.getByRole('button', { name: /Flag Discrepancy/ }).click();
  await page.getByLabel('Notes / Rationale:').fill('Synthetic split correction case.');
  await page.getByRole('button', { name: 'Save Discrepancy Report', exact: true }).click();
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close Feedback', exact: true }).click();
  await page.getByRole('checkbox').first().check();
  const splitCopy = page.getByRole('button', { name: 'Copy Reviewed SIG (Order 1 of 2)', exact: true });
  await splitCopy.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '2T PO QAM WITH FOOD');
  await page.getByRole('button', { name: 'Workbench Live SIG Parser' }).click();
  await page.getByRole('button', { name: 'Order Queue Review & Copy by PON' }).click();
  await page.getByRole('button').filter({ has: page.getByText('DEMO-002', { exact: true }) }).click();
  assert.equal(await split.inputValue(), '2T PO QAM WITH FOOD');
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  assert.equal(await splitCopy.isDisabled(), true);
  await page.getByRole('button', { name: 'Trace Logs', exact: true }).click();
  await delay(800);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('citrix_storage_queue')));
  assert.equal(saved.length, 5);
  assert.equal(saved.find(order => order.pon === 'DEMO-002').cancelled, true);
  await page.reload();
  await page.getByText('DEMO-002', { exact: true }).waitFor();
  await page.getByRole('button').filter({ has: page.getByText('DEMO-002', { exact: true }) }).click();
  assert.equal(await split.inputValue(), '2T PO QAM WITH FOOD');
  assert.equal(await splitCopy.isDisabled(), true);
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export discrepancy cases', exact: true }).click();
  const download = await downloadPromise;
  const bundle = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(bundle.caseCount, 2);
  assert.equal(bundle.redacted, false);
  assert.equal(bundle.reports[0].generatedSig, '1T PO BID X7D');
  assert.equal(bundle.reports[0].technicianSig, '1T PO BID X7D WITH FOOD');
  assert.match(bundle.reports[0].buildId, /^[a-f0-9]{64}$/);
  assert.equal(bundle.reports[1].context.subOrders[0].draftSig, '2T PO QAM WITH FOOD');
  assert.equal(bundle.reports[1].context.subOrders.length, 2);
  assert.equal(bundle.reports[1].technicianSig.split('\n').length, 2);
  assert.deepEqual(errors, []);
  console.log(`PASS (${fileMode ? 'direct file, no server' : 'HTTP'}): offline UI, clipboard, review/revision/cancellation gating, split edits, saved queue and discrepancy cases across reload, actual case-file download, trace drawer, zero external requests or browser errors.`);
} finally {
  if (browser) await browser.close();
  if (server) {
    if (process.platform === 'win32') server.kill();
    else await new Promise(resolve => server.close(resolve));
  }
}
