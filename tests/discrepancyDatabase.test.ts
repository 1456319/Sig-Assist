import 'fake-indexeddb/auto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { browserRecords } from '../src/lib/browserDatabase';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';
import type { DiscrepancyReport } from '../src/lib/clinical/types';
const records = browserRecords('sig-assist-discrepancies-v1');
const report = (id: string): DiscrepancyReport => ({ id, timestamp: '2026-11-16T10:00:00Z', pon: 'SYNTHETIC', drugName: 'Test', rawProse: 'Original', generatedSig: 'DRAFT', technicianSig: 'CORRECTED', notes: 'Preserve', flaggedForRph: false });
beforeEach(async () => {
  _resetCitrixStorageAdapterForTesting(); localStorage.clear();
  for (const [key] of await records.entries()) await records.remove(key);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); _resetCitrixStorageAdapterForTesting(); });
it('saves with localStorage full, reloads, and merges legacy reports without duplicates', async () => {
  localStorage.setItem('citrix_storage_discrepancies', JSON.stringify([report('old')]));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  await getCitrixStorageAdapter().appendDiscrepancy(report('new'), { immediate: true });
  _resetCitrixStorageAdapterForTesting();
  expect((await getCitrixStorageAdapter().readDiscrepancies()).map(r => r.id)).toEqual(['old', 'new']);
  await getCitrixStorageAdapter().appendDiscrepancy(report('new'), { immediate: true });
  expect(await getCitrixStorageAdapter().readDiscrepancies()).toHaveLength(2);
});
it('archives and restores across a switch between the database fallback and localStorage', async () => {
  const adapter = getCitrixStorageAdapter();
  await adapter.appendDiscrepancy(report('case'), { immediate: true });
  const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  await adapter.setDiscrepanciesArchived(['case'], true);
  expect((await adapter.readDiscrepancies())[0].archivedAt).toBeTruthy();
  quota.mockRestore();
  await adapter.setDiscrepanciesArchived(['case'], false);
  _resetCitrixStorageAdapterForTesting();
  expect((await getCitrixStorageAdapter().readDiscrepancies())[0].archivedAt).toBeUndefined();
});
it('preserves an unreadable legacy archive while saving a new report to the database', async () => {
  localStorage.setItem('citrix_storage_discrepancies', '{broken');
  await getCitrixStorageAdapter().appendDiscrepancy(report('new'), { immediate: true });
  expect(localStorage.getItem('citrix_storage_discrepancies')).toBe('{broken');
  expect(await records.get('new')).toEqual(report('new'));
});
it('does not acknowledge a transaction that aborted or partially replace older records', async () => {
  await records.put('older', report('older'));
  await expect(records.merge([['new', report('new')], ['older', report('replacement')]], (_old, value) => {
    if ((value as DiscrepancyReport).id === 'replacement') throw new Error('abort');
    return value;
  })).rejects.toThrow('transaction failed');
  expect(await records.get('new')).toBeUndefined();
  expect(await records.get('older')).toEqual(report('older'));
});
it('still rejects a report when file, localStorage and database storage are all unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  await expect(getCitrixStorageAdapter().appendDiscrepancy(report('new'), { immediate: true })).rejects.toThrow('Download this report');
});
