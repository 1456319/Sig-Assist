import { describe, expect, it } from 'vitest';
import { looksLikeSlidingScale, parseSlidingScale } from '../src/lib/clinical/slidingScale';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { parseSigOrder, renderSig } from '../src/lib/sigEngine';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';

const insulin = 'Insulin Lispro Injection 100 UNIT/ML';

describe('distinct insulin scale grammar shapes', () => {
  it.each([
    'Inject SQ before meals: blood sugar 150-199 give 1 unit; 200-249 give 2 units; 250 or greater give 3 units',
    'Inject SQ before meals: BG <70 hold insulin; BG >200 give 2 units',
    'Inject SQ before meals: BG 0-69 hold insulin; BG 200 or greater, give 2 units',
  ])('routes headingless numeric scales with insulin context: %s', raw => {
    expect(looksLikeSlidingScale(raw, insulin)).toBe(true);
    if (!/insulin/i.test(raw)) expect(looksLikeSlidingScale(raw, 'EXAMPLE TABLET')).toBe(false);
    const r = resolveFrequencyAndSchedule(raw, undefined, insulin);
    expect(r.requiresManualTranslation).not.toBe(true);
    expect(r.slidingScaleString).toMatch(/(?:150-199=1U;200-249=2U;250\+=3U|<70=HOLD;>200=2U|0-69=HOLD;200\+=2U)/);
    const clinical = translateClinicalSig({ id: 'scale', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName: insulin, rawProse: raw });
    expect(clinical.primarySig).toBe(r.slidingScaleString);
    expect(renderSig(parseSigOrder(raw, { drug: insulin }))).toBe(r.slidingScaleString);
  });

  it('detects a headingless table of bare doses for a named insulin product', () => {
    const raw = 'SQ before meals:150-199=1;200-249=2;250+=3';
    expect(looksLikeSlidingScale(raw, 'HUMALOG KWIKPEN 100 UNIT/ML')).toBe(true);
    expect(resolveFrequencyAndSchedule(raw, undefined, 'HUMALOG KWIKPEN 100 UNIT/ML').slidingScaleString)
      .toBe('CBS AC SS 150-199=1U;200-249=2U;250+=3U');
  });

  it('does not treat a fixed insulin dose and a single hold threshold as a scale', () => {
    expect(looksLikeSlidingScale('Inject 5 units SQ daily. Hold if BG <70', insulin)).toBe(false);
  });

  it('accepts glucose mg/dL labels without accepting mass as an insulin dose', () => {
    const r = parseSlidingScale('Sliding scale SQ TID: 151-200 mg/dL 2 units; 201-250 mg/dL 4 units; 251 or greater 6 units');
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('151-200=2U;201-250=4U;251+=6U');
    expect(parseSlidingScale('Sliding scale SQ TID: 151-200=2 units;201+=4 mg').incomplete).toBe(true);
    expect(parseSlidingScale('Sliding scale SQ TID: 151-200=2 units;201+=4 mg/dL').incomplete).toBe(true);
  });

  it('keeps opposite shared notification thresholds distinct', () => {
    const r = parseSlidingScale('Sliding scale: 0-200=0 units;201-400=2 units; Notify MD if BS greater than 400 or less than 60, SQ before meals');
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('<60=CALL MD;0-200=0U;201-400=2U;>400=CALL MD');
    expect(r.bands).not.toContain('<=400');
  });
  it.each(['70 or less', '70 and below', '70 and lower'])('preserves the inclusive postfix low threshold %s', threshold => {
    const r = parseSlidingScale(`Sliding scale SQ before meals: ${threshold} hold insulin;71-200=0 units;201+=2 units`);
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('<=70=HOLD;71-200=0U;201+=2U');
  });

  it('keeps a recheck attached to its glucose band', () => {
    const r = resolveFrequencyAndSchedule('Sliding scale before meals and at bedtime:251-300 give 4 units;301-350 give 6 units;>350 give 8 units and recheck BS in 2 hours', undefined, insulin);
    expect(r.slidingScaleString).toBe('CBS ACHS SS 251-300=4U;301-350=6U;>350=8U&RECHECK 2H');
  });

  it('preserves a separately scheduled basal dose beside its correction scale', () => {
    const r = resolveFrequencyAndSchedule('Inject 10 units subcutaneously at bedtime. Plus sliding scale before meals:201-250=2 units;251-300=4 units', undefined, insulin);
    expect(r.slidingScaleString).toBe('CBS AC SS 201-250=2U;251-300=4U.PLUS10U QHS');
    expect(r.abnormalities.some(a => a.id === 'sliding_scale_unparsed_action')).toBe(true);
  });

  it.each([
    'Notify on-call care team if BS >400 or BS <60',
    'BS >400 or BS <60 notify on-call care team',
  ])('normalizes shared call recipients beside both thresholds: %s', notice => {
    const r = parseSlidingScale(`Sliding scale:0-200=0 units;201-400=2 units;${notice}, SQ before meals`);
    expect(r.incomplete).toBe(false);
    expect(r.bands).toBe('<60=CALL MD;0-200=0U;201-400=2U;>400=CALL MD');
    expect(r.abnormalities.some(a => a.id === 'site_scale_notification')).toBe(true);
  });

  it.each([
    'Sliding scale with meals:150-200=1 unit;201-250=2 units. At bedtime:201-250=1 unit;>250=2 units',
    'Sliding scale SQ TID:0-200=0 units;201+=an unspecified dose and call MD',
    'Sliding scale SQ TID:0-200=0 units;201+=twelve unclear units and notify provider',
    'Sliding scale SQ TID:0-200=0 units;201+=2 units;201+=4 units',
  ])('retains the full source rather than merging distinct or ambiguous dosing: %s', raw => {
    const r = resolveFrequencyAndSchedule(raw, undefined, insulin);
    expect(r.requiresManualTranslation).toBe(true);
    expect(r.slidingScaleString).toMatch(/^CBS (?:TID|\[FREQUENCY\]) SS /);
    expect(r.slidingScaleString).toContain(raw.toUpperCase().replace('NOTIFY PROVIDER', 'CALL MD'));
    expect(renderSig(parseSigOrder(raw, { drug: insulin }))).toBe(r.slidingScaleString);
  });

});
