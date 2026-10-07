import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-06.json';
import expected from './fixtures/reported-discrepancies-2026-10-06-expected.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { rejectedOutputMatches } from '../src/lib/clinical/outputCodePolicy';

const translate = (drugName: string, rawProse: string) => translateClinicalSig({ id: 'regression', pon: 'MANUAL_ENTRY', drugName, rawProse, sourceFormat: 'manual_text' });
// No patient/order identifiers are stored. Named recipient and phone are synthetic.
// Keep source qualifiers and notification instructions even where technician prose omits them.


describe('October 6 active discrepancies', () => {
  it.each(cases.map((c, i) => ({ ...c, expected: expected[i] })))('case $case: $drugName', c => {
    const result = translate(c.drugName, c.rawProse);
    expect(result.primarySig).toBe(c.expected);
    expect(rejectedOutputMatches(result.primarySig)).toEqual([]);
  });

  it.each([
    ['as needed for TID PRN FOR SYSTOLIC GREATER THAN 170 MMHG', 'TID PRN FOR SBP >170MMHG'],
    ['BID as needed for systolic blood pressure greater than or equal to 150 mmHg', 'BID PRN FOR SBP >=150MMHG'],
    ['Q8H PRN for diastolic less than 90 mmHg', 'Q8H PRN FOR DBP <90MMHG'],
  ])('preserves PRN schedule and comparison: %s', (schedule, expected) => {
    expect(translate('EXAMPLE TAB', `Give 1 tablet by mouth ${schedule}`).primarySig).toBe(`1T PO ${expected}`);
  });

  it.each(['intramuscularly', 'intramuscular', 'IM'])('retains IM injection dose and route: %s', route => {
    expect(translate('EXAMPLE Injection 1 GM', `Inject 0.5 gram ${route} daily`).primarySig).toBe('INJ 0.5GM IM QD');
    expect(translate('EXAMPLE Injection 10 MG/1ML', `Inject 5 mg ${route} daily`).primarySig).toBe('INJ 0.5ML (5MG) IM QD');
  });
  it.each(['daily', 'intramuscularly or subcutaneously daily', 'intrathecally daily'])('does not default an unknown/conflicting injection route to SQ: %s', route => {
    const r = translate('EXAMPLE Injection 1 GM', `Inject 1 gram ${route}`);
    expect(r.primarySig).toContain('1 GRAM');
    if (route.includes(' or ')) expect(r.primarySig).toContain('INTRAMUSCULARLY OR SQ');
    else expect(r.primarySig).not.toMatch(/\bSQ\b/);
    expect(r.abnormalities.some(a => a.title === 'Unverified Injection Route')).toBe(true);
  });
  it('applies the ertapenem template only to the supported IM dose and exposes the addition', () => {
    const drug = 'Ertapenem Injection 1 GM';
    expect(translate(drug, 'Inject 1 gram IM daily').abnormalities.some(a => a.id === 'ertapenem_im_preparation')).toBe(true);
    expect(translate(drug, 'Inject 1 gram IV daily').primarySig).toBe('INJ 1GM IV QD');
    expect(translate(drug, 'Inject 0.5 gram IM daily').primarySig).toBe('INJ 0.5GM IM QD');
    const explicit = translate(drug, 'Inject 1 gram IM daily. Mix with sterile water');
    expect(explicit.primarySig).toContain('MIX WITH STERILE WATER');
    expect(explicit.primarySig).not.toContain('LIDOCAINE');
  });

  it('does not assume one vial for a different volume or concentration', () => {
    const r = translate(cases[7].drugName, '2 ml inhale orally every 6 hours via nebulizer');
    expect(r.primarySig).toBe('ADM 2ML NEB Q6H');
    expect(r.abnormalities.some(a => a.id === 'nebulizer_volume_retained')).toBe(true);
    expect(translate('Ipratropium-Albuterol Solution 1-5 MG/3ML', cases[7].rawProse).primarySig).not.toContain('1V');
    expect(translate(cases[7].drugName, '3 ml by mouth daily').primarySig).not.toContain('NEB');
  });
  it('retains all topical sites and distinguishes every shift from a particular shift', () => {
    expect(translate('Example cream', 'Apply to left hand, right foot topically each shift for rash').primarySig).toBe('AP TPCL TO LT HAND, RT FOOT QS FOR RASH');
    expect(translate('Example cream', 'Apply to left hand topically every night shift').primarySig).toBe('AP TPCL TO LT HAND QD (DURING NIGHT SHIFT)');
  });

  it('keeps patch count, indication and explicit on/off intervals', () => {
    const r = translate('Lidocaine Patch 5%', 'Apply two patches to right knee topically daily for pain Leave patch on 8 hours and then off 16 hours');
    expect(r.primarySig).toBe('APPLY 2 PATCHES TPCL TO RT KNEE QD FPAIN AND REMOVE PER SCHEDULE (8 HOURS ON, 16 HOURS OFF)');
    expect(r.primarySig).not.toContain('12ON');
    expect(r.abnormalities.some(a => a.id === 'lidocaine_explicit_cycle')).toBe(true);
  });
  it('marks the lidocaine Q12 interpretation and quantity as corrections', () => {
    const r = translate('Lidocaine Patch 4%', 'Apply to left back topically every 12 hours for pain');
    expect(r.primarySig).toBe('1PA TPCL TO LT BACK QD FPAIN AND REMOVE PER SCHEDULE 12ON');
    expect(r.abnormalities.some(a => a.id === 'lidocaine_q12_application_removal')).toBe(true);
    expect(r.abnormalities.some(a => a.id === 'lidocaine_patch_quantity')).toBe(true);
    expect(translate('Lidocaine Patch 4%', 'Apply to left back topically Q12 for pain').primarySig).toBe(r.primarySig);
  });
  it.each(['Apply to back topically twice daily for pain', 'Apply 1 patch to back daily. Remove after 8 hours', 'Apply 1 patch to back. Leave patch on 12 hours and then off 12 hours'])('retains unsupported or incomplete patch schedules: %s', prose => {
    const r = translate('Lidocaine Patch 5%', prose);
    expect(r.primarySig).not.toContain('12ON');
    expect(r.abnormalities.some(a => a.tier !== 'applied_correction')).toBe(true);
    if (prose.includes('Remove')) expect(r.primarySig).toContain('REMOVE AFTER 8 HOURS');
    if (prose.includes('Leave')) expect(r.primarySig).toContain('LEAVE PATCH ON 12 HOURS');
  });
  it('never applies the lidocaine cycle to other patches', () => {
    expect(translate('Nicotine Patch 14MG', 'Apply 1 patch to right arm topically daily').primarySig).toBe('1PA TPCL TO RT ARM QD');
  });
  it.each([['in the PM', 'QPM'], ['at bedtime', 'QHS']])('separates a single patch application/removal direction: %s', (removal, code) => {
    const r = translate('Lidocaine Patch 5%', `Apply one patch to back in the AM and remove ${removal}`);
    expect(r.primarySig).toBe(`1PA TPCL TO BACK QAM AND REMOVE ${code} PER SCHEDULE 12ON`);
  });
  it.each(['0', '8'])('retains additional or invalid removal clauses rather than dropping them: %s', hours => {
    const raw = `Apply 1 patch to back daily. Remove after ${hours} hours. Leave patch on 12 hours and then off 12 hours`;
    const r = translate('Lidocaine Patch 5%', raw);
    expect(r.primarySig).toContain(`REMOVE AFTER ${hours} HOURS`);
    expect(r.primarySig).toContain('LEAVE PATCH ON 12 HOURS');
    expect(r.primarySig).not.toContain('12ON');
  });

  it.each(['water or juice', 'juice or water'])('retains PEG liquid alternatives and the prescribed volume: %s', liquid => {
    expect(translate('Polyethylene Glycol 3350 Packet 17 GM', `Give 1 packet via PEG-Tube daily for constipation mix with 4 ounces of ${liquid}`).primarySig)
      .toBe(`MIX 17 GM (1 PACKET) IN 4OZ OF ${liquid.toUpperCase()} AND GIVE PEGT QD FCON`);
  });
  it('does not infer 17 grams for unknown packet strength, combinations, or other quantities', () => {
    for (const drug of ['Polyethylene Glycol 3350 Oral Packet', 'MiraLax Mix-In Pax Oral Packet 8 GM', 'MiraLax Mix-In Pax Oral Packet with electrolytes']) {
      expect(translate(drug, cases[10].rawProse).primarySig).not.toContain('17 GM');
    }
    expect(translate(cases[10].drugName, 'Give 2 packets by mouth daily').primarySig).not.toContain('1 PACKET');
  });
  it('preserves named sliding-scale contacts and thresholds across other dose bands', () => {
    const raw = 'Inject as per sliding scale: if 100 - 200 = 2 units; 201 - 300 = 4 units Call Dr. Sample at 202-555-0199, subcutaneously before meals and at bedtime for DMII Call Dr. Sample at 202-555-0199 with all glucose levels greater than 250.';
    const sig = translate('Insulin Aspart Injection 100UNIT/ML', raw).primarySig;
    expect(sig).toBe('CBS ACHS SS 100-200=2U;201-300=4U CALL DR. SAMPLE AT 202-555-0199 SQ FDM2. CALL DR. SAMPLE AT 202-555-0199 WITH ALL GLUCOSE LEVELS GREATER THAN 250.');
    const unsupported = raw.replace('2 units', 'half the usual dose');
    expect(translate('Insulin Aspart Injection 100UNIT/ML', unsupported).primarySig).toBe(unsupported.toUpperCase());
    const extraAction = raw.replace('greater than 250.', 'greater than 250 and give an additional 2 units.');
    expect(translate('Insulin Aspart Injection 100UNIT/ML', extraAction).primarySig).toBe(extraAction.toUpperCase());
  });
});
