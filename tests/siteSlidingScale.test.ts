import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';
import { parseSlidingScale } from '../src/lib/clinical/slidingScale';

const drug = 'Insulin Lispro Injection 100 UNIT/ML';
const run = (rawProse: string) => translateClinicalSig({ id: 'synthetic-site-scale', pon: 'SYNTHETIC', drugName: drug, rawProse, sourceFormat: 'manual_text' });
const rawExample = 'Check blood sugar and administer according to sliding scale: if 150 - 200 then give 4 units, if 201 - 250 give 6 units, 251-300 then give 7 units if 301 - 350 give 10 units. If 351-400 give 12 units. If reading is 450+, give 14 units and recheck in 2 hours. If readings are still high, callD/NP. If <70 being hypoglycemic protocol FDM2. AND give 3 units four times daily with meals and at bedtime (h if resident did not eat) FDM2';

describe('technician-specified insulin scale format', () => {
  it('translates the complete example with independently scoped fixed dose and follow-up', () => {
    const result = run(rawExample);
    expect(result.primarySig).toBe('C.B.S. WMHS S.S. <70=HYPOGLYCEMIC PROTOCOL;150-200=4U;201-250=6U;251-300=7U;301-350=10U;351-400=12U;450+=14U&RECHECK 2H&CALL MD IF STILL HIGH.PLUS3U(H IF NOT EATING)');
    expect(result.abnormalities.map(a => a.id)).toEqual(expect.arrayContaining(['sliding_scale_gap', 'sliding_scale_concessions', 'sliding_scale_budget_exceeded']));
    expect(result.primarySig).not.toContain('401-449=');
    expect(translateFreeTextSig(rawExample, { drug }).sig).toBe(result.primarySig);
  });
  it.each([
    rawExample.replace('callD/NP', 'call provider'),
    rawExample.replace('If reading is 450+', 'If blood sugar is >=450').replace('being hypoglycemic', 'begin hypoglycemic'),
    rawExample.replace('If <70 being hypoglycemic protocol FDM2. ', '').replace('if 150 - 200', 'if <70 begin hypoglycemic protocol; if 150 - 200'),
  ])('handles a prose mutation without changing correction doses or scope', prose => {
    const result = run(prose);
    for (const band of ['<70=HYPOGLYCEMIC PROTOCOL', '150-200=4U', '201-250=6U', '251-300=7U', '301-350=10U', '351-400=12U', '450+=14U']) expect(result.primarySig).toContain(band);
    expect(result.primarySig).toContain('RECHECK 2H&CALL MD IF STILL HIGH');
    expect(result.primarySig).toContain('PLUS3U(H IF NOT EATING)');
    expect(result.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(false);
  });
  it.each(['provider', 'MD/NP', 'NP/PA', 'supervisor', 'on-call care team'])('uses CALL MD for recipient %s', recipient => {
    expect(run(`Sliding scale SQ TID:150-200=2 units;201+=4 units and call ${recipient}`).primarySig)
      .toBe('CBS TID SS 150-200=2U;201+=4U&CALL MD');
  });
  it.each([
    '<70 follow the hypoglycemic protocol and call provider;150-200=2 units;201+=4 units',
    '150-200=2 units;201+=4 units; <70 begin hypoglycemic protocol and call MD/NP',
  ])('sorts the low-glucose clause wherever it appears: %s', bands => {
    expect(run(`Sliding scale SQ QID:${bands}`).primarySig).toBe('CBS QID SS <70=HYPOGLYCEMIC PROTOCOL&CALL MD;150-200=2U;201+=4U');
  });
  it('uses the supplied glucagon rescue template without relabeling its volume as insulin units', () => {
    const result = run('Sliding scale SQ QID:<70 administer 1 milliliter of glucagon intramuscularly and call NP;150-200=2 units;201+=4 units');
    expect(result.primarySig).toBe('CBS QID SS <70=1ML GLUCAGON IM&CALL MD;150-200=2U;201+=4U');
    expect(result.abnormalities.some(a => a.id === 'site_glucagon_rescue')).toBe(true);
    expect(translateFreeTextSig('Sliding scale SQ QID:<70 give glucagon IM;150-200=2 units;201+=4 units', { drug }).order.issues.some(i => i.code === 'insulin-volume-input')).toBe(false);
  });
  it('keeps protocol and glucagon together when both are supplied', () => {
    expect(run('Sliding scale SQ QID:<70 follow hypoglycemic protocol and give glucagon IM and call provider;150-200=2 units;201+=4 units').primarySig)
      .toContain('<70=1ML GLUCAGON IM&HYPOGLYCEMIC PROTOCOL&CALL MD');
  });
  it('does not invent a missing low-glucose parameter', () => {
    expect(run('Sliding scale SQ before meals:150-200=2 units;201+=4 units').primarySig).toBe('CBS AC SS 150-200=2U;201+=4U');
  });
  it('keeps contradictory or unknown doses visible with a mandatory header', () => {
    const result = run('Sliding scale SQ TID:150-200=an unclear dose;201+=4 units');
    expect(result.primarySig).toMatch(/^(?:CBS|C\.B\.S\.) TID (?:SS|S\.S\.) /);
    expect(result.primarySig).toContain('150-200=AN UNCLEAR DOSE');
    expect(result.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(true);
    expect(parseSlidingScale('Sliding scale SQ TID:150-200=2 units;150-200=4 units').incomplete).toBe(true);
  });
});
