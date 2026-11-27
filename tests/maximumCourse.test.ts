import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { resolveDuration } from '../src/lib/clinical/durationEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const drugName = 'SYNTHETIC TABLET 25 MG';
it('does not turn an upper-bound course into a fixed course in the clinical draft', () => {
  const rawProse = 'Take 1 tablet by mouth every 6 hours as needed for pain for up to 5 days.';
  const result = translateClinicalSig({ id: 'SYN-MAX', pon: 'SYN-MAX', drugName, rawProse, sourceFormat: 'manual_text' });
  expect(result.primarySig).toContain('FOR UP TO 5 DAYS');
  expect(result.primarySig).not.toMatch(/\bX5D\b/);
  expect(rawProse).toContain('for up to 5 days');
});

it('keeps a maximum course in classic output without treating it as the indication', () => {
  const result = translateFreeTextSig('Take 1 tablet by mouth daily for pain for up to 5 days.', { drug: drugName });
  expect(result.sig).toContain('FOR UP TO 5 DAYS');
  expect(result.sig).toContain('FPAIN');
  expect(result.order.durationDays).toBeUndefined();
  expect(result.order.indication).toBe('FPAIN');
});

it('distinguishes bounded and fixed courses even when their numeric limits match', () => {
  expect(resolveDuration('FOR UP TO 7 DAYS AND FOR 7 DAYS').unsupported).toBe(true);
});

it('retains the ordinary exact-course code', () => {
  expect(resolveDuration('FOR 5 DAYS').token).toBe('X5D');
});
