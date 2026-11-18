import type { SigExclusion } from './reviewPolicy';

/** Sensitive clinical text stays on this workstation. This module never sends data. */
export type SigDatasetStage = 'source_received' | 'reviewed_copy' | 'verified_transfer' | 'technician_confirmed' | 'framework_observed';
export interface SigDatasetInput {
  /** Identity input only: never stored in plaintext or included in exports. */
  orderKey: string;
  revision: number;
  drug: string;
  rawSig: string;
  generatedSig?: string;
  suggestedSig?: string;
  finalSig?: string;
  partId?: string;
  stage: SigDatasetStage;
  captureKind?: 'erx_source' | 'framework_sig_observation';
  origin?: 'iguana' | 'manual' | 'framework' | 'demo';
  context?: { ndc?: string; strength?: string; dose?: string | number; doseUnit?: string; route?: string; frequency?: string; administrationTimes?: string[] };
  exclusions?: SigExclusion[];
  warnings?: string[];
  comment?: string;
  acceptable?: boolean;
}
export interface SigDatasetRecord extends Omit<SigDatasetInput, 'orderKey' | 'partId' | 'exclusions'> {
  schemaVersion: 1;
  seq: number;
  capturedAt: string;
  appVersion: string;
  buildId: string;
  orderId: string;
  sampleId: string;
  dedupKey: string;
  exclusionPolicyId?: string;
}
export interface SigDatasetPage {
  records: SigDatasetRecord[];
  nextSeq: number;
  hasMore: boolean;
  /** Shared exclusion snapshots referenced by this bounded batch only. */
  policies: Record<string, SigExclusion[]>;
}
export interface SigDatasetStore {
  record(input: SigDatasetInput): Promise<{ added: boolean; seq: number }>;
  stats(): Promise<{ total: number; stages: Record<SigDatasetStage, number> }>;
  page(afterSeq: number, limit?: number): Promise<SigDatasetPage>;
}

const STAGES: SigDatasetStage[] = ['source_received', 'reviewed_copy', 'verified_transfer', 'technician_confirmed', 'framework_observed'];
const HEX = /^[a-f0-9]{64}$/;
const CORRUPT = 'The local SIG dataset needs recovery. Existing samples were preserved.';
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const validExclusions = (value: unknown): value is SigExclusion[] => Array.isArray(value) && value.every(item =>
  isObject(item) && (item.kind === 'code' || item.kind === 'sig') && typeof item.value === 'string' && optionalString(item.replacement));

function storageError(error: unknown): Error {
  if (error instanceof Error && (error.message === CORRUPT || error.message.startsWith('Local SIG dataset') || error.message.startsWith('Invalid SIG dataset'))) return error;
  if (isObject(error) && error.name === 'QuotaExceededError') return new Error('Local SIG dataset storage is full. Free workstation storage and retry; this sample was not acknowledged as saved.');
  return new Error('Local SIG dataset transaction failed. Retry after checking workstation storage; this sample was not acknowledged as saved.');
}

function clinicalFields(input: SigDatasetInput): Omit<SigDatasetInput, 'orderKey' | 'partId' | 'exclusions'> {
  if (!isObject(input) || !Number.isSafeInteger(input.revision) || input.revision < 0 || !STAGES.includes(input.stage) || typeof input.drug !== 'string' || typeof input.rawSig !== 'string') throw new Error('Invalid SIG dataset observation.');
  const result: Omit<SigDatasetInput, 'orderKey' | 'partId' | 'exclusions'> = { revision: input.revision, stage: input.stage, drug: input.drug, rawSig: input.rawSig, captureKind: input.captureKind ?? 'erx_source' };
  if (!['erx_source', 'framework_sig_observation'].includes(result.captureKind!)) throw new Error('Invalid SIG dataset capture kind.');
  for (const key of ['generatedSig', 'suggestedSig', 'finalSig', 'comment'] as const) {
    if (!optionalString(input[key])) throw new Error('Invalid SIG dataset text.');
    if (input[key] !== undefined) result[key] = input[key];
  }
  if (input.origin !== undefined) {
    if (!['iguana', 'manual', 'framework', 'demo'].includes(input.origin)) throw new Error('Invalid SIG dataset origin.');
    result.origin = input.origin;
  }
  if (input.acceptable !== undefined) {
    if (typeof input.acceptable !== 'boolean') throw new Error('Invalid SIG dataset rating.');
    result.acceptable = input.acceptable;
  }
  if (input.warnings !== undefined) {
    if (!stringArray(input.warnings)) throw new Error('Invalid SIG dataset warnings.');
    result.warnings = [...input.warnings];
  }
  if (input.context !== undefined) {
    if (!isObject(input.context)) throw new Error('Invalid SIG dataset context.');
    result.context = {};
    for (const key of ['ndc', 'strength', 'doseUnit', 'route', 'frequency'] as const) {
      if (!optionalString(input.context[key])) throw new Error('Invalid SIG dataset context.');
      if (input.context[key] !== undefined) result.context[key] = input.context[key];
    }
    if (input.context.dose !== undefined) {
      if (typeof input.context.dose !== 'string' && !(typeof input.context.dose === 'number' && Number.isFinite(input.context.dose))) throw new Error('Invalid SIG dataset dose.');
      result.context.dose = input.context.dose;
    }
    if (input.context.administrationTimes !== undefined) {
      if (!stringArray(input.context.administrationTimes)) throw new Error('Invalid SIG dataset administration times.');
      result.context.administrationTimes = [...input.context.administrationTimes];
    }
  }
  return result;
}

