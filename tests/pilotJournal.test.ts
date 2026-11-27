// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type Server } from 'node:http';
// @ts-expect-error Dependency-free native connector module.
import { createPilotJournal, safeBrowserEvent, safeDesktop } from '../scripts/pilot-journal.mjs';
// @ts-expect-error Dependency-free native connector module.
import { createBridge } from '../scripts/iguana-bridge.mjs';

const folders: string[] = []; const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())); for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
async function root() { const folder = await mkdtemp(path.join(tmpdir(), 'sig-pilot-')); folders.push(folder); return folder; }
async function lines(directory: string) { const names = (await readdir(directory)).filter(n => n.endsWith('.jsonl') && !n.startsWith('TEMPORARY-')); return (await Promise.all(names.map(n => readFile(path.join(directory, n), 'utf8')))).flatMap(s => s.trim().split('\n').filter(Boolean).map(s => JSON.parse(s))); }

it('persists explicit local clinical observations with separate SIG roles, scoped sessions and capture-gap diagnostics', async () => {
  const journal = createPilotJournal({ baseDir: await root(), sync: false });
  const session = await journal.start({ observeDesktop: true });
  const frame = { id: 1, kind: 'order_visible', ok: true, code: 'OK', pon: 'SYNTHETIC:1', view: 'directions', fields: { message_sig: 'SYNTHETIC PROSE', draft_sig: '1T PO QD', password: 'DO NOT WRITE' }, patientName: 'DO NOT WRITE' };
  expect(await journal.workflow(frame, 'another-session')).toBe(false);
  expect(await journal.workflow(frame, session.sessionId)).toBe(true);
  expect(await journal.workflow({ id: 2, kind: 'observation_gap', dropped: 4 }, session.sessionId)).toBe(true);
  expect(await journal.workflow({ id: 3, kind: 'button_invoked', control: 'save', candidatePon: 'SYNTHETIC:1' }, session.sessionId)).toBe(true);
  const saved = await lines(session.directory);
  const observations = saved.filter(row => row.code === 'framework.observation').map(row => row.observation);
  expect(observations[0]).toMatchObject({ fields: { message_sig: 'SYNTHETIC PROSE', draft_sig: '1T PO QD' }, outcome: 'unverified' });
  expect(observations[2]).toMatchObject({ control: 'save', association: 'preceding_observation_only', outcome: 'unverified' });
  expect(JSON.stringify(saved)).not.toContain('DO NOT WRITE');
  expect(journal.status()).toMatchObject({ rawClinicalText: true, observationEvents: 3, observationDropped: 4 });
  expect(journal.status()).toMatchObject({ fieldSnapshots: 1, buttonEvents: 1 });
  await journal.workflow({ id: 4, kind: 'view_changed', ok: true, code: 'OK', pon: null, view: 'directions', fields: {} }, session.sessionId);
  expect(journal.status()).toMatchObject({ desktopCode: 'VIEW_ONLY', fieldSnapshots: 1, screenOnlySnapshots: 1 });
  await journal.stop();
});

