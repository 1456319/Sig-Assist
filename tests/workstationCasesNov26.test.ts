import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string) {
  return translateClinicalSig({ id: 'synthetic-nov26', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse }, {
    exclusions: [{ kind: 'code', value: '2T (650MG)', replacement: '2T650' }],
  });
}

describe('November 26 workstation discrepancies', () => {
  it('splits the independent PRN and scheduled nebulizer administrations', () => {
    const result = translate('Albuterol Sulfate Nebulization Solution (2.5 MG/3ML) 0.083%',
      '3 milliliter inhale orally via nebulizer every 6 hours as needed for Shortness of Breath AND 3 milliliter inhale orally via nebulizer four times a day for wheeze for 7 Days');
    expect(result.subOrders.map(part => part.suggestedSig)).toEqual(['1V NEB Q6H PRN FSOB', '1V NEB QID X7D FWHZ']);
    expect(result.primarySig).toBe('1V NEB Q6H PRN FSOB **SPLIT** 1V NEB QID X7D FWHZ');
  });

  it('adds the reported cholestyramine preparation and keeps lunch before its drug-spacing instructions', () => {
    const result = translate('Cholestyramine Light Oral Packet 4 GM', 'Give 1 packet orally in the afternoon Give with lunch');
    expect(result.primarySig).toBe('DIS 1 PACKET IN 4OZ OF H20 AND GIVE PO QDW/L IN THE AFTERNOON (FOR OPTIMAL EFFICACY, GIVE OTHER ORAL DRUGS 1 HOUR BEFORE OR 4 HOURS AFTER CHOLESTYRAMINE)');
    expect(result.abnormalities.some(finding => finding.id === 'cholestyramine_preparation_wording' && finding.tier === 'potential_error')).toBe(true);
  });

  it('preserves explicit cholestyramine mixing and excludes other packet presentations from the site template', () => {
    const explicit = translate('Cholestyramine Light Oral Packet 4 GM', 'Give 1 packet orally daily. Mix with 6 oz water.');
    expect(explicit.primarySig).toContain('6 OZ WATER');
    expect(explicit.primarySig).not.toContain('4OZ');
    const different = translate('Cholestyramine Light Oral Packet 4 GM', 'Give 2 packets orally daily');
    expect(different.primarySig).not.toContain('DIS 1 PACKET');
    expect(translate('Other Oral Packet 4 GM', 'Give 1 packet orally daily').primarySig).not.toContain('CHOLESTYRAMINE');
  });

  it('keeps the explicitly stated enteral route on a tablet', () => {
    expect(translate('Propranolol HCl Tablet 40 MG', 'Give 1 tablet enterally three times a day for HTN').primarySig).toBe('1T ETUBE TID FHTN');
  });

  it.each(['as needed for As needed for pain', 'as needed for for pain'])('retains the indication through duplicated wording: %s', reason => {
    expect(translate('Ketorolac Tromethamine Tablet 10 MG', `Give 1 tablet by mouth every 6 hours ${reason}`).primarySig).toBe('1T PO Q6H PRN FPAIN');
  });

  it('calculates enteral acetaminophen tablets and retains the site daily-limit code', () => {
    expect(translate('Tylenol Tablet 325 MG', 'Give 650 mg enterally every 4 hours as needed for for pain').primarySig).toBe('2T650 ETUBE Q4H PRN FPAIN 3GM');
  });

  it('cleans a repeated PRN preamble while retaining an unverified eye quantity', () => {
    const result = translate('Refresh Plus Ophthalmic Solution', 'Instill 1 unit in both eyes every 24 hours as needed for as needed for dry eyes');
    expect(result.primarySig).toBe('INSTILL 1 UNIT IN BOTH EYES Q24H PRN FDE');
    expect(result.abnormalities.some(finding => finding.tier === 'uncorrected_gap')).toBe(true);
  });

  it('uses the PEG packet preparation with the explicit enteral route', () => {
    const result = translate('MiraLax Oral Packet 17 GM', 'Give 17 gram enterally in the morning for Constipation');
    expect(result.primarySig).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE ETUBE QAM FCON');
    expect(result.abnormalities.some(finding => finding.id === 'peg_packet_preparation')).toBe(true);
  });

  it('preserves a named tube route and retains conflicting routes for review', () => {
    expect(translate('Propranolol HCl Tablet 40 MG', 'Give 1 tablet via G-tube three times a day for HTN').primarySig).toBe('1T GT TID FHTN');
    const conflict = translate('Propranolol HCl Tablet 40 MG', 'Give 1 tablet orally and enterally three times a day for HTN');
    expect(conflict.abnormalities.some(finding => finding.tier === 'uncorrected_gap')).toBe(true);
    expect(conflict.primarySig).toContain('ENTERALLY');
  });
});
