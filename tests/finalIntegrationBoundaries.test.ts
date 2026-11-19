import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { splitSupplementalDirections } from '../src/lib/clinical/instructionClauses';
import { translateFreeTextSig } from '../src/lib/sigEngine';

function clinical(drugName: string, rawProse: string) {
  return translateClinicalSig({ id: 'integration-boundary', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse });
}

describe('comma-delimited primary schedules before supplemental actions', () => {
  it.each([
    ['TAKE 1 TABLET BY MOUTH, BEFORE BREAKFAST', 'DO NOT CRUSH'],
    ['INHALE 2 PUFFS, IN THE MORNING AND EVENING', 'MAY USE EXTRA PUFF IF NEEDED'],
    ['GIVE 1 TABLET BY MOUTH, ONLY WHEN AWAKE', 'DO NOT GIVE IF SLEEPING'],
  ])('keeps the complete primary clause: %s', (primary, supplemental) => {
    expect(splitSupplementalDirections(`${primary}, ${supplemental}`)).toEqual({ primary, supplemental });
  });

  it('translates the primary breakfast schedule and retains the crushing restriction', () => {
    const result = clinical('METOPROLOL 25 MG TABLET', 'TAKE 1 TABLET BY MOUTH, BEFORE BREAKFAST, DO NOT CRUSH');
    expect(result.primarySig).toBe('1T PO QDA/B. DO NOT CRUSH');
    expect(result.abnormalities).toContainEqual(expect.objectContaining({ id: 'retained_supplemental_instructions', trigger: 'DO NOT CRUSH' }));
    expect(result.abnormalities.some(finding => finding.id === 'partial_translation')).toBe(false);
  });

  it.each(['.', ';'])('keeps a sentence-initial qualifier and its comma after %s', boundary => {
    expect(splitSupplementalDirections(`TAKE 1 TABLET DAILY${boundary} BEFORE BREAKFAST, RECHECK BLOOD SUGAR`)).toEqual({
      primary: 'TAKE 1 TABLET DAILY', supplemental: 'BEFORE BREAKFAST, RECHECK BLOOD SUGAR',
    });
  });

  it('retains a qualifier directly before a later dose', () => {
    expect(splitSupplementalDirections('TAKE 1 TABLET DAILY, AT BEDTIME TAKE 2')).toEqual({
      primary: 'TAKE 1 TABLET DAILY', supplemental: 'AT BEDTIME TAKE 2',
    });
  });

  it('keeps the primary coordinated morning and bedtime schedule', () => {
    expect(clinical('GUAIFENESIN ER 600 MG TABLET', 'Give 1 tablet by mouth every morning and at bedtime for cough for 7 days do not crush, chew, or split').primarySig)
      .toBe('1T PO BIDAMHS X7D FCOU. DO NOT CRUSH, CHEW, OR SPLIT');
  });
});

describe('scale modifier qualifiers immediately after a route', () => {
  const drug = 'INSULIN LISPRO 100 UNIT/ML INJECTION';
  const routes = [
    ['SQ', 'SQ'], ['SUBQ', 'SQ'], ['SC', 'SQ'], ['SUBCUTANEOUS', 'SQ'], ['SUBCUTANEOUSLY', 'SQ'],
    ['IM', 'IM'], ['INTRAMUSCULAR', 'IM'], ['INTRAMUSCULARLY', 'IM'],
  ];
  const footer = 'BEFORE BREAKFAST GIVE HALF';
  const source = (route: string) => `INSULIN SLIDING SCALE ACHS: 151-200 = 2 UNITS, 201-250 = 4 UNITS ${route} ${footer}`;

  it.each(routes)('keeps the header schedule and dose scope after %s in both entry points', (route, routeToken) => {
    const raw = source(route);
    const expected = `CBS ACHS SS 151-200=2U;201-250=4U${routeToken === 'SQ' ? '' : ` ${routeToken}`}. ${footer}`;
    const result = clinical(drug, raw);
    expect(result.primarySig).toBe(expected);
    expect(result.abnormalities).toContainEqual(expect.objectContaining({
      id: 'sliding_scale_unparsed_action', tier: 'uncorrected_gap', trigger: footer,
    }));
    expect(result.abnormalities.some(finding => finding.id === 'incomplete_sliding_scale')).toBe(false);
    const classic = translateFreeTextSig(raw, { drug });
    expect(classic.sig).toBe(expected);
    expect(classic.order.issues).toContainEqual(expect.objectContaining({
      code: 'retained-sliding-scale-instructions', severity: 'warning',
    }));
  });

  it.each(routes)('treats %s as a boundary only in isolated scale-tail mode', (route) => {
    const tail = `${route} ${footer}`;
    expect(splitSupplementalDirections(tail, { allowScaleActions: true })).toEqual({ primary: route, supplemental: footer });
    expect(splitSupplementalDirections(tail)).toEqual({ primary: `${route} BEFORE BREAKFAST`, supplemental: 'GIVE HALF' });
  });

  it('retains a comma inside a modifier that begins immediately after the scale route', () => {
    const qualifiedFooter = 'BEFORE BREAKFAST, GIVE HALF';
    const raw = `INSULIN SLIDING SCALE ACHS: 151-200 = 2 UNITS, 201-250 = 4 UNITS SQ ${qualifiedFooter}`;
    const expected = `CBS ACHS SS 151-200=2U;201-250=4U. ${qualifiedFooter}`;
    const result = clinical(drug, raw);
    expect(result.primarySig).toBe(expected);
    expect(result.abnormalities).toContainEqual(expect.objectContaining({ id: 'sliding_scale_unparsed_action', trigger: qualifiedFooter }));
    const classic = translateFreeTextSig(raw, { drug });
    expect(classic.sig).toBe(expected);
    expect(classic.order.issues.some(issue => issue.code === 'retained-sliding-scale-instructions')).toBe(true);
  });

  it.each(['AT BEDTIME GIVE HALF THE SCALE DOSE', 'BEFORE BREAKFAST, GIVE HALF'])('preserves a directly qualified modifier: %s', qualifiedFooter => {
    expect(splitSupplementalDirections(qualifiedFooter, { allowScaleActions: true })).toEqual({ primary: '', supplemental: qualifiedFooter });
    const raw = `INSULIN SLIDING SCALE ACHS: 151-200 = 2 UNITS, 201-250 = 4 UNITS SQ. ${qualifiedFooter}`;
    const expected = `CBS ACHS SS 151-200=2U;201-250=4U. ${qualifiedFooter}`;
    const result = clinical(drug, raw);
    expect(result.primarySig).toBe(expected);
    expect(result.abnormalities).toContainEqual(expect.objectContaining({ id: 'sliding_scale_unparsed_action', trigger: qualifiedFooter }));
    const classic = translateFreeTextSig(raw, { drug });
    expect(classic.sig).toBe(expected);
    expect(classic.order.issues.some(issue => issue.code === 'retained-sliding-scale-instructions')).toBe(true);
  });
});
