import { DiscrepancyReport, TechnicianPreferences } from './clinical/types';

import type { OrderSource } from './orderQueue';

export interface StoredQueueOrder {
  id: string;
  pon: string;
  drugName: string;
  rawProse: string;
  suggestedSig: string;
  draftSig: string;
  isReviewed: boolean;
  status: 'pending' | 'completed' | 'skipped';
  facility?: string;
  patientRef?: string;
  revision?: number;
  previousSources?: OrderSource[];
  cancelled?: boolean;
}

export interface CitrixStorageAdapter {
  isConnected(): boolean;
  getStorageMode(): 'file_system' | 'browser_cache';
  connectDirectory(): Promise<boolean>;
  readQueue(): Promise<StoredQueueOrder[]>;
  writeQueue(orders: StoredQueueOrder[], options?: { immediate?: boolean; debounceMs?: number }): Promise<void>;
  readDiscrepancies(): Promise<DiscrepancyReport[]>;
  appendDiscrepancy(report: DiscrepancyReport, options?: { immediate?: boolean; debounceMs?: number }): Promise<void>;
  readPreferences(): Promise<TechnicianPreferences>;
  writePreferences(prefs: TechnicianPreferences, options?: { immediate?: boolean; debounceMs?: number }): Promise<void>;
  flushPendingWrites(): Promise<void>;
  flush(): Promise<void>;
  setDebounceDelay?(ms: number): void;
  getDebounceDelay?(): number;
}

export const DEFAULT_PREFERENCES: TechnicianPreferences = {
  version: 1,
  drugCodeOverrides: {
    WARFARIN: 'COU',
    COUMADIN: 'COU',
  },
  defaultAdminTimes: {
    COU: '1800',
  },
};

class MemoryCitrixStorageAdapter implements CitrixStorageAdapter {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private debounceDelayMs: number =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 500;

  private pendingQueue: StoredQueueOrder[] | null = null;
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  private queueResolvers: Array<() => void> = [];

  private pendingDiscrepancies: DiscrepancyReport[] | null = null;
  private discrepanciesTimer: ReturnType<typeof setTimeout> | null = null;
  private discrepanciesResolvers: Array<() => void> = [];

  private pendingPreferences: TechnicianPreferences | null = null;
  private preferencesTimer: ReturnType<typeof setTimeout> | null = null;
  private preferencesResolvers: Array<() => void> = [];

  private isWriting = false;
  private writeQueueItems: Array<() => Promise<void>> = [];

