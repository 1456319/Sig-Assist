import { describe, expect, it } from 'vitest';
import { looksLikeSlidingScale, parseSlidingScale } from '../src/lib/clinical/slidingScale';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';

const insulin = 'Insulin Lispro Injection 100 UNIT/ML';

describe('distinct insulin scale grammar shapes', () => {
  it.each([
    'Inject SQ before meals: blood sugar 150-199 give 1 unit; 200-249 give 2 units; 250 or greater give 3 units',
    'Inject SQ before meals: BG <70 hold insulin; BG >200 give 2 units',
  ])('routes headingless numeric scales with insulin context: %s', raw => {
    expect(looksLikeSlidingScale(raw, insulin)).toBe(true);
    if (!/insulin/i.test(raw)) expect(looksLikeSlidingScale(raw, 'EXAMPLE TABLET')).toBe(false);
    const r = resolveFrequencyAndSchedule(raw, undefined, insulin);
    expect(r.requiresManualTranslation).not.toBe(true);
    expect(r.slidingScaleString).toMatch(/(?:150-199=1U;200-249=2U;250\+=3U|<70=HOLD;>200=2U)/);
  });

  it('does not treat a fixed insulin dose and a single hold threshold as a scale', () => {
    expect(looksLikeSlidingScale('Inject 5 units SQ daily. Hold if BG <70', insulin)).toBe(false);
  });

  it('accepts glucose mg/dL labels without accepting mass as an insulin dose', () => {
    const r = parseSlidingScale('Sliding scale SQ TID: 151-200 mg/dL 2 units; 201-250 mg/dL 4 units; 251 or greater 6 units');
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('151-200=2U;201-250=4U;251+=6U');
    expect(parseSlidingScale('Sliding scale SQ TID: 151-200=2 units;201+=4 mg').incomplete).toBe(true);
  });

  it('keeps opposite shared notification thresholds distinct', () => {
    const r = parseSlidingScale('Sliding scale: 0-200=0 units;201-400=2 units; Notify MD if BS greater than 400 or less than 60, SQ before meals');
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('<60=CALL MD;0-200=0U;201-400=2U;>400=CALL MD');
    expect(r.bands).not.toContain('<=400');
  });
});