it('saves more than the old 1000-event ring, rotates independent streams, acknowledges retry batches once, and bundles inside the configured folder', async () => {
  const folder = await root(); const journal = createPilotJournal({ baseDir: folder, rotateBytes: 10000, sync: false });
  const status = await journal.start({ appVersion: '0.1.7', observeDesktop: false });
  for (let i = 0; i < 6; i++) {
    const batch = { sessionId: status.sessionId, batchId: 'batch-' + i, events: Array.from({ length: 220 }, () => ({ code: 'trace', fields: { component: 'clinicalEngine', messageLength: 12, rawText: 'DO NOT WRITE', pon: 'PRIVATE-PON' } })) };
    await journal.ingest(batch); await journal.ingest(batch);
  }
  await journal.record('checkpoint', { checkpoint: 'saved', password: 'PRIVATE-PASSWORD' });
  const stopped = await journal.stop(); const saved = await lines(stopped.directory);
  expect(stopped.translationEvents).toBe(1320); expect(saved.filter(x => x.code === 'trace')).toHaveLength(1320);
  expect(saved.some(x => x.fields?.checkpoint === 'saved')).toBe(true);
  expect(JSON.stringify(saved)).not.toMatch(/DO NOT WRITE|PRIVATE-PON|PRIVATE-PASSWORD/);
  expect((await readdir(stopped.directory)).filter(n => n.startsWith('translation-')).length).toBeGreaterThan(1);
  const bundle = await journal.saveBundle(); const output = await readFile(path.join(bundle.directory, bundle.bundleFile), 'utf8');
  expect(output).toContain('TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH');
  expect(output).not.toContain(folder); expect(path.dirname(bundle.directory)).toBe(folder);
});

it('rejects stale browser batches without stopping the current recording and ignores snapshots from an earlier session', async () => {
  const journal = createPilotJournal({ baseDir: await root(), sync: false }); const first = await journal.start({});
  await expect(journal.ingest({ sessionId: 'other', batchId: 'stale', events: [] })).rejects.toThrow();
  expect(journal.status()).toMatchObject({ active: true, fileError: false });
  await journal.stop(); const next = await journal.start({});
  await journal.desktop({ ok: true, code: 'OK', controls: [] }, first.sessionId);
  expect((await lines(next.directory)).some(x => x.code === 'desktop.snapshot')).toBe(false);
});

it('uses only the supplied roots, falls back to the configured mapped root, and never silently relocates a failed writer', async () => {
  const folder = await root(); const missing = path.join(folder, 'missing-root');
  const journal = createPilotJournal({ baseDirs: [missing, folder], sync: false }); const started = await journal.start({});
  expect(path.dirname(started.directory)).toBe(folder); expect(await readdir(folder)).not.toContain('missing-root');
  await rm(started.directory, { recursive: true });
  await expect(journal.record('checkpoint', { checkpoint: 'saved' })).rejects.toThrow('could not write');
  expect(journal.status()).toMatchObject({ active: false, fileError: true, directory: started.directory });
  expect(await readdir(folder)).toEqual([]);
  await expect(createPilotJournal({ baseDirs: [missing] }).start({})).rejects.toThrow();
  expect(createPilotJournal().status()).toMatchObject({ active: false, configured: false });
});

it('shows translation drops without evicting workflow and uses monotonic duration even when wall-clock time moves backwards', async () => {
  const folder = await root(); let wall = 1700000000000, elapsed = 0;
  const journal = createPilotJournal({ baseDir: folder, maxStreamBytes: 2500, maxDurationMs: 100, now: () => wall, monotonic: () => elapsed, sync: false });
  const status = await journal.start({});
  await journal.ingest({ sessionId: status.sessionId, batchId: 'burst', events: Array.from({ length: 30 }, () => ({ code: 'trace', fields: { messageLength: 25 } })) });
  wall -= 10000; elapsed = 50;
  await journal.record('checkpoint', { checkpoint: 'sig-reviewed' });
  expect(journal.status().droppedTranslation).toBeGreaterThan(0);
  expect((await lines(status.directory)).some(x => x.fields?.checkpoint === 'sig-reviewed' && x.elapsedMs === 50)).toBe(true);
  elapsed = 101; await journal.record('recorder.heartbeat');
  expect(journal.status()).toMatchObject({ active: false, stopReason: 'DURATION_LIMIT' });
});

