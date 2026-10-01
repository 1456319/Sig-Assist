import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-01-batch3.json';
import expected from './fixtures/reported-discrepancies-2026-10-01-batch3-expected.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string, defaultSigTemplate?: string) {
  return translateClinicalSig({ id: 'latest-case', pon: 'MANUAL_ENTRY', drugName, rawProse, defaultSigTemplate, sourceFormat: 'manual_text' });
}

describe('24 exported discrepancy records, 2026-10-01 batch 3', () => {
  it.each(cases.reports.map((r, index) => ({ ...r, expected: expected[index] })))('replays $id from its actual source and optional template', r => {
    expect(translate(r.drugName, r.rawProse, r.context?.defaultSigTemplate).primarySig).toBe(r.expected);
  });

  it('removes only a fully identical repeated eye instruction', () => {
    const r = cases.reports[10];
    const result = translate(r.drugName, r.rawProse);
    expect(result.abnormalities.some(a => a.title === 'Duplicate Direction Removed')).toBe(true);
    expect(translate(r.drugName, r.rawProse + '; shake well').primarySig).toContain('SHAKE WELL');
    expect(translate(r.drugName, r.rawProse.replace('every morning to right eye', 'every morning to left eye')).primarySig).toContain('LEFT EYE');
  });

  it.each([['15', '20'], ['7.5', '10'], ['3', '4']])('calculates %s ml from the stated mEq concentration', (volume, total) => {
    expect(translate('POTASSIUM CL LIQ 20MEQ/15ML', `Give ${volume} ml orally daily for supplement`).primarySig)
      .toBe(`ADM ${volume}ML (${total}MEQ) PO QD FSU`);
  });

  it.each([
    ['ELIQUIS TAB 2.5MG', 'Give 2.5 mg by mouth twice daily for afib', '1T PO BID FAFIB'],
    ['EXAMPLE TAB 5MG', 'Give 10 mg by mouth daily', '2T (10MG) PO QD'],
    ['EXAMPLE TAB 5MG', 'Give 2.5 mg by mouth daily', '1/2T (2.5MG) PO QD'],
  ])('derives an oral solid quantity from an explicit single-ingredient strength: %s', (drug, prose, sig) => {
    expect(translate(drug, prose).primarySig).toBe(sig);
  });

  it.each([
    ['UNKNOWN DRUG', 'Give 2.5 mg by mouth daily'],
    ['EXAMPLE CAP 5MG', 'Give 2.5 mg by mouth daily'],
    ['EXAMPLE TAB 5-325MG', 'Give 5 mg by mouth daily'],
    ['EXAMPLE TAB 5MG', 'Give 3 mg by mouth daily'],
  ])('retains an unverified strength-to-quantity conversion: %s', (drug, prose) => {
    expect(translate(drug, prose).primarySig).toBe(prose.toUpperCase());
  });

  it('retains a supported frequency after an indication while protecting diagnosis words', () => {
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet by mouth for pain 4 times a day as needed').primarySig).toBe('1T PO QID PRN FPAIN');
    expect(translate('UNKNOWN DRUG', 'Instill 1 drop in left eye as needed for daily eye discomfort').primarySig).toBe('1G OS PRN FOR DAILY EYE DISCOMFORT');
  });

  it('does not invent a second quantity for each topical site', () => {
    const result = translate(cases.reports[19].drugName, cases.reports[19].rawProse);
    expect(result.primarySig).not.toContain('AP 2GM');
    expect(result.primarySig.match(/4GM/g)).toHaveLength(1);
    expect(result.abnormalities.some(a => a.title === 'Diclofenac Site/Dose Requires Verification')).toBe(true);
  });

  it('uses the verified unit-dose product to convert 3 ml into one nebulizer vial', () => {
    const r = cases.reports[20];
    const result = translate(r.drugName, r.rawProse);
    expect(result.primarySig).not.toMatch(/\b(?:INH|PO|ML)\b/);
    expect(result.abnormalities.some(a => a.title === 'Nebulizer Vial Quantity Calculated')).toBe(true);
  });

  it.each([
    ['UNKNOWN DRUG', 'Use 3 ml via nebulizer daily'],
    ['IPRATROPIUM/ALBUTEROL INH SOLN', 'Inhale 3 ml daily'],
    ['47335075649 - IPRATROPIUM/ALBUTEROL INH SOLN', 'Inhale 1.5 ml daily'],
  ])('does not assume a vial size or whole-vial dose: %s', (drug, prose) => {
    expect(translate(drug, prose).primarySig).toBe(prose.toUpperCase());
  });

  it('accepts an explicit one-vial nebulizer dose without a volume assumption', () => {
    expect(translate('UNKNOWN DRUG', 'Use 1 vial via nebulizer every 6 hours as needed for shortness of breath').primarySig)
      .toBe('1V NEB Q6H PRN FSOB');
  });

  it.each([['1 week', 'X1WK'], ['2 weeks', 'X2WK'], ['4 weeks', 'X4WK'], ['48 hours', 'X48H'], ['1 month', 'X1M']])('keeps a supported finite duration: %s', (duration, code) => {
    expect(translate('UNKNOWN DRUG', `Give 1 tablet daily for GERD for ${duration}`).primarySig).toBe(`1T PO QD ${code} FGERD`);
  });

  it.each(['1.5 weeks', '2-3 weeks', '5 weeks', '0 days'])('retains an unsupported duration for review: %s', duration => {
    const prose = `Give 1 tablet daily for GERD for ${duration}`;
    expect(translate('UNKNOWN DRUG', prose).primarySig).toBe(prose.toUpperCase());
  });

  it('preserves the plus-threshold dose and its actual notification recipient', () => {
    const r = cases.reports[22];
    const result = translate(r.drugName, r.rawProse);
    expect(result.abnormalities.some(a => a.title === 'Insulin Unit Typo Normalized')).toBe(true);
    expect(result.primarySig).toContain('401+=12U&CALL NP/PA');
    expect(result.primarySig).not.toContain('CALL MD');
  });

  it('retains the complete scale if even one numeric band cannot be translated', () => {
    const r = cases.reports[22];
    const prose = r.rawProse.replace('12 units', 'twelve unclear units');
    expect(translate(r.drugName, prose).primarySig).toBe(prose.toUpperCase());
  });

  it('retains an unfamiliar notification recipient instead of omitting it', () => {
    const r = cases.reports[22];
    const prose = r.rawProse.replace('Notify NP/PA', 'Notify on-call care team');
    expect(translate(r.drugName, prose).primarySig).toBe(prose.toUpperCase());
  });

  it.each(['5 days', '4 weeks'])('retains an unmarked course interval for review: %s', duration => {
    const prose = `Give 1 tablet daily ${duration}`;
    expect(translate('UNKNOWN DRUG', prose).primarySig).toBe(prose.toUpperCase());
  });

  it('keeps the source deadline and preparation details on a single-dose order', () => {
    const result = translate(cases.reports[23].drugName, cases.reports[23].rawProse);
    expect(result.primarySig).toContain('X1 ONLY');
    expect(result.primarySig).toContain('UNTIL 10/12/2026 15:00');
    expect(result.primarySig).toContain('DRINK WITH SECOND BOTTLE OF GATORADE');
    expect(result.primarySig).not.toMatch(/\bQD\b/);
  });

  it('does not turn the FBM condition interval into a treatment duration', () => {
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet daily as needed for no bowel movement x 2 days').primarySig)
      .toBe('1T PO QD PRN FBM2');
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet daily as needed for no bowel movement x 2 days for 7 days').primarySig)
      .toBe('1T PO QD PRN FBM2 X7D');
  });
});
