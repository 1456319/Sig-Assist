import { describe, expect, it } from 'vitest';
import { splitMixedTabletDose } from '../src/lib/clinical/paxitFractionalDose';

describe('splitMixedTabletDose', () => {
  describe('happy paths', () => {
    it('splits 1.5 tablets correctly', () => {
      const result = splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY');
      expect(result).toEqual({
        parts: ['TAKE 1 TABLETS BY MOUTH DAILY', 'TAKE 1/2 TABLETS BY MOUTH DAILY'],
        total: '121.5MG'
      });
    });

    it('splits 1.25 tablets correctly using fractions', () => {
      const result = splitMixedTabletDose('WARFARIN 2.5 MG TABLET', 'TAKE 1 1/4 TABLETS PO DAILY');
      expect(result).toEqual({
        parts: ['TAKE 1 TABLETS PO DAILY', 'TAKE 1/4 TABLETS PO DAILY'],
        total: '3.125MG'
      });
    });

    it('splits 1.75 tablets correctly using decimals', () => {
      const result = splitMixedTabletDose('WARFARIN 2.5 MG TABLET', 'TAKE 1.75 TABS ORALLY DAILY');
      expect(result).toEqual({
        parts: ['TAKE 1 TABS ORALLY DAILY', 'TAKE 3/4 TABS ORALLY DAILY'],
        total: '4.375MG'
      });
    });

    it('handles decimal drug strengths without leading zero', () => {
      const result = splitMixedTabletDose('LEVOTHYROXINE .125 MCG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY');
      expect(result).toEqual({
        parts: ['TAKE 1 TABLETS BY MOUTH DAILY', 'TAKE 1/2 TABLETS BY MOUTH DAILY'],
        total: '0.1875MCG'
      });
    });
  });

  describe('unsuitable drug names', () => {
    it('returns undefined for non-tablet forms', () => {
      expect(splitMixedTabletDose('ASPIRIN 81 MG CAPSULE', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined for extended/delayed release forms', () => {
      expect(splitMixedTabletDose('ASPIRIN ER 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN DR 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN EC 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN EXTENDED 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN DELAYED 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined for multi-ingredient drugs', () => {
      expect(splitMixedTabletDose('HYDROCODONE-ACETAMINOPHEN 5-325 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('HYDROCODONE/ACETAMINOPHEN 5-325 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });
  });

  describe('unsuitable dosage directions', () => {
    it('returns undefined for non-fractional amounts', () => {
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1 TABLET BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 2 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined for unsupported fractional amounts', () => {
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 2.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 0.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined for directions with multiple clauses or complex dosing', () => {
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY THEN TAKE 1 TABLET DAILY')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY AND 1 AT BEDTIME')).toBeUndefined();
      expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY MAY INCREASE TO 2')).toBeUndefined();
    });

    it('returns undefined for directions referencing extra tablets', () => {
        expect(splitMixedTabletDose('ASPIRIN 81 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY AND 1 TABLET PRN')).toBeUndefined();
    });
  });

  describe('unsuitable drug strengths', () => {
    it('returns undefined when no strength is in the drug name', () => {
      expect(splitMixedTabletDose('ASPIRIN TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined when multiple strengths are in the drug name', () => {
      expect(splitMixedTabletDose('CALCIUM 500 MG / VITAMIN D 400 IU TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });

    it('returns undefined when strength is <= 0', () => {
        expect(splitMixedTabletDose('ASPIRIN 0 MG TABLET', 'TAKE 1.5 TABLETS BY MOUTH DAILY')).toBeUndefined();
    });
  });
});
