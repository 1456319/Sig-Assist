import { describe, expect, it } from 'vitest';
import { locateEdcInErxQueue, parseErxQueueCsv } from './erxQueueCsv';

const head = 'Descr1,CC1,EntryDt1,MsgType1,Priority1,FacID,Patient1,PrescriberOrderNumber,Physician1,DEAClass,Drug,Directions,Sendername,CC2';
const encode = (cells: string[]) => cells.map(value =>
  /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
).join(',');
function csv(
  rows: Array<{ folder: string; facility: string; pon: string; type?: string; dea?: string; drug?: string; patient?: string }>,
  total = rows.filter(row => row.type !== '').length,
) {
  return '\uFEFF' + head + '\r\n' + rows.map(row => encode([
    row.folder, '1', '11/14/2026 6:40:00 PM', row.type ?? 'NEWRX',
    'Medium', row.facility, row.patient ?? 'SYNTHETIC RESIDENT',
    row.pon, 'TEST PRESCRIBER', row.dea ?? '', row.drug ?? 'TEST MED',
    'synthetic instructions', '', String(total),
  ])).join('\r\n');
}

describe('SSRS eRx Queue Dashboard read-only CSV', () => {
  it('parses exact report schema, placeholder rows, and quoted newlines', () => {
    const text = csv([
      { folder: 'Process - 31A', facility: 'TESTA', pon: '000123:ABC', drug: 'TEST, MED\nEXTRA' },
      { folder: 'Refusals', facility: 'TESTB', pon: 'TEST-CONTROL-1', dea: 'C-II', patient: 'TEST, RESIDENT' },
      { folder: 'Empty folder', facility: '', pon: '', type: '' },
    ], 2);
    const report = parseErxQueueCsv(text, 42);
    expect(report.rows).toHaveLength(2);
    expect(report.placeholderRows).toBe(1);
    expect(report.structurallyComplete).toBe(true);
    expect(report.coverageVerified).toBe(false);
    expect(report.reportGeneratedAt).toBe(null);
    expect(report.importedAt).toBe(42);
    expect(report.rows[0].pon).toBe('000123:ABC');
    expect(report.rows[0].medication).toBe('TEST, MED\nEXTRA');
    expect(report.rows[1].patient).toBe('TEST, RESIDENT');
  });

  it('treats Refusals as a holding folder, not proof of refused status', () => {
    const report = parseErxQueueCsv(csv([{ folder: 'Refusals', facility: 'TESTA', pon: 'HOLD-1' }], 1));
    const result = locateEdcInErxQueue({ pon: 'HOLD-1', facility: 'TESTA' }, report);
    expect(result.kind).toBe('located');
    if (result.kind === 'located') expect(result.reviewHold).toBe(true);
  });

  it('requires exact facility, rejecting cross-facility PON collisions', () => {
    const report = parseErxQueueCsv(csv([
      { folder: 'Process - 31A', facility: 'TESTA', pon: 'REUSED-01' },
      { folder: 'Process - 55', facility: 'TESTB', pon: 'REUSED-01' },
    ], 2));
    expect(locateEdcInErxQueue({ pon: 'REUSED-01' }, report).kind).toBe('facility-unknown');
    expect(locateEdcInErxQueue({ pon: 'REUSED-01', facility: 'TESTC' }, report).kind).toBe('facility-conflict');
    expect(locateEdcInErxQueue({ pon: 'REUSED-01', facility: 'TESTB' }, report).kind).toBe('located');
  });

  it('preserves ambiguity for duplicate same-facility entries', () => {
    const report = parseErxQueueCsv(csv([
      { folder: 'Hold', facility: 'TESTA', pon: 'DUP-1' },
      { folder: 'Refusals', facility: 'TESTA', pon: 'DUP-1' },
    ], 2));
    expect(locateEdcInErxQueue({ pon: 'DUP-1', facility: 'TESTA' }, report).kind).toBe('ambiguous');
  });

  it('does not infer completion from an absent PON', () => {
    const report = parseErxQueueCsv(csv([{ folder: 'Process - 31A', facility: 'TESTA', pon: 'OTHER-1' }], 1));
    expect(locateEdcInErxQueue({ pon: 'MISSING-1', facility: 'TESTA' }, report))
      .toEqual({ kind: 'not-in-snapshot', candidates: [] });
  });

  it('marks DEA-scheduled matches as requiring pharmacist review', () => {
    const report = parseErxQueueCsv(csv([
      { folder: 'Refusals', facility: 'TESTA', pon: 'CTRL-1', dea: 'C-IV' },
    ], 1));
    const result = locateEdcInErxQueue({ pon: 'CTRL-1', facility: 'TESTA' }, report);
    expect(result.kind).toBe('located');
    if (result.kind === 'located') expect(result.pharmacistReviewRequired).toBe(true);
  });

  it('does not report incomplete exports as complete', () => {
    const report = parseErxQueueCsv(csv([{ folder: 'Process - 31A', facility: 'TESTA', pon: 'TEST-1' }], 9));
    expect(report.structurallyComplete).toBe(false);
    expect(report.warnings.some(warning => warning.includes('differs'))).toBe(true);
  });

  it('rejects malformed CSV, login HTML, wrong headers, and oversized data', () => {
    expect(() => parseErxQueueCsv('<html>login</html>')).toThrow(/Unexpected SSRS/);
    expect(() => parseErxQueueCsv(head + '\n"bad')).toThrow(/Unterminated/);
    expect(() => parseErxQueueCsv(head + '\nprocess,1')).toThrow(/wrong number/);
    expect(() => parseErxQueueCsv('X,' + head)).toThrow(/Unexpected SSRS/);
    expect(() => parseErxQueueCsv('x'.repeat(8_000_001))).toThrow(/8 MB/);
  });
});
