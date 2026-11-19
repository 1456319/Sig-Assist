import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const drug = 'INSULIN LISPRO 100 UNIT/ML INJECTION';
const bands = '150-199 2 units, 200-249 4 units';
const translate = (rawProse: string) => translateClinicalSig({ id: 'synthetic-scale-alias', pon: 'SYNTHETIC-SCALE', drugName: drug, rawProse, sourceFormat: 'manual_text' });

describe('meal and bedtime scale schedule aliases', () => {
  it.each([
    `Inject per sliding scale SQ AC/HS: ${bands}.`,
    `Inject per sliding scale SQ AC / HS: ${bands}.`,
    `Inject per sliding scale: ${bands}, SQ AC/HS.`,
  ])('retains both meals and bedtime in both entry points: %s', raw => {
    const expected = 'CBS ACHS SS 150-199=2U;200-249=4U';
    expect(translate(raw).primarySig).toBe(expected);
    expect(translateFreeTextSig(raw, { drug }).sig).toBe(expected);
  });

  it('keeps the AC/HS common schedule separate from a bedtime half-dose qualifier', () => {
    const raw = `Inject per sliding scale SQ AC/HS: ${bands}. At bedtime give half the scale dose.`;
    const expected = 'CBS ACHS SS 150-199=2U;200-249=4U. AT BEDTIME GIVE HALF THE SCALE DOSE.';
    const clinical = translate(raw);
    const classic = translateFreeTextSig(raw, { drug });
    expect(clinical.primarySig).toBe(expected);
    expect(classic.sig).toBe(expected);
    expect(clinical.abnormalities.some(f => f.id === 'sliding_scale_unparsed_action')).toBe(true);
    expect(classic.order.issues.some(f => f.code === 'retained-sliding-scale-instructions')).toBe(true);
  });

  it('does not add bedtime to a meals-only scale', () => {
    const raw = `Inject per sliding scale SQ AC: ${bands}.`;
    expect(translate(raw).primarySig).toBe('CBS AC SS 150-199=2U;200-249=4U');
    expect(translateFreeTextSig(raw, { drug }).sig).toBe('CBS AC SS 150-199=2U;200-249=4U');
  });
});
