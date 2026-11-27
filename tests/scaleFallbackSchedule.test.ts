import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

it('does not label a TID scale as bedtime when retaining an unresolved later half-dose instruction', () => {
  const drugName = 'INSULIN LISPRO 100 UNIT/ML INJECTION';
  const rawProse = 'Sliding scale SQ TID:150-199=2 units;200+=4 units. For up to 3 days, at bedtime give half the scale dose.';
  const result = translateClinicalSig({ id: 'SYN-FALLBACK', pon: 'SYN-FALLBACK', drugName, rawProse, sourceFormat: 'manual_text' });
  for (const sig of [result.primarySig, translateFreeTextSig(rawProse, { drug: drugName }).sig]) {
    expect(sig).toMatch(/^(?:CBS|C\.B\.S\.) TID /);
    expect(sig).toContain('FOR UP TO 3 DAYS');
    expect(sig).toContain('AT BEDTIME');
    expect(sig).toContain('HALF');
  }
});