function validRecord(value: unknown): value is SigDatasetRecord {
  if (!isObject(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.seq) || (value.seq as number) < 1 || typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt)) || typeof value.appVersion !== 'string' || typeof value.buildId !== 'string' || !HEX.test(String(value.orderId)) || !HEX.test(String(value.sampleId)) || !HEX.test(String(value.dedupKey)) || value.exclusionPolicyId !== undefined && !HEX.test(String(value.exclusionPolicyId))) return false;
  const fields = ['schemaVersion', 'seq', 'capturedAt', 'appVersion', 'buildId', 'orderId', 'sampleId', 'dedupKey', 'exclusionPolicyId', 'revision', 'stage', 'drug', 'rawSig', 'captureKind', 'origin', 'generatedSig', 'suggestedSig', 'finalSig', 'comment', 'acceptable', 'warnings', 'context'];
  if (Object.keys(value).some(key => !fields.includes(key))) return false;
  if (isObject(value.context) && Object.keys(value.context).some(key => !['ndc', 'strength', 'dose', 'doseUnit', 'route', 'frequency', 'administrationTimes'].includes(key))) return false;
  try { clinicalFields(value as unknown as SigDatasetInput); return true; } catch { return false; }
}

function guarded(fail: (error: unknown) => void, work: () => void): () => void {
  return () => { try { work(); } catch (error) { fail(error); } };
}

function transact<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, set: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(stores, mode); } catch (error) { reject(storageError(error)); return; }
    let result: T, hasResult = false, failure: unknown;
    const fail = (error: unknown) => { failure = error; try { tx.abort(); } catch { reject(storageError(error)); } };
    tx.oncomplete = () => { if (hasResult) resolve(result); else reject(new Error(CORRUPT)); };
    tx.onerror = event => { failure ??= (event.target as IDBRequest).error || tx.error; };
    tx.onabort = () => reject(storageError(failure || tx.error));
    try { work(tx, value => { result = value; hasResult = true; }, fail); } catch (error) { fail(error); }
  });
}

