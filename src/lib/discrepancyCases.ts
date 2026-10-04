import { getCitrixStorageAdapter } from './citrixStorage';

export const DISCREPANCY_SAVED_EVENT = 'sig-assist-discrepancy-saved';

export async function exportDiscrepancyCases(scope: 'active' | 'archived' | 'all' = 'active') {
  const saved = await getCitrixStorageAdapter().readDiscrepancies();
  const reports = saved.filter(report => scope === 'all' || (scope === 'archived' ? !!report.archivedAt : !report.archivedAt));
  if (!reports.length) throw new Error('No discrepancy reports in the selected list.');
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
