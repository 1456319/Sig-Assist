import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-03.json';
import expected from './fixtures/reported-discrepancies-2026-10-03-expected.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

const translate = (drugName: string, rawProse: string) => translateClinicalSig({ id: 'regression', pon: 'MANUAL_ENTRY', drugName, rawProse, sourceFormat: 'manual_text' });


describe('October 3 reported translator discrepancies', () => {
  it.each(cases.map((c, i) => ({ ...c, expected: expected[i] })))('case $case: $drugName', c => {
    expect(translate(c.drugName, c.rawProse).primarySig).toBe(c.expected);
  });

  it('splits the whole and half tablet into coordinated Paxit cards without changing the total dose', () => {
    const result = translate(cases[0].drugName, cases[0].rawProse);
    expect(result.subOrders.map(s => s.suggestedSig)).toEqual([
      '1T PO QD FOR SCHIZOAFFECTIVE DISORDER. TAW FRACTIONAL-TABLET DOSE (TD 7.5MG)',
      '1/2T (2.5MG) PO QD FOR SCHIZOAFFECTIVE DISORDER. TAW WHOLE-TABLET DOSE (TD 7.5MG)',
    ]);
  });

  it.each([
    ['UNKNOWN FORMULATION', 'Give two scoops by mouth every day for pain', 'GIVE TWO SCOOPS PO QD FPAIN'],
    ['UNKNOWN FORMULATION', 'Give 0.75 wafer by mouth every eight hours as needed for neck pain', 'GIVE 0.75 WAFER PO Q8H PRN FOR NECK PAIN'],
    ['UNKNOWN FORMULATION', 'Give 2.5 mg by mouth one time a day', 'GIVE 2.5 MG PO QD'],
    ['EXAMPLE TAB 5MG', 'Give 17 scoops by mouth daily', 'GIVE 17 SCOOPS PO QD'],
    ['UNKNOWN FORMULATION', 'Use as needed for daily eye discomfort', 'USE PRN FOR DAILY EYE DISCOMFORT'],
  ])('translates clear directions while retaining unknown quantities/formulations: %s / %s', (drug, prose, expected) => {
    const r = translate(drug, prose);
    expect(r.primarySig).toBe(expected);
    expect(r.abnormalities.some(a => a.id === 'partial_translation')).toBe(true);
    expect(r.primarySig).not.toMatch(/\dT\b/);
  });

  it.each([
    ['Give one tablet by mouth one time a day', '1T PO QD'],
    ['Give .5 tablet by mouth daily', '1/2T (2.5MG) PO QD'],
    ['Give half a tablet by mouth every day', '1/2T (2.5MG) PO QD'],
    ['Give one-quarter tablet by mouth daily', '1/4T (1.25MG) PO QD'],
    ['Give three quarters tablet by mouth daily', '3/4T (3.75MG) PO QD'],
    ['Give ½ tablet by mouth daily', '1/2T (2.5MG) PO QD'],
    ['Give one and a half tablets by mouth daily', '1-1/2T (7.5MG) PO QD'],
    ['Give one tablet by mouth every twenty-four hours for seven days', '1T PO Q24H X7D'],
    ['Give one tablet by mouth every other day for supplementation', '1T PO QDQ2D FSU'],
  ])('preserves numeric meaning: %s', (prose, expected) => {
    expect(translate('EXAMPLE TAB 5MG', prose).primarySig).toBe(expected);
  });

  it.each([
    ['Give 1-2 tablets by mouth daily', 'GIVE 1-2 TABLETS PO QD'],
    ['Give 0.5-1.5 tablets by mouth daily', 'GIVE 0.5-1.5 TABLETS PO QD'],
    ['Give 0.0 tablet by mouth daily', 'GIVE 0.0 TABLET PO QD'],
    ['Give -0.5 tablet by mouth daily', 'GIVE -0.5 TABLET PO QD'],
    ['Give 1/0 tablet by mouth daily', 'GIVE 1/0 TABLET PO QD'],
  ])('does not collapse an invalid or variable number: %s', (prose, expected) => {
    const r = translate('EXAMPLE TAB 5MG', prose);
    expect(r.primarySig).toBe(expected);
    expect(r.abnormalities.some(a => a.tier !== 'applied_correction')).toBe(true);
  });

  it.each([
    ['Magnesium Hydroxide Oral Suspension 1200MG/15ML', 'Give 30 ml by mouth daily', 'ADM 30ML (2400MG) PO QD'],
    ['Magnesium Hydroxide Oral Suspension 2400MG/10ML', 'Give 15 ml by mouth daily', 'ADM 15ML (3600MG) PO QD'],
    ['EXAMPLE SOLUTION 2 MG/ML', 'Give .25 ml by mouth daily', 'ADM 0.25ML (0.5MG) PO QD'],
    ['EXAMPLE SOLUTION 2 MG/ML', 'Give half a ml by mouth daily', 'LOR1MG PO QD'],
    ['EXAMPLE SOLUTION 1 MG/ML', 'Give 0.5 ml by mouth daily', 'ADM 0.5ML (0.5MG) PO QD'],
  ])('calculates using the actual liquid concentration: %s', (drug, prose, expected) => {
    expect(translate(drug, prose).primarySig).toBe(expected);
  });

  it('flags the missing magnesium hydroxide strength instead of choosing a concentration', () => {
    const r = translate(cases[1].drugName, cases[1].rawProse);
    expect(r.primarySig).not.toContain('MG)');
    expect(r.abnormalities.some(a => a.id === 'missing_liquid_concentration')).toBe(true);
  });

  it.each([
    ['Instill 4 drops in right ear twice daily', '4G AD BID'],
    ['Instill 3 drops in both ears daily', '3G AU QD'],
    ['Instill one drop in left eye daily', '1G OS QD'],
    ['Insert two suppositories rectally every 24 hours', '2RS Q24H'],
    ['Insert 0.5 grams vaginally daily', 'INSERT 0.5GM PV QD'],
    ['Give 1 tablet sublingually daily', '1T SL QD'],
    ['Give 1 tablet by mouth or sublingually daily', '1T PO/SL QD'],
  ])('respects explicit form and route: %s', (prose, expected) => {
    expect(translate('UNKNOWN DRUG', prose).primarySig).toBe(expected);
  });

  it('does not apply a known vial presentation to a different volume or strength', () => {
    expect(translate('ALBUTEROL INH SOLN 0.083%', 'Inhale 1.5 ml via nebulizer daily').primarySig).toBe('ADM 1.5ML NEB QD');
    expect(translate('ALBUTEROL INH SOLN 0.5%', 'Inhale 3 ml via nebulizer daily').primarySig).toBe('ADM 3ML NEB QD');
  });

  it.each(['1-3 ml', '1/2 ml', '0.1 vial'])('does not turn an ambiguous or fractional nebulizer amount into one whole vial: %s', amount => {
    const r = translate('ALBUTEROL INH SOLN 0.083%', `Inhale ${amount} via nebulizer daily`);
    expect(r.primarySig).toBe(`INHALE ${amount.toUpperCase()} NEB QD`);
    expect(r.abnormalities.some(a => a.tier === 'uncorrected_gap')).toBe(true);
  });

  it('retains explicit powder preparation and does not treat other powders as PEG', () => {
    const r = translate('GlycoLax Powder', 'Give 17 grams by mouth daily for constipation. Mix in 4 oz of juice.');
    expect(r.primarySig).toContain('MIX IN 4 OZ OF JUICE');
    expect(r.primarySig).not.toContain('8OZ');
    expect(translate('UNKNOWN POWDER', 'Give 17 grams by mouth daily').primarySig).toBe('ADM 17GM PO QD');
    expect(translate('GlycoLax Powder', 'Give 8.5 grams by mouth daily').primarySig).toBe('ADM 8.5GM PO QD');
  });

  it('preserves a changed or unrecognized repeated direction instead of deduplicating it', () => {
    expect(translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth daily for pain. Take 2 tablets by mouth daily').primarySig)
      .toContain('TAKE 2 TABLETS BY MOUTH DAILY');
    expect(translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth daily for pain. Take 1 tablet by mouth daily with a full glass of water').primarySig)
      .toContain('WITH A FULL GLASS OF WATER');
  });

  it('preserves missing intervals and multiple doses on alternate days', () => {
    const r = translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth with meals');
    expect(r.primarySig).toBe('GIVE 1 TABLET PO WITH MEALS');
    expect(r.abnormalities.some(a => a.title === 'Missing Frequency')).toBe(true);
    expect(translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth twice daily every other day').primarySig).toBe('GIVE 1 TABLET PO BID QOD');
  });

  it('uses the compound indication code only when its conjunction agrees with the source', () => {
    expect(translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth daily for agitation or nausea or vomiting').primarySig).toBe('1T PO QD FAGT OR FNV');
    expect(translate('EXAMPLE TAB 5MG', 'Give 1 tablet by mouth daily for nausea and vomiting').primarySig).toBe('1T PO QD FNA AND FVOM');
  });

  it.each(['EXAMPLE TAB ER 5MG', 'EXAMPLE CAP 5MG', 'LORAZEPAM TAB 5MG'])('does not automatically split unsuitable products: %s', drug => {
    expect(translate(drug, 'Give 1.5 tablet by mouth daily').subOrders).toHaveLength(1);
  });
});
