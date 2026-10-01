import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'http://localhost:4189/';
let server;
let browser;
try {
  if (process.platform === 'win32') {
    server = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'windows-demo/Serve-Demo.ps1'), '-Port', '4189', '-NoBrowser'], { stdio: 'inherit' });
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(`${url}__health`)).ok) break; } catch { /* waiting for server start */ }
      if (server.exitCode !== null) throw new Error('Windows launcher exited before browser check.');
      if (attempt === 49) throw new Error('Windows launcher did not become ready.');
      await delay(100);
    }
  } else {
    const html = await readFile(path.join(root, 'windows-demo/index.html'));
    server = createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); });
    await new Promise(resolve => server.listen(4189, 'localhost', resolve));
  }
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
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
  await page.getByRole('checkbox').check();
  await copy.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '1T PO BID X7D WITH FOOD');
  await page.getByRole('button', { name: 'Revise source', exact: true }).click();
  assert.equal(await copy.isDisabled(), true);
  await page.getByRole('button', { name: 'Discard source edit' }).click();
  await page.getByRole('button').filter({ has: page.getByText('DEMO-002', { exact: true }) }).click();
  const split = page.getByLabel('Draft SIG (Order 1 of 2)');
  assert.match(await split.inputValue(), /^2T/);
  await split.fill('2T PO QAM WITH FOOD');
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
  assert.deepEqual(errors, []);
  console.log('PASS: prebuilt offline UI, real clipboard, review/revision/cancellation gating, split edits and queue saved across reload, trace drawer, zero external requests or browser errors.');
} finally {
  if (browser) await browser.close();
  if (server) {
    if (process.platform === 'win32') server.kill();
    else await new Promise(resolve => server.close(resolve));
  }
}
