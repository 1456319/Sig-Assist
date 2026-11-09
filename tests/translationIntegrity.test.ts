import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { SIG_CODE_REFERENCE } from '../src/lib/clinical/sigCodeReference';

function translate(drugName: string, rawProse: string, defaultSigTemplate?: string) {
  return translateClinicalSig({ id: 'integrity', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse, defaultSigTemplate });
}
const diluents = [
  ['4-8 oz of fluid of choice', '4-8OZ OF FOC'],
  ['120 to 240 ml of fluids', '120-240ML OF FLUIDS'],
  ['8 oz water, juice, or milk', '8OZ OF WATER,JUICE,OR MILK'],
];
const preparations = ['Mix in', 'Mixed in', 'Dissolve in'].flatMap(verb => diluents.flatMap(([liquid, expectedLiquid]) => [
  { verb, liquid, expectedLiquid, drug: 'MiraLax Oral Packet 17 GM', dose: '1 packet', quantity: '1 PACKET' },
  { verb, liquid, expectedLiquid, drug: 'MiraLax Oral Powder 17 GM/SCOOP', dose: '1 scoop', quantity: 'SEE INSIDE CAP' },
]));

describe('PEG preparation and retained instructions', () => {
  it.each(preparations)('$drug: $verb $liquid', c => {
    const raw = `Give ${c.dose} by mouth twice daily for constipation for 7 days. ${c.verb} ${c.liquid}. Hold for loose stools`;
    const r = translate(c.drug, raw, 'MIX 17 GM IN 8OZ OF WATER AND GIVE PO QD');
    expect(r.primarySig).toBe(`MIX 17 GM (${c.quantity}) IN ${c.expectedLiquid} AND GIVE PO BID X7D FCON (H LS)`);
  });
  it('uses the supplied packet convention for the Mix-In Pax product name', () => {
    expect(translate('MiraLax Mix-In Pax Oral Packet 17 GM', 'Give 1 packet by mouth daily for constipation').primarySig)
      .toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });
  it.each(['MIRALAX PACKET 8.5GM', 'POLYETHYLENE GLYCOL WITH ELECTROLYTES PACKET 17GM', 'UNKNOWN POWDER PACKET'])('does not force the 17g preparation onto %s', drug => {
    expect(translate(drug, 'Give 1 packet orally daily for constipation').primarySig).toBe('1PKT PO QD FCON');
  });
  it('does not override an explicit different scoop strength', () => {
    const r = translate('Polyethylene Glycol Powder 8.5 GM/SCOOP', 'Give 1 scoop by mouth daily for constipation');
    expect(r.primarySig).not.toContain('17 GM');
    expect(r.primarySig).toContain('1 SCOOP');
  });
  it.each(['2 oz of water', '10 oz of juice'])('preserves unsupported explicit dilution: %s', volume => {
    const r = translate('MIRALAX PACKETS', `Give 1 packet by mouth daily for constipation. Mix in ${volume}`);
    expect(r.primarySig).toContain(`MIX IN ${volume.toUpperCase()}`);
    expect(r.primarySig).not.toContain('8OZ');
  });
  it('does not replace a second, conflicting dilution with the default', () => {
    const r = translate('MIRALAX PACKETS', 'Give 1 packet by mouth daily. Mix in 4 oz water. Mix in 6 oz juice');
    expect(r.primarySig).toContain('MIX IN 4 OZ WATER. MIX IN 6 OZ JUICE');
    expect(r.primarySig).not.toContain('8OZ');
  });
  it('retains duration, PRN, hold and discontinuation together', () => {
    const r = translate('MIRALAX PACKETS', 'Give 1 packet by mouth every 24 hours as needed for constipation for 14 days. Mix in 4-8 oz liquid. Hold for loose stools. Discontinue once BM returns');
    expect(r.primarySig).toBe('MIX 17 GM (1 PACKET) IN 4-8OZ OF LIQUID AND GIVE PO Q24H PRN FCON X14D (H LS). DISCONTINUE ONCE BM RETURNS');
  });
});

