import { describe, it, expect } from 'vitest';
import { matchesOrderQuery } from '../src/lib/orderSearch';
import type { OrderSource } from '../src/lib/orderQueue';

describe('matchesOrderQuery', () => {
  const sampleOrder: OrderSource = {
    facility: 'Sunrise Nursing Home',
    patientRef: 'RES-1042',
    pon: 'PON-998822',
    drug: 'Lisinopril 10mg Tablet',
    directions: 'Take 1 tablet daily by mouth',
    defaultSig: '1T PO QD',
  };

  describe('empty or whitespace queries', () => {
    it('returns true when query is an empty string', () => {
      expect(matchesOrderQuery(sampleOrder, '')).toBe(true);
    });

    it('returns true when query consists only of whitespace', () => {
      expect(matchesOrderQuery(sampleOrder, '   ')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, '\t\n ')).toBe(true);
    });
  });

  describe('matching searchable fields', () => {
    it('matches PON exactly and partially', () => {
      expect(matchesOrderQuery(sampleOrder, 'PON-998822')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, '998822')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'pon-')).toBe(true);
    });

    it('matches facility exactly and partially', () => {
      expect(matchesOrderQuery(sampleOrder, 'Sunrise Nursing Home')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'nursing')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'SUNRISE')).toBe(true);
    });

    it('matches patient reference exactly and partially', () => {
      expect(matchesOrderQuery(sampleOrder, 'RES-1042')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'res-')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, '1042')).toBe(true);
    });

    it('matches drug name exactly and partially', () => {
      expect(matchesOrderQuery(sampleOrder, 'Lisinopril 10mg Tablet')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'lisinopril')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, '10MG')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'tablet')).toBe(true);
    });
  });

  describe('case insensitivity and whitespace trimming', () => {
    it('ignores leading and trailing whitespace in the query', () => {
      expect(matchesOrderQuery(sampleOrder, '  lisinopril  ')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, ' \t 998822 \n')).toBe(true);
    });

    it('performs case-insensitive comparison', () => {
      expect(matchesOrderQuery(sampleOrder, 'SuNrIsE')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'LiSiNoPrIl')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'rEs-1042')).toBe(true);
      expect(matchesOrderQuery(sampleOrder, 'PoN-998822')).toBe(true);
    });
  });

  describe('non-matching queries and excluded fields', () => {
    it('returns false when no searchable field contains the query', () => {
      expect(matchesOrderQuery(sampleOrder, 'Metformin')).toBe(false);
      expect(matchesOrderQuery(sampleOrder, 'Sunset')).toBe(false);
      expect(matchesOrderQuery(sampleOrder, '999999')).toBe(false);
    });

    it('does not match on non-searchable fields like directions or defaultSig', () => {
      // 'mouth' appears only in directions ('Take 1 tablet daily by mouth')
      expect(matchesOrderQuery(sampleOrder, 'mouth')).toBe(false);
      // 'QD' appears only in defaultSig ('1T PO QD')
      expect(matchesOrderQuery(sampleOrder, 'QD')).toBe(false);
    });
  });
});
