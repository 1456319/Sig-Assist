import { describe, expect, it } from 'vitest';
import { resolveDuration } from '../src/lib/clinical/durationEngine';

describe('durationEngine', () => {
  describe('Happy paths', () => {
    it('resolves valid day durations', () => {
      expect(resolveDuration('FOR 7 DAYS').token).toBe('X7D');
      expect(resolveDuration('X 14 D').token).toBe('X14D');
      expect(resolveDuration('FOR 1 DAY').token).toBe('X1D');
      expect(resolveDuration('FOR UP TO 10 DAYS').token).toBe('X10D');
    });

    it('resolves valid week durations', () => {
      expect(resolveDuration('FOR 2 WEEKS').token).toBe('X2WK');
      expect(resolveDuration('X 4 WKS').token).toBe('X4WK');
      expect(resolveDuration('FOR 1 WK').token).toBe('X1WK');
    });

    it('resolves valid month durations', () => {
      expect(resolveDuration('FOR 3 MONTHS').token).toBe('X3M');
      expect(resolveDuration('X 6 MO').token).toBe('X6M');
    });

    it('resolves valid hour durations', () => {
      expect(resolveDuration('FOR 48 HOURS').token).toBe('X48H');
      expect(resolveDuration('X 72 HRS').token).toBe('X72H');
    });

    it('returns empty abnormalities and no token when no duration is specified', () => {
      const result = resolveDuration('TAKE 1 TABLET BY MOUTH DAILY');
      expect(result.token).toBeUndefined();
      expect(result.abnormalities).toEqual([]);
      expect(result.unsupported).toBeUndefined();
    });
  });

  describe('Edge cases and error conditions', () => {
    it('flags unmarked durations missing FOR or X modifiers', () => {
      const result = resolveDuration('TAKE 1 TABLET BY MOUTH DAILY 7 DAYS');
      expect(result.token).toBeUndefined();
      expect(result.unsupported).toBe(true);
      expect(result.abnormalities).toHaveLength(1);
      expect(result.abnormalities[0].id).toBe('unmarked_duration');
      expect(result.abnormalities[0].trigger).toBe('7 DAYS');
    });

    it('flags unsupported durations that are not in SIG_CODE_REFERENCE', () => {
      // E.g., 'X99D' is likely not in reference
      const result = resolveDuration('FOR 99 DAYS');
      expect(result.token).toBeUndefined();
      expect(result.unsupported).toBe(true);
      expect(result.abnormalities).toHaveLength(1);
      expect(result.abnormalities[0].id).toBe('unsupported_duration');
      expect(result.abnormalities[0].trigger).toBe('FOR 99 DAYS');
    });

    it('flags non-integer day supplies', () => {
      const result = resolveDuration('FOR 1.5 DAYS');
      expect(result.token).toBeUndefined();
      expect(result.unsupported).toBe(true);
      expect(result.abnormalities).toHaveLength(1);
      expect(result.abnormalities[0].id).toBe('unsupported_duration');
      expect(result.abnormalities[0].title).toBe('Non-integer Day Supply');
      expect(result.abnormalities[0].trigger).toBe('FOR 1.5 DAYS');
    });

    it('flags negative or zero amounts', () => {
      const result = resolveDuration('FOR 0 DAYS');
      expect(result.token).toBeUndefined();
      expect(result.unsupported).toBe(true);
      expect(result.abnormalities).toHaveLength(1);
      expect(result.abnormalities[0].id).toBe('unsupported_duration');
    });

    it('flags conflicting durations', () => {
      const result = resolveDuration('FOR 7 DAYS AND FOR 14 DAYS');
      expect(result.token).toBeUndefined();
      expect(result.unsupported).toBe(true);
      expect(result.abnormalities).toHaveLength(1);
      expect(result.abnormalities[0].id).toBe('conflicting_durations');
    });
  });
});
