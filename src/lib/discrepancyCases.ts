import { getCitrixStorageAdapter } from './citrixStorage';

export const DISCREPANCY_SAVED_EVENT = 'sig-assist-discrepancy-saved';

export async function exportDiscrepancyCases() {
  const reports = await getCitrixStorageAdapter().readDiscrepancies();
  if (!reports.length) throw new Error('No discrepancy reports have been saved yet.');
  return {
    format: 'sig-assist-discrepancy-cases',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    // Exact source text is needed for replay; this is not an anonymized export.
    redacted: false,
    caseCount: reports.length,
    reports,
  };
}
