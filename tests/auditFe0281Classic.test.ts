import { expect, it } from 'vitest';
import { translateFreeTextSig } from '../src/lib/sigEngine';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

it('keeps THEN between two duration-limited dose phases', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth daily for 5 days, then take 2 tablets by mouth at bedtime for 3 days.', { drug: 'Synthetic tablet' });
  expect(result.order.durationDays).toBe(5);
  expect(result.sig).toBe('1T PO QD X5D. THEN TAKE 2 TABLETS BY MOUTH AT BEDTIME FOR 3 DAYS');
});

it('keeps a later injection without assigning its bedtime schedule to the morning dose', () => {
  const result = translateFreeTextSig('Inject 2 units subcutaneously in the morning. Inject 1 unit subcutaneously at bedtime.', { drug: 'Synthetic insulin' });
  expect(result.order.frequency).toBe('QAM');
  expect(result.sig).toBe('INJ 2 UN SQ QAM. INJECT 1 UNIT SUBCUTANEOUSLY AT BEDTIME');
});

it('keeps an unencoded hold condition in the editable draft without changing the daily dose', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth daily. Hold if not eating.', { drug: 'Synthetic tablet' });
  expect(result.sig).toBe('1T PO QD. HOLD IF NOT EATING');
  expect(result.order.issues.map(issue => issue.code)).toContain('retained-supplemental-instructions');
});

it('still keeps a later PRN indication and duration with the later dose only', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth every morning. At bedtime give 2 tablets by mouth as needed for pain for 5 days.', { drug: 'Synthetic tablet' });
  expect(result.order).toMatchObject({ frequency: 'QAM', prn: false });
  expect(result.order.durationDays).toBeUndefined();
  expect(result.order.indication).toBeUndefined();
  expect(result.sig).toBe('1T PO QAM. AT BEDTIME GIVE 2 TABLETS BY MOUTH AS NEEDED FOR PAIN FOR 5 DAYS');
});

it('still encodes a recognized primary dual-threshold hold', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth twice daily; hold if systolic blood pressure below 90 or heart rate below 60.', { drug: 'Synthetic tablet' });
  expect(result.sig).toBe('1T PO BID HR60SBP90');
});

it('keeps a bedtime-only hold separate from the primary daily schedule', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth daily. At bedtime hold if not eating.', { drug: 'Synthetic tablet' });
  expect(result.sig).toBe('1T PO QD. AT BEDTIME HOLD IF NOT EATING');
});

it('does not apply a time-qualified dual-threshold hold to every administration', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth daily. At bedtime hold if systolic blood pressure below 90 or heart rate below 60.', { drug: 'Synthetic tablet' });
  expect(result.sig).toBe('1T PO QD. AT BEDTIME HOLD IF SYSTOLIC BLOOD PRESSURE BELOW 90 OR HEART RATE BELOW 60');
  expect(result.order.hold).toBeUndefined();
});

it('does not treat an excluded bedtime as the prescribed administration schedule', () => {
  const rawProse = 'Take 1 tablet by mouth daily and not at bedtime.';
  expect(translateFreeTextSig(rawProse, { drug: 'Synthetic tablet' }).sig).toBe('1T PO QD. NOT AT BEDTIME');
  expect(translateClinicalSig({ id: 'synthetic-negative-time', pon: 'SYNTHETIC', drugName: 'Synthetic tablet', rawProse, sourceFormat: 'manual_text' }).primarySig)
    .toBe('1T PO QD. NOT AT BEDTIME.');
});
