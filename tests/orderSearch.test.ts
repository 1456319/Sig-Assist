import { describe, expect, it } from 'vitest';
import { matchesOrderQuery } from '../src/lib/orderSearch';
import type { OrderSource } from '../src/lib/orderQueue';

describe('matchesOrderQuery', () => {
  const sampleOrder: OrderSource = {
    facility: 'Sunrise Valley Care Home',
    patientRef: 'RESIDENT-9402',
    pon: 'PON-88371-X',
    drug: 'Metformin HCl 500mg ER Tablet',
    directions: 'Take 1 tablet by mouth daily with dinner',
    defaultSig: '1T PO QD DINNER',
  };

  it('matches all orders when query is empty or only whitespace', () => {
    expect(matchesOrderQuery(sampleOrder, '')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '   ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '\t\n')).toBe(true);
  });

  it('matches by PON (exact, substring, case-insensitive, trimmed)', () => {
    expect(matchesOrderQuery(sampleOrder, 'PON-88371-X')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '88371')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'pon-88371-x')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  88371-x  ')).toBe(true);
  });

  it('matches by facility (exact, substring, case-insensitive, trimmed)', () => {
    expect(matchesOrderQuery(sampleOrder, 'Sunrise Valley Care Home')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'sunrise')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'valley')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  CARE HOME  ')).toBe(true);
  });

  it('matches by patient reference (exact, substring, case-insensitive, trimmed)', () => {
    expect(matchesOrderQuery(sampleOrder, 'RESIDENT-9402')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'resident')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '9402')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  resident-9402  ')).toBe(true);
  });

  it('matches by drug name (exact, substring, case-insensitive, trimmed)', () => {
    expect(matchesOrderQuery(sampleOrder, 'Metformin HCl 500mg ER Tablet')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'metformin')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '500mg')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  ER TABLET  ')).toBe(true);
  });

  it('returns false when query does not match any searchable field', () => {
    expect(matchesOrderQuery(sampleOrder, 'Lisinopril')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'Sunset Pines')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, '99999')).toBe(false);
  });

  it('does not search in non-searchable fields like directions or defaultSig', () => {
    // 'dinner' is only in directions and defaultSig
    expect(matchesOrderQuery(sampleOrder, 'dinner')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'mouth')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, '1T PO QD')).toBe(false);
  });

  it('handles orders with empty strings in searchable fields without throwing', () => {
    const emptyFieldsOrder: OrderSource = {
      facility: '',
      patientRef: '',
      pon: '',
      drug: '',
      directions: 'take daily',
    };

    expect(matchesOrderQuery(emptyFieldsOrder, '')).toBe(true);
    expect(matchesOrderQuery(emptyFieldsOrder, 'test')).toBe(false);
  });

  it('matches special characters present in fields', () => {
    expect(matchesOrderQuery(sampleOrder, '-')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'PON-88371-X')).toBe(true);
  });
});
