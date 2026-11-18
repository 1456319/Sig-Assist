import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const drug = 'METFORMIN 500 MG TABLET';
const clinical = (rawProse: string) => translateClinicalSig({ id: 'synthetic-named-meals', pon: 'SYNTHETIC', drugName: drug, rawProse, sourceFormat: 'manual_text' });

describe('named meal timing from saved exclusion examples', () => {
  it.each([
    ['twice daily', 'BID', 'with breakfast and dinner'],
    ['every 12 hours', 'Q12H', 'with breakfast and dinner'],
    ['twice daily', 'BID', 'with breakfast & dinner'],
    ['twice daily', 'BID', 'with breakfast and with dinner'],
    ['three times a day', 'TID', 'with breakfast, lunch, and dinner'],
  ])('retains the explicit %s schedule and complete %s qualifier', (schedule, token, qualifier) => {
    const raw = `Take 1 tablet by mouth ${schedule} ${qualifier}.`;
    const expected = `1T PO ${token} ${qualifier.toUpperCase()}`;
    const result = clinical(raw);
    expect(result.primarySig).toBe(expected);
    expect(result.abnormalities.some(f => f.id === 'named_meal_schedule_retained')).toBe(true);
    expect(translateFreeTextSig(raw, { drug }).sig).toBe(expected);
  });

  it('does not invent BID when only the named meals were supplied', () => {
    const raw = 'Take 1 tablet by mouth with breakfast and dinner.';
    expect(resolveFrequencyAndSchedule(raw).frequencyToken).toBe('WITH BREAKFAST AND DINNER');
    expect(clinical(raw).primarySig).toBe('1T PO WITH BREAKFAST AND DINNER');
    const classic = translateFreeTextSig(raw, { drug });
    expect(classic.sig).toBe('1T PO WITH BREAKFAST AND DINNER');
    expect(classic.order.frequency).toBeUndefined();
  });

  it('does not change an explicit daily count to match the number of meals', () => {
    const raw = 'Take 1 tablet by mouth daily with breakfast and dinner.';
    expect(clinical(raw).primarySig).toBe('1T PO QD WITH BREAKFAST AND DINNER');
    expect(translateFreeTextSig(raw, { drug }).sig).toBe('1T PO QD WITH BREAKFAST AND DINNER');
  });

  it('preserves the existing single-breakfast and generic-meals codes', () => {
    expect(clinical('Take 1 tablet by mouth daily with breakfast.').primarySig).toBe('1T PO QDW/B');
    expect(clinical('Take 1 tablet by mouth twice daily with meals.').primarySig).toBe('1T PO WMBID');
  });

  it('does not promote a supplemental prohibition into positive meal timing', () => {
    const raw = 'Take 1 tablet by mouth twice daily. Do not take with breakfast and dinner.';
    expect(clinical(raw).primarySig).toBe('1T PO BID. DO NOT TAKE WITH BREAKFAST AND DINNER.');
    expect(translateFreeTextSig(raw, { drug }).sig).toBe('1T PO BID');
  });

  it('retains a later monitoring instruction separately from the named dosing meals', () => {
    const raw = 'Take 1 tablet by mouth twice daily with breakfast and dinner. At bedtime check blood sugar.';
    expect(clinical(raw).primarySig).toBe('1T PO BID WITH BREAKFAST AND DINNER. AT BEDTIME CHECK BLOOD SUGAR.');
  });
});