export function createSigDatasetStore(name = 'sig-assist-local-sig-dataset-v1'): SigDatasetStore {
  let database: Promise<IDBDatabase> | undefined;
  let salt: Promise<string> | undefined;
  function open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Local SIG dataset storage requires IndexedDB in this browser.'));
    if (!database) {
      database = new Promise<IDBDatabase>((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try { request = indexedDB.open(name, 1); } catch (error) { reject(storageError(error)); return; }
        let settled = false;
        request.onupgradeneeded = () => {
          const db = request.result;
          const samples = db.createObjectStore('samples', { keyPath: 'seq', autoIncrement: true });
          samples.createIndex('dedupKey', 'dedupKey', { unique: true });
          samples.createIndex('stage', 'stage');
          db.createObjectStore('metadata'); db.createObjectStore('policies');
        };
        request.onerror = () => { settled = true; reject(storageError(request.error)); };
        request.onblocked = () => { settled = true; reject(new Error('Local SIG dataset storage is blocked by another page. Close the older page and retry.')); };
        request.onsuccess = () => {
          const db = request.result;
          if (settled) { db.close(); return; }
          try {
            const store = db.transaction(['samples', 'metadata', 'policies']).objectStore('samples');
            if (store.keyPath !== 'seq' || !store.autoIncrement || !store.index('dedupKey').unique || store.index('dedupKey').keyPath !== 'dedupKey' || store.index('stage').keyPath !== 'stage') throw new Error(CORRUPT);
          } catch { db.close(); reject(new Error(CORRUPT)); return; }
          db.onversionchange = () => { db.close(); database = undefined; salt = undefined; };
          db.onclose = () => { database = undefined; salt = undefined; };
          settled = true; resolve(db);
        };
      }).catch(error => { database = undefined; salt = undefined; throw error; });
    }
    return database;
  }
  function identitySalt(db: IDBDatabase): Promise<string> {
    if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return Promise.reject(new Error('Local SIG dataset identity protection requires Web Crypto in this browser.'));
    if (!salt) salt = transact<string>(db, ['metadata', 'samples'], 'readwrite', (tx, set, fail) => {
      const metadata = tx.objectStore('metadata'), request = metadata.get('identity-salt');
      request.onsuccess = () => {
        if (request.result !== undefined) {
          if (typeof request.result !== 'string' || !HEX.test(request.result)) { fail(new Error(CORRUPT)); return; }
          set(request.result); return;
        }
        const count = tx.objectStore('samples').count();
        count.onsuccess = () => {
          if (count.result) { fail(new Error(CORRUPT)); return; }
          try {
            const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
            metadata.add(value, 'identity-salt'); set(value);
          } catch (error) { fail(error); }
        };
      };
    }).catch(error => { salt = undefined; throw error; });
    return salt;
  }
  async function hash(secret: string, fields: unknown[]): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([secret, ...fields])));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return {
    async record(input) {
      if (!isObject(input) || typeof input.orderKey !== 'string' || !input.orderKey.trim() || !optionalString(input.partId)) throw new Error('Invalid SIG dataset identity.');
      const clinical = clinicalFields(input), capturedAt = new Date().toISOString();
      const exclusions = input.exclusions === undefined ? [] : input.exclusions;
      if (!validExclusions(exclusions)) throw new Error('Invalid SIG dataset exclusions.');
      const policy = exclusions.map(({ kind, value, replacement }) => ({ kind, value, ...(replacement === undefined ? {} : { replacement }) }));
      const orderKey = input.orderKey, partId = input.partId ?? null;
      const db = await open(), secret = await identitySalt(db);
      const [orderId, sampleId, exclusionPolicyId] = await Promise.all([
        hash(secret, ['order', orderKey]), hash(secret, ['sample', orderKey, clinical.revision, partId]),
        policy.length ? hash(secret, ['policy', policy]) : Promise.resolve(undefined),
      ]);
      // Capture every changed correction, source, context, policy and feedback
      // observation, even when its final SIG text happens to be identical.
      const dedupKey = await hash(secret, ['dedup', sampleId, clinical, exclusionPolicyId ?? null, __SIG_ASSIST_BUILD__]);
      const row = { schemaVersion: 1 as const, capturedAt, appVersion: __SIG_ASSIST_VERSION__, buildId: __SIG_ASSIST_BUILD__, orderId, sampleId, dedupKey, ...clinical, ...(exclusionPolicyId ? { exclusionPolicyId } : {}) };
      return transact(db, ['samples', 'policies'], 'readwrite', (tx, set, fail) => {
        const samples = tx.objectStore('samples'), existing = samples.index('dedupKey').get(dedupKey);
        existing.onsuccess = guarded(fail, () => {
          if (existing.result !== undefined) {
            if (!validRecord(existing.result)) { fail(new Error(CORRUPT)); return; }
            set({ added: false, seq: existing.result.seq }); return;
          }
          const add = () => { const request = samples.add(row); request.onsuccess = () => set({ added: true, seq: request.result as number }); };
          if (!exclusionPolicyId) { add(); return; }
          const policies = tx.objectStore('policies'), previous = policies.get(exclusionPolicyId);
          previous.onsuccess = guarded(fail, () => {
            if (previous.result !== undefined && (!validExclusions(previous.result) || JSON.stringify(previous.result) !== JSON.stringify(policy))) { fail(new Error(CORRUPT)); return; }
            if (previous.result === undefined) policies.add(policy, exclusionPolicyId);
            add();
          });
        });
      });
    },
    async stats() {
      const db = await open();
      return transact(db, ['samples'], 'readonly', (tx, set, fail) => {
        const samples = tx.objectStore('samples'), stages = Object.fromEntries(STAGES.map(stage => [stage, 0])) as Record<SigDatasetStage, number>;
        let total = 0, pending = STAGES.length + 1;
        const done = () => { if (--pending === 0) { if (Object.values(stages).reduce((a, b) => a + b, 0) !== total) fail(new Error(CORRUPT)); else set({ total, stages }); } };
        const count = samples.count(); count.onsuccess = () => { total = count.result; done(); };
        for (const stage of STAGES) { const count = samples.index('stage').count(stage); count.onsuccess = () => { stages[stage] = count.result; done(); }; }
      });
    },
    async page(afterSeq, limit = 1000) {
      if (!Number.isSafeInteger(afterSeq) || afterSeq < 0 || !Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid SIG dataset page cursor or limit.');
      const maximum = Math.min(limit, 5000), db = await open();
      return transact(db, ['samples', 'policies'], 'readonly', (tx, set, fail) => {
        const result: SigDatasetPage = { records: [], nextSeq: afterSeq, hasMore: false, policies: {} };
        const request = tx.objectStore('samples').openCursor(IDBKeyRange.lowerBound(afterSeq, true));
        const finish = () => {
          const ids = [...new Set(result.records.map(row => row.exclusionPolicyId).filter((id): id is string => !!id))];
          if (!ids.length) { set(result); return; }
          let pending = ids.length;
          for (const id of ids) {
            const policy = tx.objectStore('policies').get(id);
            policy.onsuccess = () => {
              if (!validExclusions(policy.result)) { fail(new Error(CORRUPT)); return; }
              result.policies[id] = policy.result;
              if (--pending === 0) set(result);
            };
          }
        };
        request.onsuccess = guarded(fail, () => {
          const cursor = request.result;
          if (!cursor) { finish(); return; }
          if (result.records.length === maximum) { result.hasMore = true; finish(); return; }
          if (!validRecord(cursor.value) || cursor.value.seq !== cursor.primaryKey) { fail(new Error(CORRUPT)); return; }
          result.records.push(cursor.value); result.nextSeq = cursor.value.seq; cursor.continue();
        });
      });
    },
  };
}

export const sigDatasetStore = createSigDatasetStore();
