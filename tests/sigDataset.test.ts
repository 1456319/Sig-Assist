// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBIndex, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSigDatasetStore, type SigDatasetInput, type SigDatasetStage } from '../src/lib/sigDataset';

let databaseNumber = 0;
const name = () => `synthetic-sig-dataset-${Date.now()}-${++databaseNumber}`;
const observation = (overrides: Partial<SigDatasetInput> = {}): SigDatasetInput => ({
  orderKey: 'SYNTHETIC-IDENTITY-DO-NOT-PERSIST', revision: 1, drug: 'Synthetic test tablet',
  rawSig: 'Take one tablet by mouth daily.', generatedSig: '1T PO QD', finalSig: '1T PO QAM',
  stage: 'reviewed_copy', ...overrides,
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function rawDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function mutate(databaseName: string, store: string, action: (objectStore: IDBObjectStore) => void) {
  const db = await rawDatabase(databaseName);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      action(tx.objectStore(store));
    });
  } finally { db.close(); }
}

describe('local incremental SIG dataset', () => {
  it('persists a whitelisted clinical observation and opaque identities across reopening', async () => {
    const databaseName = name(), store = createSigDatasetStore(databaseName);
    const input = {
      ...observation(), defaultSigTemplate: 'TAKE # TABLET(S) BY MOUTH', partId: 'SYNTHETIC-PRIVATE-PART', origin: 'iguana' as const,
      context: { ndc: '00000-0000-00', dose: 1, route: 'PO', administrationTimes: ['0900'], patient: 'NEVER-PERSIST-THIS-EXTRA-FIELD' },
      patient: 'NEVER-PERSIST-THIS-EXTRA-FIELD', pon: 'NEVER-PERSIST-THIS-EXTRA-FIELD', facility: 'NEVER-PERSIST-THIS-EXTRA-FIELD',
    };
    expect(await store.record(input)).toEqual({ added: true, seq: 1 });
    const reopened = createSigDatasetStore(databaseName), page = await reopened.page(0);
    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({ schemaVersion: 1, seq: 1, rawSig: input.rawSig, finalSig: input.finalSig, captureKind: 'erx_source', origin: 'iguana', appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, context: { dose: 1, administrationTimes: ['0900'] } });
    expect(page.records[0].capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(page.records[0].defaultSigTemplate).toBe(input.defaultSigTemplate);
    for (const key of ['orderId', 'sampleId', 'dedupKey'] as const) expect(page.records[0][key]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(page)).not.toContain(input.orderKey);
    expect(JSON.stringify(page)).not.toContain(input.partId);
    expect(JSON.stringify(page)).not.toContain('NEVER-PERSIST-THIS-EXTRA-FIELD');
    expect(await reopened.record(input)).toEqual({ added: false, seq: 1 });
    const other = createSigDatasetStore(name()); await other.record(input);
    expect((await other.page(0)).records[0].orderId).not.toBe(page.records[0].orderId);
  });

  it('initializes one durable salt and deduplicates concurrent writers transactionally', async () => {
    const databaseName = name(), first = createSigDatasetStore(databaseName), second = createSigDatasetStore(databaseName);
    const outcomes = await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? first : second).record(observation())));
    expect(outcomes.filter(result => result.added)).toHaveLength(1);
    expect(new Set(outcomes.map(result => result.seq)).size).toBe(1);
    expect((await second.stats()).total).toBe(1);
    expect(await createSigDatasetStore(databaseName).record(observation())).toEqual({ added: false, seq: 1 });
  });

  it('retains changed text, ratings, comments, source context, policy, parts and revisions', async () => {
    const store = createSigDatasetStore(name());
    const changes: Partial<SigDatasetInput>[] = [
      {}, { finalSig: '1T PO QHS' }, { comment: 'Synthetic correction explanation.' }, { acceptable: false },
      { rawSig: 'Take two tablets by mouth daily.' }, { drug: 'Synthetic alternative tablet' },
      { context: { dose: 2 } }, { exclusions: [{ kind: 'code', value: 'QD' }] }, { partId: 'part-two' }, { revision: 2 },
    ];
    for (const change of changes) expect((await store.record(observation(change))).added).toBe(true);
    expect((await store.record(observation({ context: { dose: 2 } }))).added).toBe(false);
    const { records } = await store.page(0);
    expect(records).toHaveLength(changes.length);
    expect(new Set(records.map(row => row.orderId)).size).toBe(1);
    expect(new Set(records.map(row => row.sampleId)).size).toBe(3);
  });

  it('counts all stages without claiming that a passive Framework observation was saved', async () => {
    const store = createSigDatasetStore(name());
    const stages: SigDatasetStage[] = ['source_received', 'reviewed_copy', 'verified_transfer', 'technician_confirmed', 'framework_observed'];
    for (const stage of stages) await store.record(observation({ stage }));
    await store.record(observation({ stage: 'framework_observed', captureKind: 'framework_sig_observation', origin: 'framework', rawSig: '1T PO QAM' }));
    expect(await store.stats()).toEqual({ total: 6, stages: { source_received: 1, reviewed_copy: 1, verified_transfer: 1, technician_confirmed: 1, framework_observed: 2 } });
    const standalone = (await store.page(0)).records.find(row => row.captureKind === 'framework_sig_observation');
    expect(standalone).toMatchObject({ stage: 'framework_observed', rawSig: '1T PO QAM', origin: 'framework' });
  });

  it('stores shared exclusion snapshots once and exports only each page’s referenced policies', async () => {
    const databaseName = name(), store = createSigDatasetStore(databaseName);
    const exclusions = [{ kind: 'code' as const, value: 'QD', replacement: 'QAM' }];
    await store.record(observation({ exclusions }));
    await store.record(observation({ orderKey: 'SYNTHETIC-SECOND', exclusions }));
    await store.record(observation({ orderKey: 'SYNTHETIC-THIRD' }));
    const first = await store.page(0, 2), last = await store.page(first.nextSeq);
    expect(first.hasMore).toBe(true);
    expect(Object.values(first.policies)).toEqual([exclusions]);
    expect(new Set(first.records.map(row => row.exclusionPolicyId)).size).toBe(1);
    expect(last.policies).toEqual({});
    const db = await rawDatabase(databaseName);
    try {
      const count = db.transaction('policies').objectStore('policies').count();
      expect(await new Promise(resolve => { count.onsuccess = () => resolve(count.result); })).toBe(1);
    } finally { db.close(); }
  });

  it('uses a monotonic cursor so newly appended rows cannot sort behind an export', async () => {
    const store = createSigDatasetStore(name());
    for (let i = 0; i < 4; i++) await store.record(observation({ orderKey: `SYNTHETIC-${i}` }));
    const first = await store.page(0, 2);
    await store.record(observation({ orderKey: 'SYNTHETIC-NEW' }));
    const second = await store.page(first.nextSeq, 2), third = await store.page(second.nextSeq, 2);
    expect([first, second, third].flatMap(page => page.records.map(row => row.seq))).toEqual([1, 2, 3, 4, 5]);
    expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
    expect(await store.page(third.nextSeq)).toEqual({ records: [], nextSeq: 5, hasMore: false, policies: {} });
    await expect(store.page(-1)).rejects.toThrow('Invalid');
    await expect(store.page(0, 0)).rejects.toThrow('Invalid');
  });

  it('persists and resets export position across reopening without deleting observations', async () => {
    const databaseName = name(), store = createSigDatasetStore(databaseName);
    expect(await store.exportPosition()).toBe(0);
    await store.record(observation());
    await store.setExportPosition(1000);
    const reopened = createSigDatasetStore(databaseName);
    expect(await reopened.exportPosition()).toBe(1000);
    await reopened.setExportPosition(0);
    expect(await store.exportPosition()).toBe(0);
    expect((await reopened.page(0)).records).toHaveLength(1);
    for (const value of [-1, 0.5, NaN, Infinity]) await expect(store.setExportPosition(value)).rejects.toThrow('Invalid');
    await mutate(databaseName, 'metadata', metadata => { metadata.put(null, 'export-position'); });
    await expect(reopened.exportPosition()).rejects.toThrow('needs recovery');
  });

  it('does not acknowledge an aborted export-position write or advance the old position', async () => {
    const store = createSigDatasetStore(name());
    await store.setExportPosition(1000);
    const original = IDBObjectStore.prototype.put;
    const abort = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (this.name === 'metadata') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(store.setExportPosition(2000)).rejects.toThrow('transaction failed');
    abort.mockRestore();
    expect(await store.exportPosition()).toBe(1000);
  });

  it('acknowledges only committed writes and preserves older rows on abort or quota failure', async () => {
    const store = createSigDatasetStore(name()); await store.record(observation());
    const original = IDBObjectStore.prototype.add;
    const abort = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (this.name === 'samples') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(store.record(observation({ orderKey: 'SYNTHETIC-ABORT' }))).rejects.toThrow('not acknowledged as saved');
    abort.mockRestore();
    const quota = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === 'samples') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    await expect(store.record(observation({ orderKey: 'SYNTHETIC-QUOTA' }))).rejects.toThrow('storage is full');
    quota.mockRestore();
    expect((await store.stats()).total).toBe(1);
    expect((await store.page(0)).records[0].rawSig).toBe(observation().rawSig);
  });

  it('fails explicitly for unsupported storage or identity protection without any fallback', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const localWrites = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('indexedDB', undefined);
    const unsupported = createSigDatasetStore(name());
    await expect(unsupported.record(observation())).rejects.toThrow('requires IndexedDB');
    await expect(unsupported.stats()).rejects.toThrow('requires IndexedDB');
    vi.unstubAllGlobals(); vi.stubGlobal('crypto', undefined);
    await expect(createSigDatasetStore(name()).record(observation())).rejects.toThrow('requires Web Crypto');
    expect(fetch).not.toHaveBeenCalled(); expect(localWrites).not.toHaveBeenCalled();
  });

  it('reports corrupted records and missing identity salt without overwriting them', async () => {
    const databaseName = name(), store = createSigDatasetStore(databaseName); await store.record(observation());
    await mutate(databaseName, 'metadata', metadata => { metadata.delete('identity-salt'); });
    await expect(createSigDatasetStore(databaseName).record(observation({ orderKey: 'SYNTHETIC-NEW' }))).rejects.toThrow('needs recovery');
    expect((await store.stats()).total).toBe(1);
    await mutate(databaseName, 'samples', samples => { samples.put({ seq: 2, schemaVersion: 1, stage: 'unknown-stage' }); });
    await expect(store.page(0)).rejects.toThrow('needs recovery');
    await expect(store.stats()).rejects.toThrow('needs recovery');
  });

  it('collects 10,000 records incrementally without whole-archive reads, rewrites or network traffic', async () => {
    const store = createSigDatasetStore(name());
    const all = vi.spyOn(IDBObjectStore.prototype, 'getAll'), indexAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    const puts = vi.spyOn(IDBObjectStore.prototype, 'put'), localWrites = vi.spyOn(Storage.prototype, 'setItem');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (let batch = 0; batch < 100; batch++) {
      await Promise.all(Array.from({ length: 100 }, (_, i) => store.record(observation({ orderKey: `SYNTHETIC-SCALE-${batch * 100 + i}`, rawSig: `Synthetic dose example ${batch * 100 + i}: take one tablet daily.` }))));
    }
    expect((await store.stats()).total).toBe(10_000);
    const first = await store.page(0), maximum = await store.page(first.nextSeq, 20_000), last = await store.page(maximum.nextSeq, 5000);
    expect(first.records).toHaveLength(1000); expect(maximum.records).toHaveLength(5000); expect(last.records).toHaveLength(4000);
    expect([first.hasMore, maximum.hasMore, last.hasMore]).toEqual([true, true, false]);
    expect(new Set([...first.records, ...maximum.records, ...last.records].map(row => row.seq)).size).toBe(10_000);
    expect(all).not.toHaveBeenCalled(); expect(indexAll).not.toHaveBeenCalled(); expect(puts).not.toHaveBeenCalled();
    expect(localWrites).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  }, 60_000);
});
