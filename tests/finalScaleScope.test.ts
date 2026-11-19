import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const drug = 'INSULIN LISPRO 100 UNIT/ML INJECTION';
const run = (rawProse: string) => translateClinicalSig({ id: 'synthetic-scale', pon: 'SYNTHETIC-SCALE', drugName: drug, rawProse, sourceFormat: 'manual_text' });
const header = 'Inject per sliding scale subcutaneously before meals and at bedtime: 150-199 2 units, 200-249 4 units.';

describe('qualified post-scale instructions', () => {
  it.each([
    'At bedtime give half the scale dose.',
    'At bedtime give half of the sliding scale dose.',
    'Before breakfast give half the scale dose.',
  ])('retains the complete qualifier beside the scale: %s', footer => {
    const r = run(`${header} ${footer}`);
    expect(r.primarySig).toBe(`CBS ACHS SS 150-199=2U;200-249=4U. ${footer.toUpperCase()}`);
    expect(r.abnormalities.some(a => a.id === 'sliding_scale_unparsed_action' && a.trigger === footer.toUpperCase())).toBe(true);
    expect(r.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(false);
  });
  it('does not make a conditional bedtime modifier into the only common schedule', () => {
    const raw = 'Inject per sliding scale: 150-199 2 units, 200-249 4 units. At bedtime give half the scale dose.';
    const r = run(raw);
    expect(r.primarySig).toContain('AT BEDTIME GIVE HALF THE SCALE DOSE');
    expect(r.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(true);
    expect(r.primarySig).not.toMatch(/^CBS QHS SS/);
  });
  it('retains the qualified modifier in the classic entry point and reports review', () => {
    const { sig, order } = translateFreeTextSig(`${header} At bedtime give half the scale dose.`, { drug });
    expect(sig).toBe('CBS ACHS SS 150-199=2U;200-249=4U. AT BEDTIME GIVE HALF THE SCALE DOSE.');
    expect(order.issues.some(i => i.code === 'retained-sliding-scale-instructions')).toBe(true);
  });
  it('keeps an ordinary common schedule unchanged', () => {
    expect(run('Inject per sliding scale: 150-199 2 units;200-249 4 units, SQ before meals for diabetes.').primarySig)
      .toBe('CBS AC SS 150-199=2U;200-249=4U FDM');
  });
});
