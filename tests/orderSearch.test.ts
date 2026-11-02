import { describe, expect, it } from 'vitest';
import { matchesOrderQuery } from '../src/lib/orderSearch';
import type { OrderSource } from '../src/lib/orderQueue';

describe('matchesOrderQuery', () => {
  const sampleOrder: OrderSource = {
    facility: 'Oak Ridge Senior Living',
    patientRef: 'RES-98214-DOE',
    pon: 'PON-2026-1004',
    drug: 'Metoprolol Tartrate 25mg Tab',
    directions: 'Give 1 tablet by mouth daily in the morning',
    defaultSig: '1T PO QD QAM',
  };

  it('matches all orders when query is empty or only whitespace', () => {
    expect(matchesOrderQuery(sampleOrder, '')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, ' ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '   \t\n  ')).toBe(true);
  });

  it('matches query against facility name', () => {
    expect(matchesOrderQuery(sampleOrder, 'Oak Ridge')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'oak ridge senior living')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'OAK')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'living')).toBe(true);
  });

  it('matches query against patient reference', () => {
    expect(matchesOrderQuery(sampleOrder, 'RES-98214-DOE')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'res-98214')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'doe')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '98214')).toBe(true);
  });

  it('matches query against PON (purchase / prescription order number)', () => {
    expect(matchesOrderQuery(sampleOrder, 'PON-2026-1004')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'pon-2026')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '1004')).toBe(true);
  });

  it('matches query against drug name', () => {
    expect(matchesOrderQuery(sampleOrder, 'Metoprolol')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'metoprolol tartrate')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '25mg')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'tab')).toBe(true);
  });

  it('handles case-insensitivity across both query and order content', () => {
    expect(matchesOrderQuery(sampleOrder, 'OAK RIDGE')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'oak ridge')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'MeToPrOlOl')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Pon-2026-1004')).toBe(true);
  });

  it('trims leading and trailing whitespace from the query before matching', () => {
    expect(matchesOrderQuery(sampleOrder, '  Oak Ridge  ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '\tMetoprolol\n')).toBe(true);
  });

  it('returns false when query does not match any searchable field', () => {
    expect(matchesOrderQuery(sampleOrder, 'Lisinopril')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'Sunnybrook')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'PON-9999')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'RES-00000')).toBe(false);
  });

  it('does not match text that is only in non-searchable fields like directions or defaultSig', () => {
    // 'tablet' or 'morning' is in directions but not in drug/pon/patientRef/facility
    expect(matchesOrderQuery(sampleOrder, 'morning')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'mouth')).toBe(false);
    // 'QAM' is only in defaultSig
    expect(matchesOrderQuery(sampleOrder, 'QAM')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'QD')).toBe(false);
  });
});
