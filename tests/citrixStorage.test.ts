import { describe, expect, it, beforeEach } from 'vitest';
import { getCitrixStorageAdapter, StoredQueueOrder } from '../src/lib/citrixStorage';

// In Node 22+ environments without a browser DOM, ensure localStorage is cleanly defined without experimental warnings
if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !localStorage.clear) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    writable: true,
    configurable: true,
  });
}

describe('citrixStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with fallback browser_cache mode when File System API is unavailable in Node/test', () => {
    const adapter = getCitrixStorageAdapter();
    expect(adapter.getStorageMode()).toBe('browser_cache');
    expect(adapter.isConnected()).toBe(false);
  });

  it('reads and writes queue orders reliably in storage', async () => {
    const adapter = getCitrixStorageAdapter();
    const testOrders: StoredQueueOrder[] = [{
      id: 'test_1',
      pon: 'PON123',
      drugName: 'PROTONIX 40MG',
      rawProse: 'Give 1 tablet PO QD',
      suggestedSig: '1T PO QD',
      draftSig: '1T PO QD',
      isReviewed: true,
      status: 'completed'
    }];

    await adapter.writeQueue(testOrders);
    const loaded = await adapter.readQueue();
    expect(loaded.length).toBe(1);
    expect(loaded[0].pon).toBe('PON123');
  });

  it('appends and loads discrepancy reports', async () => {
    const adapter = getCitrixStorageAdapter();
    await adapter.appendDiscrepancy({
      id: 'disc_1',
      timestamp: new Date().toISOString(),
      pon: 'PON999',
      drugName: 'WARFARIN 5MG',
      rawProse: 'Give 1 tab at bedtime',
      generatedSig: '1T PO QHS',
      technicianSig: 'COU PO QHS',
      notes: 'Prefer COU for 1800 admin time',
      flaggedForRph: false
    });

    const reports = await adapter.readDiscrepancies();
    expect(reports.length).toBe(1);
    expect(reports[0].technicianSig).toBe('COU PO QHS');
  });
});
