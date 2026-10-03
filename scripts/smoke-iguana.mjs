import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBridge } from './iguana-bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Compile trusted synthetic fixtures; never execute code from a capture.
const fixtureBundle = await build({ entryPoints: [path.join(root, 'tests/iguanaFixtures.ts')], bundle: true, write: false, platform: 'node', format: 'esm' });
const { fourLogHar, newRx, attributeExport } = await import(`data:text/javascript;base64,${Buffer.from(fixtureBundle.outputFiles[0].text).toString('base64')}`);
const harFlag = process.argv.indexOf('--har');
const suppliedHar = harFlag >= 0 ? await readFile(process.argv[harFlag + 1]) : undefined;
const servers = [];
let browser;
async function listen(server) { servers.push(server); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${server.address().port}`; }
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const offline = await browser.newContext();
  const page = await offline.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(pathToFileURL(path.join(root, 'windows-demo/index.html')).href);
  await page.locator('#sig-assist-startup').waitFor({ state: 'hidden' });
  await page.getByText('Capture import and diagnostics', { exact: true }).click();
  await page.getByLabel('Import Iguana capture').setInputFiles({ name: 'synthetic.har', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fourLogHar())) });
  await page.getByText(/Capture imported: 4 logs · 1 added · 1 duplicates · 0 need investigation/).waitFor();
  assert.equal(await page.locator('section[aria-label="Orders"] li').count(), 1);
  assert.equal(await page.getByLabel('Final SIG · editable, uppercase').inputValue(), '1T PO BID FOR EXAMPLE SYMPTOMS');
  await page.getByText('0900, 2100', { exact: true }).waitFor();
  await page.getByLabel('Final SIG · editable, uppercase').fill('1T PO BID TECHNICIAN EDIT');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Import Iguana capture').setInputFiles({ name: 'synthetic.har', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fourLogHar())) });
  await page.getByText(/Capture imported: 4 logs · 0 added · 2 duplicates/).waitFor();
  assert.equal(await page.getByLabel('Final SIG · editable, uppercase').inputValue(), '1T PO BID TECHNICIAN EDIT');
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed SIG', exact: true }).isDisabled(), false);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export connector diagnostics', exact: true }).click();
  const download = await downloadPromise;
  const diagnostic = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(diagnostic.format, 'sig-assist-iguana-diagnostics');
  assert.ok(diagnostic.events.some(event => event.stage === 'intake.duplicate'));
  assert.ok(diagnostic.queue[0].metadata.messageIds.includes('synthetic-msg-1'));
  assert.equal(JSON.stringify(diagnostic).includes('never-export-this'), false);
  await page.waitForTimeout(650);
  await page.reload();
  await page.getByRole('button').filter({ has: page.getByText('DEMO-PON-1', { exact: true }) }).click();
  await page.getByText('0900, 2100', { exact: true }).waitFor();
  if (suppliedHar) {
    await page.getByText('Capture import and diagnostics', { exact: true }).click();
    await page.getByRole('button', { name: 'Clear orders', exact: true }).click();
    await page.getByLabel('Import Iguana capture').setInputFiles({ name: 'provided.har', mimeType: 'application/json', buffer: suppliedHar });
    await page.getByText(/Capture imported: 4 logs · 1 added · 1 duplicates · 0 need investigation/).waitFor();
    assert.equal(await page.locator('section[aria-label="Orders"] li').count(), 1);
    await page.getByText('0900, 2100', { exact: true }).waitFor();
    // Do not print patient/order data from the supplied capture.
    console.log('Provided HAR: four details imported as one matching order; structured schedule preserved.');
  }
  await offline.close();

  let requestCount = 0; let saturated = false;
  const upstream = await listen(createServer((request, response) => {
    assert.equal(request.method, 'GET'); assert.equal(new URL(request.url, 'http://localhost').pathname, '/api_query'); requestCount++;
    const entries = saturated ? 1 : 2;
    response.setHeader('Content-Type', 'application/xml');
    response.end(attributeExport(Array.from({ length: entries }, () => ({ payload: newRx(), time: '2026-10-02 01:00:00.000' }))));
  }));
  const bridge = await listen(createBridge());
  const live = await browser.newContext(); const livePage = await live.newPage();
  livePage.on('pageerror', error => errors.push(error.message));
  await livePage.goto(bridge);
  await livePage.locator('#sig-assist-startup').waitFor({ state: 'hidden' });
  await livePage.getByText('Live connection settings', { exact: true }).click();
  assert.equal(await livePage.getByLabel('Iguana base URL', { exact: true }).inputValue(), 'http://iguanabalt01v:6543');
  assert.equal(await livePage.getByLabel('Username', { exact: true }).inputValue(), 'admin');
  assert.equal(await livePage.getByLabel('Password', { exact: true }).inputValue(), 'password');
  const yesterday = await livePage.evaluate(() => {
    const date = new Date(); date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} 00:00:00`;
  });
  assert.equal(await livePage.getByLabel('After · Iguana server time', { exact: true }).inputValue(), yesterday);
  await livePage.getByLabel('Iguana base URL', { exact: true }).fill(upstream);
  await livePage.getByLabel('Username', { exact: true }).fill('demo');
  await livePage.getByLabel('Password', { exact: true }).fill('test-secret');
  await livePage.getByLabel('After · Iguana server time', { exact: true }).fill('2026/10/02 00:00:00');
  await livePage.getByRole('button', { name: 'Fetch once', exact: true }).click();
  await livePage.getByText(/Last fetch: 2 logs · 1 added · 0 need investigation/).waitFor();
  assert.equal(await livePage.locator('section[aria-label="Orders"] li').count(), 1);
  await livePage.getByText('0900, 2100', { exact: true }).waitFor();
  const liveDownloadPromise = livePage.waitForEvent('download');
  await livePage.getByText('Capture import and diagnostics', { exact: true }).click();
  await livePage.getByRole('button', { name: 'Export connector diagnostics', exact: true }).click();
  const liveDownload = await liveDownloadPromise;
  const liveDiagnostic = JSON.parse(await readFile(await liveDownload.path(), 'utf8'));
  assert.ok(liveDiagnostic.events.some(event => event.stage === 'transport.response' && event.details.status === 200));
  assert.equal(liveDiagnostic.connection.cursor, '2026/10/02 00:59:58');
  assert.equal(JSON.stringify(liveDiagnostic).includes('test-secret'), false);
  await livePage.getByText('Live connection settings', { exact: true }).click();
  await livePage.getByLabel('PON, patient reference, facility or drug', { exact: true }).fill('DEMO-PON-1');
  await livePage.getByRole('button', { name: 'Find E-Rx', exact: true }).click();
  await livePage.getByText('Search complete: 2 logs · 0 added. Choose a matching E‑Rx below.', { exact: true }).waitFor();
  assert.equal(await livePage.getByLabel('Final SIG · editable, uppercase').count(), 0);
  await livePage.locator('section[aria-label="Orders"]').getByRole('button').click();
  assert.equal(await livePage.getByLabel('Final SIG · editable, uppercase').inputValue(), '1T PO BID FOR EXAMPLE SYMPTOMS');
  await livePage.getByText('Live connection settings', { exact: true }).click();
  saturated = true;
  await livePage.getByLabel('Log limit · 1–5000', { exact: true }).fill('1');
  await livePage.getByRole('button', { name: 'Start polling', exact: true }).click();
  await livePage.getByText('Paused: log query limit reached. Narrow the time window or increase the limit.', { exact: true }).waitFor();
  const beforeWait = requestCount; await livePage.waitForTimeout(100); assert.equal(requestCount, beforeWait);
  assert.deepEqual(errors, []);
  // The independent panel must work when the compiled app never mounts. A HAR
  // captured after navigation cannot supply these missing startup exceptions.
  const portableHtml = await readFile(path.join(root, 'windows-demo/index.html'), 'utf8');
  const moduleTag = /<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/;
  assert.match(portableHtml, moduleTag);
  const brokenHtml = portableHtml.replace(moduleTag, '<script type="module">throw new Error("Synthetic app module failure");</script>');
  const failedContext = await browser.newContext();
  const failedPage = await failedContext.newPage();
  await failedPage.route('**/startup-failure/', route => route.fulfill({ contentType: 'text/html', body: brokenHtml }));
  await failedPage.goto(`${bridge}/startup-failure/`);
  await failedPage.getByRole('heading', { name: 'Sig-Assist could not finish loading', exact: true }).waitFor();
  const startupDownloadPromise = failedPage.waitForEvent('download');
  await failedPage.getByRole('button', { name: 'Save startup diagnostics', exact: true }).click();
  const startupDownload = await startupDownloadPromise;
  const startupDiagnostic = JSON.parse(await readFile(await startupDownload.path(), 'utf8'));
  assert.equal(startupDiagnostic.format, 'sig-assist-startup-diagnostics');
  assert.match(startupDiagnostic.buildId, /^[a-f0-9]{64}$/);
  assert.ok(startupDiagnostic.errors.some(error => error.message.includes('Synthetic app module failure')));
  assert.equal(startupDiagnostic.connector.service, 'sig-assist-iguana-connector');
  assert.equal(startupDiagnostic.connector.page.ok, true);
  assert.equal('queue' in startupDiagnostic, false);
  // A script blocked without an error event must also leave a usable panel.
  const blockedPage = await failedContext.newPage();
  await blockedPage.clock.install();
  await blockedPage.route('**/startup-blocked/', route => route.fulfill({ contentType: 'text/html', body: portableHtml.replace(moduleTag, '') }));
  await blockedPage.goto(`${bridge}/startup-blocked/`);
  await blockedPage.clock.runFor(10001);
  await blockedPage.getByRole('heading', { name: 'Sig-Assist could not finish loading', exact: true }).waitFor();
  assert.ok((await blockedPage.evaluate(() => window.sigAssistStartup.report())).errors.some(error => error.kind === 'startup-timeout'));
  await failedContext.close();
  console.log('Iguana browser checks passed: portable import, idempotence, review preservation, persistence, diagnostic export, live bridge fetch, cursor overlap and query-limit pause.');
  console.log('Startup browser checks passed: normal panel dismissal, failed-module diagnostic download with build/bridge identity, and blocked-module timeout.');
} finally {
  await browser?.close();
  await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
}