it('allowlists hostile browser/provider data, records field changes as keyed tokens, and omits unknown labels and raw errors', async () => {
  const raw = { code: 'trace', clientRef: 'a'.repeat(32), at: 'not a date', fields: { component: 'PRIVATE-NAME', messageLength: 4, rawXml: 'PRIVATE-XML', password: 'PRIVATE-SECRET', traceRef: 'PRIVATE-PON', outcome: 'ok' } };
  expect(safeBrowserEvent(raw)).toEqual({ code: 'trace', clientRef: 'a'.repeat(32), fields: { messageLength: 4, outcome: 'ok' } });
  expect(safeBrowserEvent({ code: 'trace', fields: null })).toEqual({ code: 'trace', fields: {} });
  const c = { token: 'a'.repeat(32), parent: 'b'.repeat(32), automationId: 'RxEntryPrescription_QtyEdit', type: 'ControlType.Edit', label: 'quantity', x: -10, y: 15, width: 50, height: 20, valueToken: 'c'.repeat(32), valueLength: 3, name: 'PRIVATE-NAME', value: 'PRIVATE-VALUE', password: 'PRIVATE-SECRET' };
  const journal = createPilotJournal({ baseDir: await root(), sync: false }); const status = await journal.start({});
  await journal.desktop({ ok: true, code: 'OK', controls: [c], errors: 0, scanOffset: 173, cacheReads: 42, prioritySeeds: 2 });
  await journal.desktop({ ok: true, code: 'OK', controls: [c], errors: 0 });
  await journal.desktop({ ok: true, code: 'OK', controls: [{ ...c, valueToken: 'd'.repeat(32) }], error: 'PRIVATE-ERROR' });
  const snapshots = (await lines(status.directory)).filter(x => x.code === 'desktop.snapshot');
  expect(snapshots[0].changed).toHaveLength(1); expect(snapshots[1].changed).toHaveLength(0); expect(snapshots[2].changed[0].valueToken).toBe('d'.repeat(32));
  expect(snapshots[0].changed[0]).toMatchObject({ label: 'quantity', x: -10, y: 15, width: 50, height: 20 });
  expect(snapshots[0].summary).toMatchObject({ scanOffset: 173, cacheReads: 42, prioritySeeds: 2 });
  const invalidCounters = safeDesktop({ code: 'OK', scanOffset: 'PRIVATE', cacheReads: -1, prioritySeeds: Number.POSITIVE_INFINITY });
  for (const counter of ['scanOffset', 'cacheReads', 'prioritySeeds']) expect(invalidCounters).not.toHaveProperty(counter);
  await journal.desktop({ ok: true, code: 'OK', controls: [], partial: true });
  await journal.desktop({ ok: false, code: 'BUSY' });
  const partial = (await lines(status.directory)).filter(x => x.code === 'desktop.snapshot').slice(-2);
  expect(partial.every(x => x.removed.length === 0)).toBe(true);
  expect(JSON.stringify(snapshots)).not.toMatch(/PRIVATE/);
  expect(safeDesktop({ code: 'PRIVATE', controls: [{ token: 'a'.repeat(32), automationId: 'PRIVATE-NAME', type: 'PRIVATE-TYPE' }] }).controls[0]).toEqual({ token: 'a'.repeat(32) });
});

it('preserves fixed observer failure reasons and bounded duration in saved snapshots without raw exception data', async () => {
  const journal = createPilotJournal({ baseDir: await root(), sync: false }); const status = await journal.start({});
  const reasons = ['HELPER_TIMEOUT', 'INVALID_OUTPUT', 'HELPER_PROCESS_EXIT', 'HELPER_STARTUP_FAILED', 'UNKNOWN_FAILURE'];
  for (const failureReason of reasons) await journal.desktop({ ok: false, code: 'OBSERVATION_FAILED', failureReason, helperDurationMs: 8002.4, message: 'PRIVATE-NAME', stdout: 'PRIVATE-PON', stderr: 'PRIVATE-PATH', errorCode: 'PRIVATE-CODE' });
  const snapshots = (await lines(status.directory)).filter(x => x.code === 'desktop.snapshot');
  expect(snapshots.map(x => x.summary.failureReason)).toEqual(reasons);
  expect(snapshots.every(x => x.summary.helperDurationMs === 8002 && x.summary.code === 'OBSERVATION_FAILED')).toBe(true);
  expect(JSON.stringify(snapshots)).not.toContain('PRIVATE');
  expect(safeDesktop({ code: 'OBSERVATION_FAILED', failureReason: 'PRIVATE-NAME', helperDurationMs: 1e12 })).toEqual({ code: 'OBSERVATION_FAILED', ok: false, partial: false, helperDurationMs: 60000, controls: [] });
  for (const helperDurationMs of [-1, Number.POSITIVE_INFINITY, Number.NaN, 'PRIVATE']) expect(safeDesktop({ helperDurationMs })).not.toHaveProperty('helperDurationMs');
  for (const code of ['BUSY', 'SELECTION_REQUIRED', 'OK']) expect(safeDesktop({ code }).code).toBe(code);
});

