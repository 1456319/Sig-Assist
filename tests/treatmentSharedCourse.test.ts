import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

const translate = (rawProse: string) => translateClinicalSig({ id: 'SYN-COURSE', pon: 'SYN-COURSE',
  drugName: 'ZINC OXIDE 20% PASTE', rawProse, sourceFormat: 'manual_text' });

it.each([
  ['for incontinence for 14 days', 'X14D', 'FOR INCONTINENCE'],
  ['for incontinence for 2 weeks', 'X2WK', 'FOR INCONTINENCE'],
  ['for 14 days', 'X14D', ''],
  ['for 2 skin tears for 14 days', 'X14D', 'FOR 2 SKIN TEARS'],
])('retains the action course on both routine and PRN cards: %s', (reason, course, retained) => {
  const result = translate(`Apply to sacrum every shift and as needed ${reason}.`);
  expect(result.subOrders).toHaveLength(2);
  expect(result.subOrders![0].suggestedSig).toContain(`QS ${course}`);
  expect(result.subOrders![1].suggestedSig).toContain(`PRN ${course}`);
  if (retained) expect(result.subOrders![1].suggestedSig).toContain(retained);
  expect(result.subOrders![0].suggestedSig).not.toContain('INCONTINENCE');
});

it('retains an up-to course qualification on both treatment cards', () => {
  const result = translate('Apply to sacrum every shift and as needed for redness for up to 14 days.');
  for (const part of result.subOrders!) expect(part.suggestedSig).toContain('FOR UP TO 14 DAYS');
  expect(result.subOrders![1].suggestedSig).toContain('FOR REDNESS');
});

it('does not invent a treatment course when the PRN reason contains a number', () => {
  const result = translate('Apply to sacrum every shift and as needed for 2 skin tears.');
  expect(result.subOrders![0].suggestedSig).toBe('TO SACRUM:APPLY ZINC OXIDE QS');
  expect(result.subOrders![1].suggestedSig).toContain('PRN FOR 2 SKIN TEARS');
});