  private async processWriteQueue() {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      while (this.writeQueueItems.length > 0) {
        const task = this.writeQueueItems.shift();
        if (task) await task();
      }
    } finally {
      this.isWriting = false;
    }
  }

  isConnected(): boolean {
    return this.dirHandle !== null;
  }

  getStorageMode(): 'file_system' | 'browser_cache' {
    return this.dirHandle ? 'file_system' : 'browser_cache';
  }

  setDebounceDelay(ms: number): void {
    this.debounceDelayMs = ms;
  }

  getDebounceDelay(): number {
    return this.debounceDelayMs;
  }

  async connectDirectory(): Promise<boolean> {
    const win =
      typeof window !== 'undefined'
        ? (window as unknown as { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle> })
        : typeof globalThis !== 'undefined'
          ? (globalThis as unknown as { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle> })
          : undefined;

    if (!win || typeof win.showDirectoryPicker !== 'function') {
      return false;
    }
    try {
      this.dirHandle = await win.showDirectoryPicker();
      return true;
    } catch {
      return false;
    }
  }

  private async readFile<T>(filename: string): Promise<T | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private async writeFile(filename: string, data: unknown): Promise<boolean> {
    if (!this.dirHandle) return false;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  private readLocalStorage<T>(key: string, fallback: T): T {
    if (typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          return JSON.parse(data) as T;
        }
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  private writeLocalStorage(key: string, value: unknown): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // guard against storage quota errors or restricted environments
      }
    }
  }

  private async commitWrite(
    filename: string,
    storageKey: string,
    data: unknown,
    resolvers: Array<() => void> = []
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.writeQueueItems.push(async () => {
        try {
          let written = false;
          if (this.dirHandle) {
            written = await this.writeFile(filename, data);
          }
          if (!written) {
            this.writeLocalStorage(storageKey, data);
          }
          resolvers.forEach((r) => r());
        } catch {
          resolvers.forEach((r) => r());
        }
        resolve();
      });
      this.processWriteQueue();
    });
  }

  async readQueue(): Promise<StoredQueueOrder[]> {
    if (this.pendingQueue !== null) {
      return this.pendingQueue;
    }
    let data: StoredQueueOrder[] | null = null;
    if (this.dirHandle) {
      data = await this.readFile<StoredQueueOrder[]>('queue.json');
    }
    if (data !== null) {
      return data;
    }
    return this.readLocalStorage<StoredQueueOrder[]>('citrix_storage_queue', []);
  }

  async writeQueue(
    orders: StoredQueueOrder[],
    options?: { immediate?: boolean; debounceMs?: number }
  ): Promise<void> {
    const delay = options?.immediate ? 0 : (options?.debounceMs ?? this.debounceDelayMs);

    if (delay <= 0) {
      this.pendingQueue = null;
      if (this.queueTimer) {
        clearTimeout(this.queueTimer);
        this.queueTimer = null;
      }
      const prevResolvers = this.queueResolvers;
      this.queueResolvers = [];
      await this.commitWrite('queue.json', 'citrix_storage_queue', orders, prevResolvers);
      return;
    }

    this.pendingQueue = orders;
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
    }

    return new Promise<void>((resolve) => {
      this.queueResolvers.push(resolve);
      this.queueTimer = setTimeout(async () => {
        this.queueTimer = null;
        const currentData = this.pendingQueue;
        this.pendingQueue = null;
        const currentResolvers = this.queueResolvers;
        this.queueResolvers = [];
        if (currentData !== null) {
          await this.commitWrite('queue.json', 'citrix_storage_queue', currentData, currentResolvers);
        }
      }, delay);
    });
  }

  async readDiscrepancies(): Promise<DiscrepancyReport[]> {
    if (this.pendingDiscrepancies !== null) {
      return this.pendingDiscrepancies;
    }
    let data: DiscrepancyReport[] | null = null;
    if (this.dirHandle) {
      data = await this.readFile<DiscrepancyReport[]>('discrepancies.json');
    }
    if (data !== null) {
      return data;
    }
    return this.readLocalStorage<DiscrepancyReport[]>('citrix_storage_discrepancies', []);
  }

  async appendDiscrepancy(
    report: DiscrepancyReport,
    options?: { immediate?: boolean; debounceMs?: number }
  ): Promise<void> {
    const existing = await this.readDiscrepancies();
    const updated = [...existing, report];
    const delay = options?.immediate ? 0 : (options?.debounceMs ?? this.debounceDelayMs);

    if (delay <= 0) {
      this.pendingDiscrepancies = null;
      if (this.discrepanciesTimer) {
        clearTimeout(this.discrepanciesTimer);
        this.discrepanciesTimer = null;
      }
      const prevResolvers = this.discrepanciesResolvers;
      this.discrepanciesResolvers = [];
      await this.commitWrite('discrepancies.json', 'citrix_storage_discrepancies', updated, prevResolvers);
      return;
    }

    this.pendingDiscrepancies = updated;
    if (this.discrepanciesTimer) {
      clearTimeout(this.discrepanciesTimer);
    }

    return new Promise<void>((resolve) => {
      this.discrepanciesResolvers.push(resolve);
      this.discrepanciesTimer = setTimeout(async () => {
        this.discrepanciesTimer = null;
        const currentData = this.pendingDiscrepancies;
        this.pendingDiscrepancies = null;
        const currentResolvers = this.discrepanciesResolvers;
        this.discrepanciesResolvers = [];
        if (currentData !== null) {
          await this.commitWrite('discrepancies.json', 'citrix_storage_discrepancies', currentData, currentResolvers);
        }
      }, delay);
    });
  }

  async readPreferences(): Promise<TechnicianPreferences> {
    if (this.pendingPreferences !== null) {
      return this.pendingPreferences;
    }
    let data: TechnicianPreferences | null = null;
    if (this.dirHandle) {
      data = await this.readFile<TechnicianPreferences>('preferences.json');
    }
    if (data !== null) {
      return data;
    }
    return this.readLocalStorage<TechnicianPreferences>(
      'citrix_storage_preferences',
      DEFAULT_PREFERENCES
    );
  }

  async writePreferences(
    prefs: TechnicianPreferences,
    options?: { immediate?: boolean; debounceMs?: number }
  ): Promise<void> {
    const delay = options?.immediate ? 0 : (options?.debounceMs ?? this.debounceDelayMs);

    if (delay <= 0) {
      this.pendingPreferences = null;
      if (this.preferencesTimer) {
        clearTimeout(this.preferencesTimer);
        this.preferencesTimer = null;
      }
      const prevResolvers = this.preferencesResolvers;
      this.preferencesResolvers = [];
      await this.commitWrite('preferences.json', 'citrix_storage_preferences', prefs, prevResolvers);
      return;
    }

    this.pendingPreferences = prefs;
    if (this.preferencesTimer) {
      clearTimeout(this.preferencesTimer);
    }

    return new Promise<void>((resolve) => {
      this.preferencesResolvers.push(resolve);
      this.preferencesTimer = setTimeout(async () => {
        this.preferencesTimer = null;
        const currentData = this.pendingPreferences;
        this.pendingPreferences = null;
        const currentResolvers = this.preferencesResolvers;
        this.preferencesResolvers = [];
        if (currentData !== null) {
          await this.commitWrite('preferences.json', 'citrix_storage_preferences', currentData, currentResolvers);
        }
      }, delay);
    });
  }

  async flushPendingWrites(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.queueTimer || this.pendingQueue !== null) {
      if (this.queueTimer) {
        clearTimeout(this.queueTimer);
        this.queueTimer = null;
      }
      const currentData = this.pendingQueue;
      this.pendingQueue = null;
      const currentResolvers = this.queueResolvers;
      this.queueResolvers = [];
      if (currentData !== null) {
        promises.push(this.commitWrite('queue.json', 'citrix_storage_queue', currentData, currentResolvers));
      }
    }

    if (this.discrepanciesTimer || this.pendingDiscrepancies !== null) {
      if (this.discrepanciesTimer) {
        clearTimeout(this.discrepanciesTimer);
        this.discrepanciesTimer = null;
      }
      const currentData = this.pendingDiscrepancies;
      this.pendingDiscrepancies = null;
      const currentResolvers = this.discrepanciesResolvers;
      this.discrepanciesResolvers = [];
      if (currentData !== null) {
        promises.push(this.commitWrite('discrepancies.json', 'citrix_storage_discrepancies', currentData, currentResolvers));
      }
    }

    if (this.preferencesTimer || this.pendingPreferences !== null) {
      if (this.preferencesTimer) {
        clearTimeout(this.preferencesTimer);
        this.preferencesTimer = null;
      }
      const currentData = this.pendingPreferences;
      this.pendingPreferences = null;
      const currentResolvers = this.preferencesResolvers;
      this.preferencesResolvers = [];
      if (currentData !== null) {
        promises.push(this.commitWrite('preferences.json', 'citrix_storage_preferences', currentData, currentResolvers));
      }
    }

    await Promise.all(promises);
  }

  async flush(): Promise<void> {
    return this.flushPendingWrites();
  }

  clearPendingTimers(): void {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
    if (this.discrepanciesTimer) {
      clearTimeout(this.discrepanciesTimer);
      this.discrepanciesTimer = null;
    }
    if (this.preferencesTimer) {
      clearTimeout(this.preferencesTimer);
      this.preferencesTimer = null;
    }
    this.pendingQueue = null;
    this.pendingDiscrepancies = null;
    this.pendingPreferences = null;
    this.queueResolvers.forEach((r) => r());
    this.queueResolvers = [];
    this.discrepanciesResolvers.forEach((r) => r());
    this.discrepanciesResolvers = [];
    this.preferencesResolvers.forEach((r) => r());
    this.preferencesResolvers = [];
  }
}

let instance: CitrixStorageAdapter | null = null;

export function getCitrixStorageAdapter(): CitrixStorageAdapter {
  if (!instance) {
    instance = new MemoryCitrixStorageAdapter();
  }
  return instance;
}

export function _resetCitrixStorageAdapterForTesting(): void {
  if (instance && 'clearPendingTimers' in instance && typeof instance.clearPendingTimers === 'function') {
    instance.clearPendingTimers();
  }
  instance = null;
}
