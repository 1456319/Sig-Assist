import { DiscrepancyReport, TechnicianPreferences } from './clinical/types';

export interface StoredQueueOrder {
  id: string;
  pon: string;
  drugName: string;
  rawProse: string;
  suggestedSig: string;
  draftSig: string;
  isReviewed: boolean;
  status: 'pending' | 'completed' | 'skipped';
}

export interface CitrixStorageAdapter {
  isConnected(): boolean;
  getStorageMode(): 'file_system' | 'browser_cache';
  connectDirectory(): Promise<boolean>;
  readQueue(): Promise<StoredQueueOrder[]>;
  writeQueue(orders: StoredQueueOrder[]): Promise<void>;
  readDiscrepancies(): Promise<DiscrepancyReport[]>;
  appendDiscrepancy(report: DiscrepancyReport): Promise<void>;
  readPreferences(): Promise<TechnicianPreferences>;
  writePreferences(prefs: TechnicianPreferences): Promise<void>;
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
  private dirHandle: any = null;

  isConnected(): boolean {
    return this.dirHandle !== null;
  }

  getStorageMode(): 'file_system' | 'browser_cache' {
    return this.dirHandle ? 'file_system' : 'browser_cache';
  }

  async connectDirectory(): Promise<boolean> {
    const win =
      typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? (globalThis as any)
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

  async readQueue(): Promise<StoredQueueOrder[]> {
    if (this.dirHandle) {
      const data = await this.readFile<StoredQueueOrder[]>('queue.json');
      if (data !== null) {
        return data;
      }
    }
    return this.readLocalStorage<StoredQueueOrder[]>('citrix_storage_queue', []);
  }

  async writeQueue(orders: StoredQueueOrder[]): Promise<void> {
    if (this.dirHandle) {
      const written = await this.writeFile('queue.json', orders);
      if (written) return;
    }
    this.writeLocalStorage('citrix_storage_queue', orders);
  }

  async readDiscrepancies(): Promise<DiscrepancyReport[]> {
    if (this.dirHandle) {
      const data = await this.readFile<DiscrepancyReport[]>('discrepancies.json');
      if (data !== null) {
        return data;
      }
    }
    return this.readLocalStorage<DiscrepancyReport[]>('citrix_storage_discrepancies', []);
  }

  async appendDiscrepancy(report: DiscrepancyReport): Promise<void> {
    const existing = await this.readDiscrepancies();
    existing.push(report);
    if (this.dirHandle) {
      const written = await this.writeFile('discrepancies.json', existing);
      if (written) return;
    }
    this.writeLocalStorage('citrix_storage_discrepancies', existing);
  }

  async readPreferences(): Promise<TechnicianPreferences> {
    if (this.dirHandle) {
      const data = await this.readFile<TechnicianPreferences>('preferences.json');
      if (data !== null) {
        return data;
      }
    }
    return this.readLocalStorage<TechnicianPreferences>(
      'citrix_storage_preferences',
      DEFAULT_PREFERENCES
    );
  }

  async writePreferences(prefs: TechnicianPreferences): Promise<void> {
    if (this.dirHandle) {
      const written = await this.writeFile('preferences.json', prefs);
      if (written) return;
    }
    this.writeLocalStorage('citrix_storage_preferences', prefs);
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
  instance = null;
}
