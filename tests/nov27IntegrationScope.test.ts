import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';
import { splitSupplementalDirections } from '../src/lib/clinical/instructionClauses';
const tablet = 'SYNTHETIC TABLET 25 MG';
const treatment = 'ZINC OXIDE 20% PASTE';
const insulin = 'INSULIN LISPRO 100 UNIT/ML INJECTION';
const clinical = (drugName: string, rawProse: string) => translateClinicalSig({
  id: 'SYN-INTEGRATION', pon: 'SYN-INTEGRATION', drugName, rawProse, sourceFormat: 'manual_text',
});

describe('Nov27 independent integration scope holdout', () => {
  const primary = 'Take 1 tablet by mouth daily for 7 days';
  const later = 'For up to 3 days, take 1 tablet by mouth at bedtime as needed for pain.';
  const scoped = `${primary}. ${later}`;
  it('keeps a later maximum-course prefix with its action at the shared boundary', () => {
    const clauses = splitSupplementalDirections(scoped, { classic: true });
    expect(clauses.primary).toBe(primary);
    expect(clauses.supplemental).toBe(later);
  });
  it('does not replace the classic seven-day course with a later three-day maximum', () => {
    const result = translateFreeTextSig(scoped, { drug: tablet });
    expect(result.order.durationDays).toBe(7);
    expect(result.order.maximumCourse).toBeUndefined();
    expect(result.sig).toBe(`1T PO QD X7D. ${later.toUpperCase().replace(/[.]$/, '')}`);
  });
  it('translates the first clinical dose without a false cross-action course conflict', () => {
    const result = clinical(tablet, scoped);
    expect(result.primarySig).toBe(`1T PO QD X7D. ${later.toUpperCase()}`);
    expect(result.abnormalities.some(a => a.id === 'conflicting_durations')).toBe(false);
  });
  it.each(['present', 'lasting'])('does not turn redness %s for two days into a two-day treatment course', word => {
    const result = clinical(treatment, `Apply to sacrum every shift and as needed for redness ${word} for 2 days.`);
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders?.[0]?.suggestedSig).toBe('TO SACRUM:APPLY ZINC OXIDE QS');
    expect(result.subOrders?.[1]?.suggestedSig).toBe(`TO SACRUM:APPLY ZINC OXIDE PRN FOR REDNESS ${word.toUpperCase()} FOR 2 DAYS`);
    expect(result.abnormalities.some(a => a.id === 'treatment_condition_duration_retained')).toBe(true);
  });
  it.each([7, 5])('does not hide a fixed %s-day course behind a seven-day upper bound in classic output', fixed => {
    const raw = `Take 1 tablet by mouth daily for up to 7 days and for ${fixed} days.`;
    const result = translateFreeTextSig(raw, { drug: tablet });
    expect(result.sig).toContain('FOR UP TO 7 DAYS AND FOR');
    expect(result.sig).toContain(`FOR ${fixed} DAYS`);
    expect(result.order.issues.some(issue => issue.code === 'conflicting-durations')).toBe(true);
  });
  it('keeps an ordinary shared fourteen-day treatment course on both cards', () => {
    const result = clinical(treatment, 'Apply to sacrum every shift and as needed for incontinence for 14 days.');
    expect(result.subOrders?.[0]?.suggestedSig).toBe('TO SACRUM:APPLY ZINC OXIDE QS X14D');
    expect(result.subOrders?.[1]?.suggestedSig).toBe('TO SACRUM:APPLY ZINC OXIDE PRN X14D FOR INCONTINENCE');
  });
  it('keeps a routine maximum course separate from a two-day follow-up condition', () => {
    const result = clinical(treatment, 'Apply to sacrum every shift and as needed for redness for up to 7 days. Notify provider if redness persists for 2 days.');
    for (const part of result.subOrders ?? []) {
      expect(part.suggestedSig).toContain('FOR UP TO 7 DAYS');
      expect(part.suggestedSig).toContain('NOTIFY PROVIDER IF REDNESS PERSISTS FOR 2 DAYS');
      expect(part.suggestedSig).not.toContain('X2D');
    }
    expect(result.subOrders).toHaveLength(2);
  });
  it('retains the ordered bounded and fixed treatment phases', () => {
    const result = clinical(treatment, 'Cleanse sacrum with saline, apply zinc oxide twice daily for up to 7 days, then daily for 3 days.');
    expect(result.primarySig).toContain('TWICE DAILY FOR UP TO 7 DAYS, THEN DAILY FOR 3 DAYS');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
  });
  it.each([
    ['for up to 7 days', 'for 3 days', 'FOR UP TO 7 DAYS', 'FOR 3 DAYS'],
    ['for 7 days', 'for up to 3 days', 'X7D', 'FOR UP TO 3 DAYS'],
  ])('keeps scale course %s separate from fixed-dose course %s in both paths', (shared, fixed, sharedExpected, fixedExpected) => {
    const raw = `Sliding scale SQ TID ${shared}: if 150-199 then give 2 units; if 200+ then give 4 units. AND give 3 units at bedtime ${fixed}.`;
    const expected = `CBS TID SS 150-199=2U;200+=4U ${sharedExpected}.PLUS3U QHS ${fixedExpected}`;
    expect(clinical(insulin, raw).primarySig).toBe(expected);
    expect(translateFreeTextSig(raw, { drug: insulin }).sig).toBe(expected);
  });
  it('does not alter the exact or maximum single-course controls in classic output', () => {
    expect(translateFreeTextSig('Take 1 tablet by mouth daily for 7 days.', { drug: tablet }).sig).toBe('1T PO QD X7D');
    expect(translateFreeTextSig('Take 1 tablet by mouth daily for up to 7 days.', { drug: tablet }).sig).toBe('1T PO QD FOR UP TO 7 DAYS');
  });
});
