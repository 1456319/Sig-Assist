import { describe, it, expect } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string, defaultSigTemplate?: string) {
  return translateClinicalSig({
    id: 'test_miralax',
    pon: '12413362',
    sourceFormat: 'manual_text',
    drugName,
    rawProse,
    defaultSigTemplate
  });
}

describe('Miralax and PEG 3350 preparation and mutation', () => {
  it('correctly mutates base SIG for reported discrepancy disc_826fe9d1-1286-4d1c-861e-a3116d4b0992', () => {
    const result = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth in the morning for Constipation Mix in 4-8oz of non-carbonated liquid'
    );
    expect(result.primarySig).toBe(
      'MIX 17 GM (SEE INSIDE CAP) IN 4-8OZ OF NON-CARBONATED LIQUID AND GIVE PO QAM FCON'
    );
    expect(result.abnormalities.some(a => a.id === 'partial_translation')).toBe(false);
    expect(result.abnormalities.some(a => a.id.startsWith('abn_manual'))).toBe(false);
  });

  it('handles markdown bold asterisks in dilution directions', () => {
    const result = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth in the morning for Constipation **Mix in 4-8oz of non-carbonated liquid**'
    );
    expect(result.primarySig).toBe(
      'MIX 17 GM (SEE INSIDE CAP) IN 4-8OZ OF NON-CARBONATED LIQUID AND GIVE PO QAM FCON'
    );
  });

  it('infers jar formulation for Miralax when no formulation is specified in drug or prose', () => {
    const result = translate(
      'MIRALAX',
      'Give 17 gram by mouth daily for Constipation'
    );
    expect(result.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('defaults to 238g jar (SEE INSIDE CAP) when no formulation is specified in drug or sig', () => {
    const result = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth daily for constipation'
    );
    expect(result.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('detects packet formulation when PACKET is in the sig prose', () => {
    const result = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 1 packet by mouth in the morning for Constipation'
    );
    expect(result.primarySig).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QAM FCON');
  });

  it('detects jar formulation when CAP or CAPFUL is in the sig prose', () => {
    const r1 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 1 capful by mouth daily for Constipation'
    );
    expect(r1.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO QD FCON');

    const r2 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 1 cap by mouth daily for Constipation'
    );
    expect(r2.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('mutates liquid and volume for various beverages', () => {
    const r1 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth daily for constipation. Mix in 4 oz of juice'
    );
    expect(r1.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 4OZ OF JUICE AND GIVE PO QD FCON');

    const r2 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth at bedtime for constipation. Dissolve in 8 ounces of cranberry juice'
    );
    expect(r2.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF CRANBERRY JUICE AND GIVE PO QHS FCON');

    const r3 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth twice daily for constipation. Mix in non-carbonated liquid'
    );
    expect(r3.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF NON-CARBONATED LIQUID AND GIVE PO BID FCON');

    const r4 = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram by mouth daily for constipation. Mix in a glass of water'
    );
    expect(r4.primarySig).toBe('MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('mutates enteral tube route correctly', () => {
    const result = translate(
      'Polyethylene Glycol 3350 Powder',
      'Give 17 gram via PEG-Tube in the morning for constipation. Mix in 4-8 oz water'
    );
    expect(result.primarySig).toBe(
      'MIX 17 GM (SEE INSIDE CAP) IN 4-8OZ OF WATER AND GIVE PEGT QAM FCON'
    );
  });
});