it('serves recording controls only to same-origin JSON, never queries upstream for recording, and saves the bundle to its session root', async () => {
  const folder = await root(); const calls: unknown[] = [];
  const journal = createPilotJournal({ baseDir: folder, sync: false });
  const server: Server = createBridge({ journal, desktop: async (action: string) => { calls.push(action); return { ok: false, code: 'SELECTION_REQUIRED' }; }, fetchImpl: () => { throw new Error('NO UPSTREAM'); }, observationIntervalMs: 20, observerOptions: { settleMs: 0, minReadMs: 0 } });
  servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number }; const base = `http://127.0.0.1:${address.port}`;
  const post = (action: string, body = {}, origin = base) => fetch(`${base}/connector/pilot/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  expect((await post('start', {}, 'https://other.example')).status).toBe(403);
  expect((await post('start', { appVersion: '0.1.7' })).ok).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 40));
  const status = await (await post('status')).json(); expect(status.active).toBe(true); expect(calls).toContain('workflow-snapshot');
  const frames = await (await post('observations')).json(); expect(frames.sessionId).toBe(status.sessionId); expect(frames.frames.length).toBeGreaterThan(0);
  expect((await post('stop')).ok).toBe(true);
  const bundle = await (await post('bundle')).json(); expect(path.dirname(bundle.directory)).toBe(folder);
  expect(await readFile(path.join(bundle.directory, bundle.bundleFile), 'utf8')).toContain('SELECTION_REQUIRED');
  const exported = await post('export'); expect(exported.headers.get('content-type')).toBe('application/x-ndjson'); expect(await exported.text()).not.toContain(folder);
  const second = await (await post('start', { observeDesktop: false })).json();
  const metadataOnly = await (await post('observations', { sessionId: status.sessionId })).json();
  expect(metadataOnly).toMatchObject({ sessionId: second.sessionId, active: false, frames: [], status: 'DESKTOP_OBSERVATION_OFF' });
  await post('stop');
});

it('keeps cumulative browser drops in the manifest without counting retries or repeated counters twice', async () => {
  const journal = createPilotJournal({ baseDir: await root(), sync: false });
  const status = await journal.start({});
  const ingest = (batchId: string, clientRef: string, dropped: number) => journal.ingest({ sessionId: status.sessionId, batchId, events: [{ code: 'browser.overflow', clientRef, fields: { droppedWorkflow: 0, droppedTranslation: dropped } }] });
  await ingest('first', 'a'.repeat(32), 8); await ingest('first', 'a'.repeat(32), 8);
  await ingest('repeat', 'a'.repeat(32), 8); await ingest('later', 'a'.repeat(32), 12);
  await ingest('other', 'b'.repeat(32), 3);
  const manifest = JSON.parse(await readFile(path.join(status.directory, 'manifest.json'), 'utf8'));
  expect(manifest).toMatchObject({ droppedTranslation: 0, browserDroppedTranslation: 15, browserDroppedWorkflow: 0 });
  expect(manifest.browserDrops).toBeUndefined();
});
