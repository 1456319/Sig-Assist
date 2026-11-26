import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string) {
  return translateClinicalSig({ id: 'synthetic-nov26', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse }, {
    exclusions: [{ kind: 'code', value: '2T (650MG)', replacement: '2T650' }],
  });
}

describe('November 26 workstation discrepancies', () => {
  it('keeps the explicitly stated enteral route on a tablet', () => {
    expect(translate('Propranolol HCl Tablet 40 MG', 'Give 1 tablet enterally three times a day for HTN').primarySig).toBe('1T ETUBE TID FHTN');
  });

  it.each(['as needed for As needed for pain', 'as needed for for pain'])('retains the indication through duplicated wording: %s', reason => {
    expect(translate('Ketorolac Tromethamine Tablet 10 MG', `Give 1 tablet by mouth every 6 hours ${reason}`).primarySig).toBe('1T PO Q6H PRN FPAIN');
  });

  it('calculates enteral acetaminophen tablets and retains the site daily-limit code', () => {
    expect(translate('Tylenol Tablet 325 MG', 'Give 650 mg enterally every 4 hours as needed for for pain').primarySig).toBe('2T650 ETUBE Q4H PRN FPAIN 3GM');
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
