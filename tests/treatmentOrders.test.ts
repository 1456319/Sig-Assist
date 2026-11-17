import { describe, it, expect } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string) {
  return translateClinicalSig({
    id: 'test_treatment',
    pon: '12413310',
    sourceFormat: 'manual_text',
    drugName,
    rawProse
  });
}

describe('Wound care treatment orders and routine/PRN splitting', () => {
  it('correctly splits routine and PRN for reported discrepancy disc_012c5832-d452-44c7-bf5e-f3064a06542b', () => {
    const rawProse =
      'Apply to sacrum MASD wound  topically every shift for sacrum MASD wound care Cleanse the sacrum MASD with wound cleanser, pat dry, apply zinc oxide q/shift and PRN  AND  Apply to sacrum MASD wound  topically as needed for MASD wound care';
    const result = translate('Zinc Oxide Topical Paste 20 %', rawProse);

    const expectedSplit1 = 'TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS FOR SACRUM MASD WOUND CARE';
    const expectedSplit2 = 'TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE PRN FOR SACRUM MASD WOUND CARE';
    const expectedUnified = `${expectedSplit1} **SPLIT** ${expectedSplit2}`;

    expect(result.primarySig).toBe(expectedUnified);
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders[0].label).toContain('1 of 2');
    expect(result.subOrders[0].suggestedSig).toBe(expectedSplit1);
    expect(result.subOrders[1].label).toContain('2 of 2');
    expect(result.subOrders[1].suggestedSig).toBe(expectedSplit2);
    expect(result.abnormalities.some(a => a.id === 'partial_translation')).toBe(false);
  });

  it('formats routine-only treatment orders without splitting', () => {
    const raw = 'Cleanse LT hip with soap and water, pat dry, then apply zinc oxide every shift';
    const result = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(result.primarySig).toBe('TO LT HIP:CLEANSE W/SOAP AND WATER,PAT DRY,THEN APPLY ZINC OXIDE QS');
    expect(result.subOrders).toHaveLength(1);
  });

  it('formats PRN-only treatment orders without splitting', () => {
    const raw = 'Cleanse sacrum with wound cleanser, pat dry, apply zinc oxide as needed';
    const result = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE PRN');
    expect(result.subOrders).toHaveLength(1);
  });

  it('handles leave open to air (OTA) treatment orders', () => {
    const raw = 'Cleanse left thigh with soap and water, pat dry, then leave open to air every shift';
    const result = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(result.primarySig).toBe('TO LT THIGH:CLEANSE W/SOAP AND WATER,PAT DRY,THEN LEAVE OPEN TO AIR QS');
  });

  it('formats dressing and wrap orders with routine and PRN split', () => {
    const raw = 'Cleanse left buttock with wound cleanser, pat dry, apply Santyl, cover with xeroform, wrap with kerlix every shift and as needed';
    const result = translate('Collagenase Santyl Ointment', raw);

    const expectedSplit1 = 'TO LT BUTTOCK:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY SANTYL,COVER W/XEROFORM,WRAP W/KERLIX QS';
    const expectedSplit2 = 'TO LT BUTTOCK:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY SANTYL,COVER W/XEROFORM,WRAP W/KERLIX PRN';

    expect(result.primarySig).toBe(`${expectedSplit1} **SPLIT** ${expectedSplit2}`);
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders[0].suggestedSig).toBe(expectedSplit1);
    expect(result.subOrders[1].suggestedSig).toBe(expectedSplit2);
  });

  it('handles supply/dressing orders without redundant medication application', () => {
    const raw = 'Cleanse sacrum with normal saline, pat dry, cover with xeroform daily';
    const result = translate('Xeroform Petrolatum Gauze 5x9', raw);

    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE,PAT DRY,COVER W/XEROFORM QD');
    expect(result.subOrders).toHaveLength(1);
  });

  it('handles alternative routine frequencies such as every 3 days and every other day', () => {
    const rawQ3d = 'Cleanse coccyx with wound cleanser, pat dry, cover with gauze every 3 days';
    const resQ3d = translate('Gauze Pads 4x4', rawQ3d);
    expect(resQ3d.primarySig).toBe('TO COCCYX:CLEANSE W/WOUND CLEANSER,PAT DRY,COVER W/GAUZE Q3D');

    const rawQod = 'Cleanse right heel with soap and water, pat dry, then apply zinc oxide every other day';
    const resQod = translate('Zinc Oxide Topical Paste 20 %', rawQod);
    expect(resQod.primarySig).toBe('TO RT HEEL:CLEANSE W/SOAP AND WATER,PAT DRY,THEN APPLY ZINC OXIDE QOD');
  });

  it('progressively condenses treatment orders exceeding 199 characters', () => {
    // Generate a long site description to push uncondensed length over 199 even after slash normalization
    const longSite =
      'POSTERIOR SACRAL PRESSURE INJURY AND EXTENSIVE PERIANAL EXCORIATION WITH ADJACENT GLUTEAL CLEFTS AND SURROUNDING PERIWOUND ERYTHEMA AND INDURATION WITH DEEP TISSUE INVOLVEMENT';
    const raw = `Apply to ${longSite} topically every shift Cleanse with soap and water, pat dry, then leave open to air`;
    const result = translate('Zinc Oxide Topical Paste 20 %', raw);

    expect(result.primarySig.length).toBeGreaterThan(199);
    expect(result.abnormalities.some(a => a.id === 'treatment_order_length_exceeded')).toBe(true);
    expect(result.primarySig).toContain('APPLY ZINC OXIDE');
    expect(result.primarySig).toContain('DEEP TISSUE INVOLVEMENT');
    expect(result.primarySig).toContain('SOAP&WATER');
    expect(result.primarySig).toContain('LEAVE OTA');
  });

  it('correctly maps multi-dose frequencies (BID, TID, QID) without collapsing to QD', () => {
    const rawBid = 'Cleanse sacrum with wound cleanser, pat dry, apply zinc oxide twice daily';
    const resBid = translate('Zinc Oxide Topical Paste 20 %', rawBid);
    expect(resBid.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE BID');

    const rawTid = 'Cleanse sacrum with wound cleanser, pat dry, apply zinc oxide 3 times a day';
    const resTid = translate('Zinc Oxide Topical Paste 20 %', rawTid);
    expect(resTid.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE TID');

    const rawQid = 'Cleanse sacrum with wound cleanser, pat dry, apply zinc oxide four times daily';
    const resQid = translate('Zinc Oxide Topical Paste 20 %', rawQid);
    expect(resQid.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QID');
  });

  it('does NOT hijack oral systemic medications prescribed for wound care', () => {
    const rawOral = 'Take 1 capsule by mouth daily for wound care';
    const resOral = translate('Cephalexin 500 mg Capsule', rawOral);
    expect(resOral.primarySig).not.toContain('THEN APPLY');
    expect(resOral.primarySig).toContain('PO');
  });

  it('cleans decimal percentage strengths without leaving dangling decimal points', () => {
    const raw = 'Cleanse left hip with soap and water, pat dry, apply hydrocortisone every shift';
    const res = translate('Hydrocortisone 2.5% Cream', raw);
    expect(res.primarySig).toBe('TO LT HIP:CLEANSE W/SOAP AND WATER,PAT DRY,THEN APPLY HYDROCORTISONE QS');
    expect(res.primarySig).not.toContain('2.');
  });

  it('preserves source application thickness instead of discarding it for the product name', () => {
    const raw = 'Cleanse sacrum with wound cleanser, pat dry, apply a thin layer topically every shift';
    const res = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(res.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY A THIN LAYER TPCL QS');
    expect(res.primarySig).toContain('THIN LAYER');
  });

  it('does not prepend THEN when no preceding cleansing/pat-dry action is present', () => {
    const raw = 'Apply to sacrum topically every shift for wound care';
    const res = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(res.primarySig).toBe('TO SACRUM:APPLY ZINC OXIDE QS FOR WOUND CARE');
    expect(res.primarySig).not.toContain('THEN APPLY');
  });

  it('normalizes bilateral, left/right and conjunction AND between anatomical areas (scavenged from PR #35)', () => {
    const rawProse =
      'Apply to bil buttock and left lower back wound topically every shift and prn. Cleanse with wound cleanser, pat dry';
    const res = translate('Extra Protective Ointment', rawProse);

    const expected1 = 'TO BIL BUTTOCK/LT LOWER BACK WOUND:APPLY EXTRA PROTECTIVE,CLEANSE W/WOUND CLEANSER,PAT DRY QS';
    const expected2 = 'TO BIL BUTTOCK/LT LOWER BACK WOUND:APPLY EXTRA PROTECTIVE,CLEANSE W/WOUND CLEANSER,PAT DRY PRN';

    expect(res.primarySig).toBe(`${expected1} **SPLIT** ${expected2}`);
    expect(res.subOrders).toHaveLength(2);
    expect(res.subOrders[0].suggestedSig).toBe(expected1);
    expect(res.subOrders[1].suggestedSig).toBe(expected2);
  });

  it('handles "cleanse wound on <site>" and Vashe wound cleanser (scavenged from PR #35)', () => {
    const rawNs = 'Cleanse wound on right forearm with normal saline, pat dry, apply ointment twice daily';
    const resNs = translate('Triple Antibiotic Ointment', rawNs);
    expect(resNs.primarySig).toBe('TO RT FOREARM:CLEANSE W/NORMAL SALINE,PAT DRY,THEN APPLY TRIPLE ANTIBIOTIC BID');

    const rawVashe = 'Cleanse sacrum with Vashe, pat dry, apply zinc oxide every shift';
    const resVashe = translate('Zinc Oxide Topical Paste 20 %', rawVashe);
    expect(resVashe.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS');
  });
});


describe('Treatment source instruction retention', () => {
  it('never invents an interval or a product application for a cleansing-only order', () => {
    const result = translate('Zinc Oxide Topical Paste 20 %', 'Cleanse sacrum with normal saline, pat dry');
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE,PAT DRY');
    expect(result.primarySig).not.toMatch(/\b(?:QS|QD|APPLY)\b/);
    expect(result.abnormalities.some(a => a.id === 'treatment_frequency_missing')).toBe(true);
  });

  it('retains course duration and follow-up beside the translated procedure', () => {
    const result = translate('Zinc Oxide Topical Paste 20 %', 'Cleanse sacrum with normal saline, pat dry, apply zinc oxide daily for 14 days. Notify provider if redness worsens.');
    expect(result.primarySig).toContain('THEN APPLY ZINC OXIDE QD X14D');
    expect(result.primarySig).toContain('NOTIFY PROVIDER IF REDNESS WORSENS');
    expect(result.primarySig.indexOf('X14D')).toBeLessThan(result.primarySig.indexOf('NOTIFY'));
  });

  it('retains weekday routine and PRN soiling reason in their respective orders', () => {
    const result = translate('Foam Dressing', 'Wound dressing: Cleanse left heel with normal saline, pat dry, apply skin prep to periwound, cover with foam dressing every Monday Wednesday and Friday and as needed for soiling.');
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders[0].suggestedSig).toContain('QDDAY135');
    expect(result.subOrders[0].suggestedSig).not.toContain('PRN');
    expect(result.subOrders[1].suggestedSig).toContain('PRN FOR SOILING');
    for (const order of result.subOrders) expect(order.suggestedSig).toContain('APPLY SKIN PREP TO PERIWOUND,COVER W/FOAM DRESSING');
  });

  it('keeps source action order and repeated dressing/application actions', () => {
    const result = translate('Zinc Oxide Topical Paste', 'Cleanse sacrum with normal saline, apply skin prep, cover with gauze, apply tape daily');
    expect(result.primarySig).toContain('THEN APPLY SKIN PREP,COVER W/GAUZE,APPLY TAPE QD');
  });

  it('retains unknown procedural text with a finding and useful translated text', () => {
    const result = translate('Zinc Oxide Topical Paste', 'Cleanse sacrum with normal saline, pat dry, massage surrounding tissue gently, cover with foam daily');
    expect(result.primarySig).toContain('CLEANSE W/NORMAL SALINE');
    expect(result.primarySig).toContain('MASSAGE SURROUNDING TISSUE GENTLY');
    expect(result.primarySig).toContain('COVER W/FOAM QD');
    expect(result.abnormalities.some(a => a.id === 'treatment_untranslated_clause' && a.trigger?.includes('MASSAGE'))).toBe(true);
  });

  it('keeps a frequency attached to each action when schedules differ', () => {
    const result = translate('Foam Dressing', 'Cleanse sacrum with normal saline daily, cover with foam every 3 days');
    expect(result.primarySig).toContain('CLEANSE W/NORMAL SALINE QD');
    expect(result.primarySig).toContain('COVER W/FOAM Q3D');
  });

  it('does not split a constrained BID PRN application into an invented routine order', () => {
    const result = translate('Zinc Oxide Topical Paste', 'Cleanse sacrum with normal saline, pat dry, apply zinc oxide twice daily as needed for redness or moisture');
    expect(result.subOrders).toHaveLength(1);
    expect(result.primarySig).toContain('BID PRN FOR REDNESS OR MOISTURE');
  });

  it('retains a non-code qualifier following a recognized weekday schedule', () => {
    const result = translate('Zinc Oxide Topical Paste', 'Cleanse sacrum with normal saline, apply zinc oxide every Monday and Thursday after bath');
    expect(result.primarySig).toContain('QDDAY14 AFTER BATH');
    expect(result.abnormalities.some(a => a.id === 'treatment_untranslated_clause' && a.trigger === 'AFTER BATH')).toBe(true);
  });

  it('preserves application thickness and local wound-bed site beside the course', () => {
    const result = translate('Santyl 250 UNIT/GM Ointment', 'Cleanse left heel with wound cleanser, apply nickel-thick layer to wound bed, cover with dry gauze daily for 14 days. Notify MD if signs of infection');
    expect(result.primarySig).toContain('APPLY NICKEL-THICK LAYER TO WOUND BED');
    expect(result.primarySig).toContain('COVER W/DRY GAUZE QD X14D');
    expect(result.primarySig).toContain('NOTIFY MD IF SIGNS OF INFECTION');
  });

  it('retains both sites without turning the second procedure into the first site', () => {
    const result = translate('Foam Dressing', 'Cleanse left heel with normal saline daily; cleanse right ankle with wound cleanser every 3 days');
    expect(result.primarySig).toContain('TO LT HEEL:CLEANSE W/NORMAL SALINE QD');
    expect(result.primarySig).toContain('TO RT ANKLE:CLEANSE W/WOUND CLEANSER Q3D');
  });

  it('keeps recheck timing and notify condition out of treatment-frequency inference', () => {
    const result = translate('Foam Dressing', 'Cleanse sacrum with normal saline, cover with foam daily. Recheck wound in 2 hours and notify MD if drainage increases');
    expect(result.primarySig).toContain('COVER W/FOAM QD');
    expect(result.primarySig).toContain('RECHECK WOUND IN 2 HOURS');
    expect(result.primarySig).toContain('NOTIFY MD IF DRAINAGE INCREASES');
    expect(result.primarySig).not.toContain('Q2H');
  });
});