describe('formulation and instruction integrity', () => {
  it.each([
    ['Albuterol Sulfate Nebulization Solution (2.5 MG/3ML) 0.083%', '3 ml', '1V NEB QID X7D FCOU'],
    ['Ipratropium-Albuterol Solution 0.5-2.5 (3) MG/3ML', '3 ml', '1V NEB QID X7D FCOU'],
    ['Ipratropium-Albuterol Solution 0.5-2.5 (3) MG/3ML', '1.5 ml', 'ADM 1.5ML NEB QID X7D FCOU'],
    ['UNKNOWN INHALATION SOLUTION', '3 ml', 'ADM 3ML NEB QID X7D FCOU'],
  ])('uses 1V only for a verified whole-vial dose: %s, %s', (drug, dose, expected) => {
    expect(translate(drug, `Inhale ${dose} via nebulizer four times a day for cough for 7 days`).primarySig).toBe(expected);
  });
  it('does not interpret an HFA inhaler as a nebulizer', () => {
    const r = translate('Albuterol Sulfate HFA Aerosol Solution 108 (90 Base) MCG/ACT', 'Inhale 2 puffs orally every 6 hours as needed for shortness of breath');
    expect(r.primarySig).toContain('2P');
    expect(r.primarySig).not.toMatch(/\b(?:NEB|1V)\b/);
  });
  it('restricts the lorazepam-specific dose code to lorazepam at the matching concentration', () => {
    expect(translate('Lorazepam Concentrate 2 MG/ML', 'Give 0.5 ml by mouth daily').primarySig).toBe('LOR1MG PO QD');
    expect(translate('Haloperidol Lactate Concentrate 2 MG/ML', 'Give 0.5 ml by mouth daily').primarySig).toBe('ADM 0.5ML (1MG) PO QD');
    expect(translate('Lorazepam Concentrate 1 MG/ML', 'Give 0.5 ml by mouth daily').primarySig).toBe('ADM 0.5ML (0.5MG) PO QD');
  });
  it('preserves the explicit injectable route', () => {
    expect(translate('Hydroxyzine Solution 25 MG/ML', 'Inject 25 mg intramuscularly every 8 hours as needed for anxiety').primarySig).toBe('INJ 1ML (25MG) IM Q8H PRN FANX');
  });
  it('uses a unit strength printed on the label without inferring unit-to-mass equivalence', () => {
    expect(translate('Cholecalciferol Tablet 25 MCG (1000 UT)', 'Give 1000 unit by mouth daily for supplement').primarySig).toBe('1T PO QD FSU');
    expect(translate('Cholecalciferol Tablet 25 MCG', 'Give 1000 unit by mouth daily for supplement').primarySig).toContain('1000 UNIT');
  });
  it('keeps routine and PRN doses on one controlled-drug card', () => {
    const r = translate('Oxycodone Tablet 5 MG', 'Give 2.5 mg by mouth three times a day for pain AND Give 2.5 mg by mouth every 4 hours as needed for pain');
    expect(r.subOrders).toHaveLength(1);
    expect(r.primarySig).toBe('1/2T (2.5MG) PO TID FPAIN **SPLIT** 1/2T (2.5MG) PO Q4H PRN FPAIN');
  });
  it('separates routine and PRN nebulizer regimens without sharing their interval', () => {
    const r = translate('Ipratropium-Albuterol Solution 0.5-2.5 (3) MG/3ML', '3 ml inhale orally every 6 hours for COPD AND 3 ml inhale orally every 4 hours as needed for wheezing');
    expect(r.subOrders.map(s => s.suggestedSig)).toEqual(['1V NEB Q6H FCOPD', '1V NEB Q4H PRN FWHZ']);
  });
  it('retains the medication application when the wound is also left open to air', () => {
    const r = translate('Greers Goo', 'Cleanse sacrum with soap and water, pat dry, apply Greers Goo and leave open to air every shift');
    expect(r.primarySig).toContain('APPLY GREERS GOO,LEAVE OPEN TO AIR QS');
  });
  it('retains a separate PRN procedure with its own instructions', () => {
    const prn = 'Apply to sacrum topically every 24 hours as needed for soiling. Cleanse with saline, pat dry, cover with gauze';
    const r = translate('Zinc Oxide Paste', `Apply to sacrum topically daily. Cleanse with soap and water, pat dry, apply zinc oxide AND ${prn}`);
    expect(r.subOrders).toHaveLength(2);
    expect(r.subOrders[1].suggestedSig).toBe(prn.toUpperCase());
  });
  it('never truncates a long treatment at character 199', () => {
    const site = 'right upper arm and left upper arm and right lower leg and left lower leg and right forearm and left forearm and right shoulder and left shoulder and right upper thigh and left upper thigh';
    const r = translate('Santyl Ointment', `Apply to ${site} topically daily. Cleanse with wound cleanser, pat dry, apply Santyl, cover with xeroform, wrap with kerlix`);
    expect(r.primarySig.length).toBeGreaterThan(199);
    expect(r.primarySig).toContain('WRAP W/KERLIX QD');
    expect(r.abnormalities.some(a => a.id === 'sig_length_review')).toBe(true);
  });
  it('distinguishes minute schedules from month codes in the site codebook', () => {
    expect(SIG_CODE_REFERENCE.Q2M).toMatch(/MONTHS/);
    expect(SIG_CODE_REFERENCE.Q5M).toBe('EVERY 5 MINUTES');
    expect(translate('Naloxone Nasal Spray', '1 spray in both nostrils every 2 minutes as needed for overdose').primarySig).toContain('EVERY 2 MINUTES');
    expect(translate('Nitroglycerin Tablet 0.4 MG', 'Give 1 tablet sublingually every 5 minutes as needed for chest pain').primarySig).toContain('Q5M');
  });
});
