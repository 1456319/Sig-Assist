import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-04.json';
import expected from './fixtures/reported-discrepancies-2026-10-04-expected.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { rejectedOutputMatches } from '../src/lib/clinical/outputCodePolicy';
const translate = (drugName: string, rawProse: string) => translateClinicalSig({ id: 'regression', pon: 'MANUAL_ENTRY', drugName, rawProse, sourceFormat: 'manual_text' });

describe('October 4 discrepancy report including overlapping previous cases', () => {
  it.each(cases.map((c, i) => ({ ...c, expected: expected[i] })))('case $case: $drugName', c => {
    const r = translate(c.drugName, c.rawProse);
    expect(r.primarySig).toBe(c.expected);
    expect(rejectedOutputMatches(r.primarySig)).toEqual([]);
    for (const card of r.subOrders) expect(rejectedOutputMatches(card.suggestedSig)).toEqual([]);
  });
  it.each([23, 34, 36, 46, 68])('does not turn a literal %i-hour interval into a range code', n => {
    const raw = `Give 1 tablet by mouth every ${n} hours`;
    expect(translate('EXAMPLE TAB', raw).primarySig).toBe(`1T PO EVERY ${n} HOURS`);
    expect(translate('UNKNOWN', `Give two scoops by mouth every ${n} hours`).primarySig).toBe(`GIVE TWO SCOOPS PO EVERY ${n} HOURS`);
  });
  it('preserves the root meaning of an already coded Q23H while removing the rejected code', () => {
    const r = translate('EXAMPLE TAB', 'Give 1 tablet by mouth Q23H');
    expect(r.primarySig).toBe('1T PO EVERY 2 TO 3 HOURS');
    expect(r.abnormalities.some(a => a.id === 'output_code_replacement')).toBe(true);
  });
  it.each(['G-Tube', 'PEG-Tube', 'J-Tube', 'NG-Tube'])('keeps explicit %s routes in liquids and solids', tube => {
    const route = ({ 'G-Tube': 'GT', 'PEG-Tube': 'PEGT', 'J-Tube': 'JT', 'NG-Tube': 'NG' })[tube];
    expect(translate('EXAMPLE ORAL TAB 5MG', `Give 1 tablet via ${tube} daily`).primarySig).toBe(`1T ${route} QD`);
    expect(translate('EXAMPLE Oral Solution 100 MG/ML', `Give 5 ml via ${tube} daily`).primarySig).toBe(`ADM 5ML (500MG) ${route} QD`);
  });
  it('does not add dissolve instructions for an ODT administered by tube', () => {
    expect(translate('EXAMPLE ODT 4MG', 'Give 1 tablet via PEG-Tube every 8 hours').primarySig).toBe('1T PEGT Q8H');
  });
  it('does not add an acetaminophen maximum from an unrelated or non-daily limit', () => {
    expect(translate('ACETAMINOPHEN TAB 325MG', 'Give 1 tablet by mouth daily. Do not exceed 4000mg in 48 hours').primarySig).not.toContain('NTE4');
    expect(translate('ACETAMINOPHEN TAB 325MG', 'Give 1 tablet by mouth daily').primarySig).toBe('1T PO QD 3GM');
  });
  it('retains explicit dilution and requires review for unrecognized preparation instructions', () => {
    const r = translate('Polyethylene Glycol 3350 Powder', 'Give 17 grams by mouth daily for constipation. Mix in 2 oz of juice');
    expect(r.primarySig).toContain('MIX IN 2 OZ OF JUICE');
    expect(r.primarySig).not.toContain('8OZ');
    expect(r.abnormalities.some(a => a.tier === 'uncorrected_gap')).toBe(true);
  });
  it('does not collapse multiple daily doses into once every 30 days', () => {
    const r = translate('EXAMPLE TAB', 'Give 1 tablet by mouth twice daily every 30 days');
    expect(r.primarySig).toContain('BID EVERY 30 DAYS');
    expect(r.primarySig).not.toContain('QDQ30D');
  });
  it('retains multiple administrations instead of changing them to a single dose', () => {
    expect(translate('EXAMPLE TAB', 'Give 1 tablet by mouth daily for PNA for 3 Administrations').primarySig).toBe('1T PO QD FOR 3 DOSES FPNE');
  });
  it('shows the institutional FNV and before-meals conventions as applied corrections', () => {
    expect(translate(cases[28].drugName, cases[28].rawProse).abnormalities.some(a => a.id === 'site_fnv_alias')).toBe(true);
    expect(translate(cases[27].drugName, cases[27].rawProse).abnormalities.some(a => a.id === 'before_meals_schedule')).toBe(true);
  });
});

it.each([
  ['< 70', '<= 70'],
  ['350 administer 10 units', '350 administer an unspecified dose'],
  ['notified MD', 'notified supervisor'],
  ['and call MD', 'and call supervisor'],
  ['before meals and at bedtime', 'at bedtime'],
])('retains the whole scale when a condition or action cannot be resolved: %s → %s', (before, after) => {
  const c = cases[29];
  const raw = c.rawProse.replace(before, after);
  const r = translate(c.drugName, raw);
  expect(r.primarySig).toBe(raw.toUpperCase().replace(/\s+/g, ' '));
  expect(r.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(true);
});

it('prioritizes explicit source dilution over a different optional default template', () => {
  const r = translateClinicalSig({ id: 'test', pon: 'MANUAL_ENTRY', sourceFormat: 'manual_text', drugName: 'Polyethylene Glycol 3350 Powder',
    rawProse: 'Give 17 gram by mouth daily for constipation. Mix in 4 oz of juice',
    defaultSigTemplate: 'MIX 17 GM IN 8OZ OF WATER AND GIVE PO' });
  expect(r.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 4OZ OF JUICE AND GIVE PO QD FCON');
});

it('retains an explicit daily ceiling when a provided preparation template does not include its code', () => {
  const r = translateClinicalSig({ id: 'test', pon: 'MANUAL_ENTRY', sourceFormat: 'manual_text', drugName: 'Acetaminophen Tablet 325 MG',
    rawProse: 'Give 1 tablet by mouth daily. Do not exceed 4000mg of acetaminophen in a 24 hour period', defaultSigTemplate: 'GIVE 1T PO' });
  expect(r.primarySig).toContain('DO NOT EXCEED 4000MG OF ACETAMINOPHEN IN A 24 HOUR PERIOD');
});
it.each(['Give 1 tablet by mouth daily for 3 days for 1 Administrations', 'Give 1 tablet by mouth every morning and at bedtime every 30 days'])('retains compound course restrictions: %s', raw => {
  const r = translate('EXAMPLE TAB', raw);
  expect(r.abnormalities.some(a => a.tier === 'uncorrected_gap')).toBe(true);
  expect(r.primarySig).toContain(raw.includes('Administrations') ? '1 ADMINISTRATIONS' : 'EVERY 30 DAYS');
});
