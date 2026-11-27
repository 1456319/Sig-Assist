import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

it.each([
  'Inhale 3 puffs orally twice daily.',
  '3 puff inhale orally twice daily.',
  'Use 3 inhalations by mouth twice daily.',
])('keeps oral inhalation distinct from a swallowed oral route: %s', rawProse => {
  const result = translateClinicalSig({ id: 'SYN-ORAL-INHALATION', pon: 'SYN-ORAL-INHALATION', drugName: 'SYNTHETIC HFA INHALER', rawProse, sourceFormat: 'manual_text' });
  expect(result.primarySig).toContain('3P BY INHALATION BID');
  expect(result.primarySig).not.toMatch(/\b(?:PO|NEB|INH)\b/);
});

it('keeps a genuine oral tablet route unchanged', () => {
  expect(translateClinicalSig({ id: 'SYN-ORAL', pon: 'SYN-ORAL', drugName: 'SYNTHETIC TABLET 25 MG', rawProse: 'Take 3 tablets orally twice daily.', sourceFormat: 'manual_text' }).primarySig).toBe('3T (75MG) PO BID');
});
