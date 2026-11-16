import { browserRecords } from './browserDatabase';
import type { DiscrepancyReport } from './clinical/types';
const records = browserRecords('sig-assist-discrepancies-v1');
function stamp(report: DiscrepancyReport) { return Math.max(...[report.timestamp, report.archivedAt, report.storageUpdatedAt].map(x => Date.parse(x || '') || 0)); }
function valid(value: unknown): value is DiscrepancyReport { return !!value && typeof value === 'object' && typeof (value as DiscrepancyReport).id === 'string' && typeof (value as DiscrepancyReport).timestamp === 'string'; }
export function mergeDiscrepancyReports(...groups: DiscrepancyReport[][]): DiscrepancyReport[] {
  const merged = new Map<string, DiscrepancyReport>();
  for (const report of groups.flat()) {
    if (!valid(report)) throw new Error('A saved discrepancy archive could not be read. Existing data was preserved.');
    const before = merged.get(report.id);
    if (!before || stamp(report) >= stamp(before)) merged.set(report.id, report);
  }
  return [...merged.values()];
}
export async function readDatabaseDiscrepancies(): Promise<DiscrepancyReport[]> {
  if (typeof indexedDB === 'undefined') return [];
  const values = (await records.entries()).map(([, value]) => value);
  if (!values.every(valid)) throw new Error('The local discrepancy backup needs recovery. Existing reports were preserved.');
  return values;
}
export async function writeDatabaseDiscrepancies(reports: DiscrepancyReport[]): Promise<void> {
  await records.merge(reports.map(report => [report.id, report]), (existing, incoming) => {
    if (!valid(incoming) || existing !== undefined && !valid(existing)) throw new Error('Invalid discrepancy backup.');
    return existing === undefined || stamp(incoming) >= stamp(existing as DiscrepancyReport) ? incoming : existing;
  });
}
