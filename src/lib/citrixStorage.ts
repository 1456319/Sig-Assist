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

const DEFAULT_PREFERENCES: TechnicianPreferences = {
  version: 1,
  drugCodeOverrides: {
    WARFARIN: 'COU',
    COUMADIN: 'COU'
  },
  defaultAdminTimes: {
    COU: '1800'
  }
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
    if (typeof window === 'undefined' || !(window as any).showDirectoryPicker) {
      return false;
    }
    try {
      this.dirHandle = await (window as any).showDirectoryPicker();
      return true;
    } catch {
      return false;
    }
  }

  async readQueue(): Promise<StoredQueueOrder[]> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_queue');
      if (data) {
        try { return JSON.parse(data); } catch { return []; }
      }
    }
    return [];
  }

  async writeQueue(orders: StoredQueueOrder[]): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_queue', JSON.stringify(orders));
    }
  }

  async readDiscrepancies(): Promise<DiscrepancyReport[]> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_discrepancies');
      if (data) {
        try { return JSON.parse(data); } catch { return []; }
      }
    }
    return [];
  }

  async appendDiscrepancy(report: DiscrepancyReport): Promise<void> {
    const existing = await this.readDiscrepancies();
    existing.push(report);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_discrepancies', JSON.stringify(existing));
    }
  }

  async readPreferences(): Promise<TechnicianPreferences> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_preferences');
      if (data) {
        try { return JSON.parse(data); } catch { return DEFAULT_PREFERENCES; }
      }
    }
    return DEFAULT_PREFERENCES;
  }

  async writePreferences(prefs: TechnicianPreferences): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_preferences', JSON.stringify(prefs));
    }
  }
}

let instance: CitrixStorageAdapter | null = null;

export function getCitrixStorageAdapter(): CitrixStorageAdapter {
  if (!instance) {
    instance = new MemoryCitrixStorageAdapter();
  }
  return instance;
}
