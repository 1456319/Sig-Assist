import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getCitrixStorageAdapter,
  StoredQueueOrder,
  DEFAULT_PREFERENCES,
  _resetCitrixStorageAdapterForTesting,
} from '../src/lib/citrixStorage';
import { DiscrepancyReport, TechnicianPreferences } from '../src/lib/clinical/types';

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

function createMockDirectoryHandle() {
  const files = new Map<string, string>();

  const mockDirHandle = {
    files,
    getFileHandle: vi.fn(async (filename: string, options?: { create?: boolean }) => {
      if (!files.has(filename)) {
        if (options?.create) {
          files.set(filename, '');
        } else {
          throw new Error(`File not found: ${filename}`);
        }
      }

      return {
        name: filename,
        getFile: vi.fn(async () => ({
          text: vi.fn(async () => files.get(filename) ?? ''),
        })),
        createWritable: vi.fn(async () => {
          let buffer = '';
          return {
            write: vi.fn(async (content: string) => {
              buffer = content;
            }),
            close: vi.fn(async () => {
              files.set(filename, buffer);
            }),
          };
        }),
      };
    }),
  };

  return mockDirHandle;
}

describe('citrixStorage', () => {
  beforeEach(() => {
    _resetCitrixStorageAdapterForTesting();
    localStorage.clear();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    if ((globalThis as unknown as { window?: { showDirectoryPicker?: unknown } }).window) {
      delete (globalThis as unknown as { window: { showDirectoryPicker?: unknown } }).window.showDirectoryPicker;
    }
  });

  it('initializes with fallback browser_cache mode when File System API is unavailable in Node/test', () => {
    const adapter = getCitrixStorageAdapter();
    expect(adapter.getStorageMode()).toBe('browser_cache');
    expect(adapter.isConnected()).toBe(false);
  });

  it('reads and writes queue orders reliably in storage', async () => {
    const adapter = getCitrixStorageAdapter();
    const testOrders: StoredQueueOrder[] = [
      {
        id: 'test_1',
        pon: 'PON123',
        drugName: 'PROTONIX 40MG',
        rawProse: 'Give 1 tablet PO QD',
        suggestedSig: '1T PO QD',
        draftSig: '1T PO QD',
        isReviewed: true,
        status: 'completed',
      },
    ];

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
      flaggedForRph: false,
    });

    const reports = await adapter.readDiscrepancies();
    expect(reports.length).toBe(1);
    expect(reports[0].technicianSig).toBe('COU PO QHS');
  });

  it('returns DEFAULT_PREFERENCES initially, and persists custom preferences via writePreferences', async () => {
    const adapter = getCitrixStorageAdapter();
    const initial = await adapter.readPreferences();
    expect(initial).toEqual(DEFAULT_PREFERENCES);

    const customPrefs: TechnicianPreferences = {
      version: 1,
      drugCodeOverrides: {
        LISINOPRIL: 'LIS',
        METFORMIN: 'MET',
      },
      defaultAdminTimes: {
        LIS: '0900',
      },
    };

    await adapter.writePreferences(customPrefs);
    const retrieved = await adapter.readPreferences();
    expect(retrieved).toEqual(customPrefs);
  });

  it('returns false when connectDirectory is called and showDirectoryPicker is unavailable', async () => {
    const adapter = getCitrixStorageAdapter();
    const connected = await adapter.connectDirectory();
    expect(connected).toBe(false);
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getStorageMode()).toBe('browser_cache');
  });

  it('returns false if showDirectoryPicker throws an error (e.g. user cancelled prompt)', async () => {
    const adapter = getCitrixStorageAdapter();
    (globalThis as unknown as { window: unknown }).window = {
      showDirectoryPicker: vi.fn().mockRejectedValue(new Error('The user aborted a request.')),
    };

    const connected = await adapter.connectDirectory();
    expect(connected).toBe(false);
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getStorageMode()).toBe('browser_cache');
  });

  it('dispatches to FileSystemDirectoryHandle when connected, reading and writing JSON files', async () => {
    const mockDirHandle = createMockDirectoryHandle();
    (globalThis as unknown as { window: unknown }).window = {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockDirHandle),
    };

    const adapter = getCitrixStorageAdapter();
    const connected = await adapter.connectDirectory();
    expect(connected).toBe(true);
    expect(adapter.isConnected()).toBe(true);
    expect(adapter.getStorageMode()).toBe('file_system');

    // 1. writeQueue & readQueue to queue.json
    const testOrders: StoredQueueOrder[] = [
      {
        id: 'ord_fs_1',
        pon: 'PON_FS_100',
        drugName: 'ELIQUIS 5MG',
        rawProse: 'Take 1 tab PO BID',
        suggestedSig: '1T PO BID',
        draftSig: '1T PO BID',
        isReviewed: true,
        status: 'completed',
      },
    ];

    await adapter.writeQueue(testOrders);
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('queue.json', { create: true });
    expect(mockDirHandle.files.has('queue.json')).toBe(true);
    expect(JSON.parse(mockDirHandle.files.get('queue.json')!)).toEqual(testOrders);

    const loadedOrders = await adapter.readQueue();
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('queue.json');
    expect(loadedOrders).toEqual(testOrders);

    // 2. appendDiscrepancy & readDiscrepancies to discrepancies.json
    const testReport: DiscrepancyReport = {
      id: 'disc_fs_1',
      timestamp: '2026-09-18T10:00:00.000Z',
      pon: 'PON_FS_100',
      drugName: 'ELIQUIS 5MG',
      rawProse: 'Take 1 tab PO BID',
      generatedSig: '1T PO BID',
      technicianSig: '1T PO BID 0900,1700',
      notes: 'Specify admin hours',
      flaggedForRph: false,
    };

    await adapter.appendDiscrepancy(testReport);
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('discrepancies.json', { create: true });
    expect(mockDirHandle.files.has('discrepancies.json')).toBe(true);
    expect(JSON.parse(mockDirHandle.files.get('discrepancies.json')!)).toEqual([testReport]);

    const loadedDiscrepancies = await adapter.readDiscrepancies();
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('discrepancies.json');
    expect(loadedDiscrepancies).toEqual([testReport]);

    // 3. writePreferences & readPreferences to preferences.json
    const customPrefs: TechnicianPreferences = {
      version: 1,
      drugCodeOverrides: { ELIQUIS: 'ELI' },
      defaultAdminTimes: { ELI: '0900,2100' },
    };

    await adapter.writePreferences(customPrefs);
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('preferences.json', { create: true });
    expect(mockDirHandle.files.has('preferences.json')).toBe(true);

    const loadedPrefs = await adapter.readPreferences();
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('preferences.json');
    expect(loadedPrefs).toEqual(customPrefs);
  });

  it('falls back gracefully to localStorage if file system write/read throws', async () => {
    const failingDirHandle = {
      getFileHandle: vi.fn().mockRejectedValue(new Error('Permission denied')),
    };

    (globalThis as unknown as { window: unknown }).window = {
      showDirectoryPicker: vi.fn().mockResolvedValue(failingDirHandle),
    };

    const adapter = getCitrixStorageAdapter();
    await adapter.connectDirectory();
    expect(adapter.isConnected()).toBe(true);

    // writeQueue should fall back to localStorage
    const testOrders: StoredQueueOrder[] = [
      {
        id: 'ord_fallback',
        pon: 'PON_FALLBACK',
        drugName: 'METOPROLOL 25MG',
        rawProse: '1 tab daily',
        suggestedSig: '1T PO QD',
        draftSig: '1T PO QD',
        isReviewed: false,
        status: 'pending',
      },
    ];

    await adapter.writeQueue(testOrders);
    const storedInLocal = localStorage.getItem('citrix_storage_queue');
    expect(storedInLocal).toBeTruthy();
    expect(JSON.parse(storedInLocal!)).toEqual(testOrders);

    // readQueue should fall back to localStorage
    const loadedOrders = await adapter.readQueue();
    expect(loadedOrders).toEqual(testOrders);
  });

  it('guards against localStorage quota errors gracefully without throwing', async () => {
    const adapter = getCitrixStorageAdapter();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    await expect(adapter.writeQueue([])).resolves.toBeUndefined();
    await expect(adapter.writePreferences(DEFAULT_PREFERENCES)).resolves.toBeUndefined();
  });

  it('resets singleton instance cleanly with _resetCitrixStorageAdapterForTesting', () => {
    const adapter1 = getCitrixStorageAdapter();
    (adapter1 as unknown as { testMarker?: number }).testMarker = 42;

    _resetCitrixStorageAdapterForTesting();
    const adapter2 = getCitrixStorageAdapter();
    expect((adapter2 as unknown as { testMarker?: number }).testMarker).toBeUndefined();
    expect(adapter1).not.toBe(adapter2);
  });
});
