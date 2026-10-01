import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-01.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { parseInboundOrder } from '../src/lib/clinical/inboundParser';
import { evaluatePaxitPackaging } from '../src/lib/clinical/paxitEngine';

function translate(drugName: string, rawProse: string) {
  return translateClinicalSig({ id: 'reported-case', pon: 'MANUAL_ENTRY', drugName, rawProse, sourceFormat: 'manual_text' });
}

describe('reported mistranslations, 2026-10-01', () => {
  it.each(cases.reports.slice(0, 2))('retains unknown nebulizer vial size for manual review: $id', report => {
    const result = translate(report.drugName, report.rawProse);
    expect(result.primarySig).toBe(report.rawProse.toUpperCase());
    expect(result.abnormalities.some(a => a.title === 'Unverified Nebulizer Vial Quantity')).toBe(true);
    expect(result.primarySig).not.toMatch(/\bPO\b/);
  });

  it('keeps the topical site, Saturday evening shift, diagnosis and every shampoo handling instruction', () => {
    const report = cases.reports[2];
    const result = translate(report.drugName, report.rawProse);
    expect(result.primarySig).toBe('AP TPCL TO SCALP QDDAY6 (DURING EVENING SHIFT) FOR SEBORRHEA CAPITIS. APPLY TO SCALP AND WORK IN AND ALLOW TO SIT FOR 5 MINUTES AND THEN RINSE. CAN SHAMPOO/CONDITION AS NORMAL AFTERWARDS');
    expect(result.primarySig).not.toMatch(/\b(?:1T|PO|QDDAY7)\b/);
  });

  it('keeps scheduled TID separate from supplemental PRN dosing and preserves both dose limits', () => {
    const report = cases.reports[3];
    const result = translate(report.drugName, report.rawProse);
    expect(result.primarySig).toBe('1T PO TID X7D FOR HIP PAIN 3GME. MAY GIVE PRN DOSE WITH SCHEDULED DOSE FOR TOTAL OF 1000 MG, DO NOT EXCEED MORE THAN 3000 MG OF TYLENOL IN 24 HR PERIOD');
    expect(result.primarySig).not.toContain('TID PRN');
    expect(result.abnormalities.some(a => a.title === 'Additional Instructions Require Review')).toBe(true);
  });

  it('treats directions starting with a volume as directions rather than a medication name', () => {
    const parsed = parseInboundOrder(cases.reports[0].rawProse);
    expect(parsed.drugName).toBe('UNKNOWN DRUG');
    expect(parsed.rawProse).toBe(cases.reports[0].rawProse);
    expect(translateClinicalSig(parsed).primarySig).toBe(cases.reports[0].rawProse.toUpperCase());
  });

  it.each([
    ['TOPICAL CREAM', 'Apply topically daily'],
    ['UNKNOWN DRUG', 'Use as directed'],
    ['EYE DROPS', 'Instill 1 drop in left eye daily'],
    ['PREDNISONE TAB 10MG', 'By mouth daily'],
  ])('does not invent an oral tablet for %s: %s', (drug, prose) => {
    const result = translate(drug, prose);
    expect(result.primarySig).not.toMatch(/\b1T\b/);
    expect(result.primarySig).not.toMatch(/\bPO\b/);
  });

  it('retains an unfamiliar supplemental clause instead of dropping it', () => {
    const result = translate('EXAMPLE TAB 10MG', 'Take 1 tablet daily. May give only after staff assessment and call prescriber if repeated.');
    expect(result.primarySig).toContain('MAY GIVE ONLY AFTER STAFF ASSESSMENT AND CALL PRESCRIBER IF REPEATED.');
  });

  it.each([
    ['every Sat', 'QDDAY6'], ['every Saturday', 'QDDAY6'], ['every Sun', 'QDDAY7'],
    ['in the evening every Sat', 'QPMDAY6'], ['every morning every Mon', 'QAMDAY1'],
  ])('respects the reference weekday mapping: %s', (schedule, token) => {
    expect(translate('TOPICAL CREAM', `Apply topically ${schedule}`).primarySig).toBe(`AP TPCL ${token}`);
  });

  it('does not classify capitis or topical products as Paxit oral capsules', () => {
    const report = cases.reports[2];
    expect(evaluatePaxitPackaging(report.drugName, report.rawProse).isPaxitSolid).toBe(false);
  });

  it.each([
    'Use 3 ml every 6 hours', 'Take 1 tablet by mouth', 'Take 0 tablets daily',
    'Use 3 ml without a nebulizer every 6 hours',
  ])('retains unsupported instructions without assuming dose/route/frequency: %s', prose => {
    const result = translate('UNKNOWN DRUG', prose);
    expect(result.primarySig).toBe(prose.toUpperCase());
    expect(result.abnormalities.some(a => a.tier === 'uncorrected_gap')).toBe(true);
  });

  it.each(['2000 mg in 24 hours', '3000 mg in 12 hours'])('does not replace a different APAP limit with 3GME: %s', limit => {
    const result = translate('ACETAMINOPHEN TAB 500MG', `Give 1 tablet by mouth daily, do not exceed ${limit}`);
    expect(result.primarySig).toContain(`DO NOT EXCEED ${limit.toUpperCase()}`);
    expect(result.primarySig).not.toMatch(/\b3GME?\b/);
  });

  it('leaves a genuinely PRN primary dose as PRN', () => {
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet by mouth three times a day as needed for pain for 7 days').primarySig).toBe('1T PO TID PRN FPAIN X7D');
  });

  it('does not let the volume in a supplemental dose replace the primary tablet dose', () => {
    const result = translate('EXAMPLE TAB 10MG', 'Take 1 tablet by mouth daily. May give 5 ml of a different medication as directed.');
    expect(result.primarySig).toBe('1T PO QD. MAY GIVE 5 ML OF A DIFFERENT MEDICATION AS DIRECTED.');
  });
});
