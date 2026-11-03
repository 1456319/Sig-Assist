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
    defaultSig: '1T PO QAM',
  };

  it('matches empty query or whitespace-only query for any order', () => {
    expect(matchesOrderQuery(sampleOrder, '')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '   ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '\t\n ')).toBe(true);
  });

  it('matches exact field values regardless of casing', () => {
    expect(matchesOrderQuery(sampleOrder, 'PON-2026-1004')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'pon-2026-1004')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'OAK RIDGE SENIOR LIVING')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'res-98214-doe')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'metoprolol tartrate 25mg tab')).toBe(true);
  });

  it('matches partial substrings across searchable fields', () => {
    expect(matchesOrderQuery(sampleOrder, '2026-1004')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Oak Ridge')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Senior')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '98214')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'DOE')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Metoprolol')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '25mg')).toBe(true);
  });

  it('trims leading and trailing spaces in the search query', () => {
    expect(matchesOrderQuery(sampleOrder, '  2026-1004  ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  Oak Ridge  ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '  DOE ')).toBe(true);
  });

  it('does not match values absent from the order', () => {
    expect(matchesOrderQuery(sampleOrder, 'Lisinopril')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'Sunrise Manor')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'RES-00000')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'PON-9999')).toBe(false);
  });

  it('does not search unsearched fields like directions or defaultSig', () => {
    // Searches are intentionally scoped to facility, patientRef, pon, drug
    expect(matchesOrderQuery(sampleOrder, 'tablet by mouth')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, '1T PO QAM')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'morning')).toBe(false);
  });
});
