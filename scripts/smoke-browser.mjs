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
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
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
  await page.getByRole('checkbox', { name: /I matched the order and checked/ }).check();
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
  await page.getByRole('checkbox', { name: 'Reviewed and approved for FrameworkLTC', exact: true }).first().check();
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
  // Replay the exported real-world cases through the shipped Workbench UI.
  const reported = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-01-batch3.json'), 'utf8'));
  const replayExpected = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-01-batch3-expected.json'), 'utf8'));
  await page.getByRole('button', { name: 'Workbench Live SIG Parser' }).click();
  await page.getByText(/codes loaded/).waitFor();
  const directions = page.getByPlaceholder(/Enter free text SIG/);
  const drug = page.getByPlaceholder('e.g. Lisinopril 10mg');
  const template = page.getByPlaceholder('e.g. Take 1 tablet daily');
  const notices = {
    0: 'Nebulizer Volume Retained', 4: 'Missing Frequency',
    5: 'Diclofenac Site/Dose Requires Verification', 9: 'PEG Packet Preparation Added',
    10: 'Duplicate Direction Removed', 15: 'Pantoprazole Preparation Requires Review',
    20: 'Nebulizer Vial Quantity Calculated', 22: 'Insulin Unit Typo Normalized',
  };
  assert.equal(reported.reports.length, replayExpected.length);
  for (const [index, report] of reported.reports.entries()) {
    await page.getByRole('button', { name: 'Clear all fields', exact: true }).click();
    await drug.fill(index < 2 ? '' : report.drugName);
    await template.fill(report.context?.defaultSigTemplate || '');
    await directions.fill(report.rawProse);
    await page.waitForFunction(value => [...document.querySelectorAll('textarea')].some(field => field.value === value), replayExpected[index]);
    assert.equal(await page.getByLabel('Final SIG · editable, uppercase').inputValue(), replayExpected[index]);
    if (notices[index]) await page.getByText(`[${notices[index]}]`, { exact: false }).waitFor();
    const reviewedCopy = page.getByRole('button', { name: 'Copy reviewed SIG', exact: true });
    assert.equal(await reviewedCopy.isDisabled(), true);
    await page.getByRole('checkbox', { name: /I matched the order and checked/ }).check();
    await reviewedCopy.click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), replayExpected[index]);
  }
  const octoberCases = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-03.json'), 'utf8'));
  const octoberExpected = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-03-expected.json'), 'utf8'));
  const octoberNotices = { 1: 'Liquid Concentration Missing', 5: 'Partial Translation', 6: 'Nebulizer Vial Quantity Calculated', 8: 'Duplicate Direction Removed', 11: 'Duplicate Direction Removed', 15: 'PEG Powder Preparation Added' };
  for (const [index, report] of octoberCases.entries()) {
    await page.getByRole('button', { name: 'Clear all fields', exact: true }).click();
    await drug.fill(report.drugName);
    await directions.fill(report.rawProse);
    if (index === 0) {
      const expectedCards = [
        '1T PO QD FOR SCHIZOAFFECTIVE DISORDER. TAW FRACTIONAL-TABLET DOSE (TD 7.5MG)',
        '1/2T (2.5MG) PO QD FOR SCHIZOAFFECTIVE DISORDER. TAW WHOLE-TABLET DOSE (TD 7.5MG)',
      ];
      for (const [part, expected] of expectedCards.entries()) {
        const label = `Order ${part + 1} of 2`;
        await page.waitForFunction(value => [...document.querySelectorAll('textarea')].some(field => field.value === value), expected);
        assert.equal(await page.getByLabel(`Draft SIG (${label})`).inputValue(), expected);
        const partCopy = page.getByRole('button', { name: `Copy Reviewed SIG (${label})`, exact: true });
        assert.equal(await partCopy.isDisabled(), true);
        await page.getByRole('checkbox', { name: 'Reviewed and approved for FrameworkLTC', exact: true }).nth(part).check();
        await partCopy.click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
      }
    } else {
      await page.waitForFunction(value => [...document.querySelectorAll('textarea')].some(field => field.value === value), octoberExpected[index]);
      assert.equal(await page.getByLabel('Final SIG · editable, uppercase').inputValue(), octoberExpected[index]);
      if (octoberNotices[index]) await page.getByText(`[${octoberNotices[index]}`, { exact: false }).waitFor();
      const reviewedCopy = page.getByRole('button', { name: 'Copy reviewed SIG', exact: true });
      assert.equal(await reviewedCopy.isDisabled(), true);
      await page.getByRole('checkbox', { name: /I matched the order and checked/ }).check();
      await reviewedCopy.click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), octoberExpected[index]);
    }
  }
  const latestCases = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-04.json'), 'utf8'));
  const latestExpected = JSON.parse(await readFile(path.join(root, 'tests/fixtures/reported-discrepancies-2026-10-04-expected.json'), 'utf8'));
  const replayed = new Set(octoberCases.map(c => JSON.stringify([c.drugName, c.rawProse])));
  let newReplays = 0;
  for (const [index, report] of latestCases.entries()) {
    const key = JSON.stringify([report.drugName, report.rawProse]);
    if (replayed.has(key)) continue;
    replayed.add(key); newReplays++;
    await page.getByRole('button', { name: 'Clear all fields', exact: true }).click();
    await drug.fill(report.drugName);
    await directions.fill(report.rawProse);
    await page.waitForFunction(value => [...document.querySelectorAll('textarea')].some(field => field.value === value), latestExpected[index]);
    assert.equal(await draft.inputValue(), latestExpected[index]);
    assert.doesNotMatch(await draft.inputValue(), /\b(?:INH|FNA|FVOM|Q23H|PNA)\b/);
    await page.getByRole('checkbox', { name: /I matched the order and checked/ }).check();
    await copy.click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), latestExpected[index]);
  }
  // Restrictions change suggestions immediately and persist without overwriting an edited draft.
  await page.getByRole('button', { name: 'Clear all fields', exact: true }).click();
  await drug.fill('EXAMPLE TAB');
  await directions.fill('Give 1 tablet by mouth daily');
  await page.getByText('Saved exclusions (0)', { exact: true }).click();
  await page.getByLabel('SIG code to exclude', { exact: true }).fill('QD');
  await page.getByRole('button', { name: 'Exclude code', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(field => field.value === '1T PO ONE TIME A DAY'));
  await draft.fill('1T PO ONE TIME A DAY WITH FOOD');
  await page.getByLabel('SIG code to exclude', { exact: true }).fill('PO');
  await page.getByRole('button', { name: 'Exclude code', exact: true }).click();
  await page.getByText('1T BY MOUTH ONE TIME A DAY', { exact: true }).first().waitFor();
  assert.equal(await draft.inputValue(), '1T PO ONE TIME A DAY WITH FOOD');
  assert.equal(await copy.isDisabled(), true);
  await page.getByRole('button', { name: 'Use calculated suggestion' }).click();
  await draft.fill('1T PO Q23H');
  assert.equal(await page.getByRole('checkbox', { name: /I matched the order and checked/ }).isDisabled(), true);
  await page.getByText(/Remove rejected packaging code/).waitFor();
  assert.equal(await copy.isDisabled(), true);
  await page.getByRole('button', { name: 'Archive current reports' }).click();
  await page.getByText('0 saved discrepancy reports', { exact: true }).waitFor();
  await page.getByText('2 archived reports', { exact: true }).waitFor();
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export archived reports' }).click();
  const archived = JSON.parse(await readFile(await (await archiveDownload).path(), 'utf8'));
  assert.equal(archived.caseCount, 2);
  assert.ok(archived.reports.every(r => r.archivedAt));
  assert.equal(archived.reports[0].rawProse, bundle.reports[0].rawProse);
  await page.getByRole('button', { name: 'Restore archived reports' }).click();
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  // Clear source, profile, template, editable draft and approval together;
  // saved reports remain in the separate archive.
  await template.fill('GIVE 1 PACKET PO');
  await page.getByRole('button', { name: 'Clear all fields', exact: true }).click();
  for (const field of [drug, template, directions]) assert.equal(await field.inputValue(), '');
  assert.equal(await page.getByLabel('Final SIG · editable, uppercase').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Copy reviewed SIG', exact: true }).count(), 0);
  await page.getByText('2 saved discrepancy reports', { exact: true }).waitFor();
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
  console.log(`PASS (${fileMode ? 'direct file, no server' : 'HTTP'}): offline UI, clipboard, review/revision/cancellation gating, saved queue and case export, all ${41 + newReplays} reported cases replayed through Workbench and actual clipboard with review notices and whole/fractional tablet cards, code restrictions applied during generation and copy, reversible report archiving, Clear all fields preserves the saved archive, zero external requests or browser errors.`);
} finally {
  if (browser) await browser.close();
  if (server) {
    if (process.platform === 'win32') server.kill();
    else await new Promise(resolve => server.close(resolve));
  }
}
