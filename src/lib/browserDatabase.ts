/** Local IndexedDB storage. Diagnostic buffers never use localStorage's report quota. */
export interface BrowserRecords {
  get(key: string): Promise<unknown>;
  entries(): Promise<Array<[string, unknown]>>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  merge(items: Array<[string, unknown]>, choose: (existing: unknown, incoming: unknown) => unknown): Promise<void>;
}
const databases = new Map<string, Promise<IDBDatabase>>();
function open(name: string): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable in this browser context.'));
  let promise = databases.get(name);
  if (!promise) {
    promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1); let settled = false;
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records'); };
      request.onerror = () => { settled = true; reject(new Error('Local database could not be opened.')); };
      request.onblocked = () => { settled = true; reject(new Error('Local database is blocked by another page.')); };
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        const db = request.result;
        db.onversionchange = () => { db.close(); databases.delete(name); };
        settled = true; resolve(db);
      };
    }).catch(error => { databases.delete(name); throw error; });
    databases.set(name, promise);
  }
  return promise;
}
export function browserRecords(name: string): BrowserRecords {
  async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, setResult: (value: T) => void) => void): Promise<T> {
    const db = await open(name);
    return new Promise<T>((resolve, reject) => {
      let result: T; const tx = db.transaction('records', mode);
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(new Error('Local database transaction failed; its data was not acknowledged as saved.'));
      try { work(tx.objectStore('records'), value => { result = value; }); }
      catch { tx.abort(); }
    });
  }
  return {
    get: key => transaction('readonly', (store, set) => { const request = store.get(key); request.onsuccess = () => set(request.result); }),
    entries: () => transaction('readonly', (store, set) => {
      const items: Array<[string, unknown]> = []; const request = store.openCursor();
      request.onsuccess = () => { const cursor = request.result; if (!cursor) { set(items); return; } if (typeof cursor.key === 'string') items.push([cursor.key, cursor.value]); cursor.continue(); };
    }),
    put: (key, value) => transaction('readwrite', store => { store.put(value, key); }),
    remove: key => transaction('readwrite', store => { store.delete(key); }),
    merge: (items, choose) => transaction('readwrite', store => {
      for (const [key, value] of items) {
        const request = store.get(key);
        request.onsuccess = () => { try { store.put(choose(request.result, value), key); } catch { store.transaction.abort(); } };
      }
    }),
  };
}
