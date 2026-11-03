import { describe, expect, it } from 'vitest';
import { finalSig, excludedMatches, reviewStamp, copyBlockReason, SigExclusion } from '../src/lib/reviewPolicy';

describe('reviewPolicy', () => {
  describe('finalSig', () => {
    it('trims and converts to uppercase', () => {
      expect(finalSig('  test sig  ')).toBe('TEST SIG');
      expect(finalSig('1t po qd')).toBe('1T PO QD');
      expect(finalSig('')).toBe('');
    });
  });

  describe('excludedMatches', () => {
    const exclusions: SigExclusion[] = [
      { kind: 'code', value: 'QD' },
      { kind: 'code', value: '1T' },
      { kind: 'sig', value: '1T PO QD' }
    ];

    it('returns empty array if no exclusions match', () => {
      expect(excludedMatches('2T PO BID', exclusions)).toEqual([]);
    });

    it('matches exact sig when kind is sig', () => {
      expect(excludedMatches('1t po qd', exclusions)).toEqual([
        { kind: 'code', value: 'QD' },
        { kind: 'code', value: '1T' },
        { kind: 'sig', value: '1T PO QD' }
      ]);
      expect(excludedMatches('1t po qd and some more', exclusions)).toEqual([
        { kind: 'code', value: 'QD' },
        { kind: 'code', value: '1T' }
      ]);
    });

    it('matches code with word boundaries', () => {
      expect(excludedMatches('2T PO QD', exclusions)).toEqual([{ kind: 'code', value: 'QD' }]);
      expect(excludedMatches('1T - 2T', exclusions)).toEqual([{ kind: 'code', value: '1T' }]);
      expect(excludedMatches('QDAY', exclusions)).toEqual([]);
      expect(excludedMatches('T1T', exclusions)).toEqual([]);
    });

    it('ignores empty exclusion values', () => {
       expect(excludedMatches('TEST', [{ kind: 'code', value: '  ' }])).toEqual([]);
    });
  });

  describe('reviewStamp', () => {
    it('generates a stringified representation', () => {
      const stamp = reviewStamp('src1', 'draft1', [], 1);
      const parsed = JSON.parse(stamp);
      expect(parsed[0]).toBe('src1');
      expect(parsed[1]).toBe('DRAFT1');
      expect(parsed[2]).toEqual([]);
      expect(parsed[3]).toBe(1);
      expect(parsed[4]).toBeDefined(); // __SIG_ASSIST_BUILD__
    });

    it('differs if inputs change', () => {
      const base = reviewStamp('src', 'draft', [], 0);
      expect(reviewStamp('src2', 'draft', [], 0)).not.toBe(base);
      expect(reviewStamp('src', 'draft2', [], 0)).not.toBe(base);
      expect(reviewStamp('src', 'draft', [{ kind: 'code', value: 'QD'}], 0)).not.toBe(base);
      expect(reviewStamp('src', 'draft', [], 1)).not.toBe(base);
    });
  });

  describe('copyBlockReason', () => {
    const exclusions: SigExclusion[] = [{ kind: 'code', value: 'EXCLUDED' }];

    it('blocks if unavailable is true', () => {
      expect(copyBlockReason('src', 'draft', [], 'approved', true)).toBe('This order is cancelled, its source is changing, or its message profile is unverified.');
    });

    it('blocks if draft is empty', () => {
      expect(copyBlockReason('src', '  ', [], 'approved', false)).toBe('Enter a final SIG before reviewing.');
    });

    it('blocks if draft contains rejected packaging codes', () => {
      expect(copyBlockReason('src', '1T PO INH', [], 'approved', false)).toMatch(/Remove rejected packaging code\(s\)/);
    });

    it('blocks if draft contains excluded matches', () => {
      expect(copyBlockReason('src', 'SOME EXCLUDED SIG', exclusions, 'approved', false)).toBe('The final SIG matches a session exclusion. Edit it or undo the exclusion.');
    });

    it('blocks if draft is not approved yet or stamp is different', () => {
      const stamp = reviewStamp('src', 'VALID SIG', [], 0);
      expect(copyBlockReason('src', 'VALID SIG', [], undefined)).toBe('Review the current order, directions, warnings and final SIG before copying.');
      expect(copyBlockReason('src', 'VALID SIG CHANGED', [], stamp)).toBe('Review the current order, directions, warnings and final SIG before copying.');
    });

    it('returns undefined if everything is valid and approved', () => {
      const draft = '1T PO BID';
      const stamp = reviewStamp('src', draft, [], 0);
      expect(copyBlockReason('src', draft, [], stamp, false, 0)).toBeUndefined();
    });
  });
});
