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

    const expectedSplit1 = 'TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS';
    const expectedSplit2 = 'TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE PRN';
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

    expect(result.primarySig.length).toBeLessThanOrEqual(199);
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

  it('rejects instruction adverbs when extracting drug application name', () => {
    const raw = 'Cleanse sacrum with wound cleanser, pat dry, apply a thin layer topically every shift';
    const res = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(res.primarySig).toBe('TO SACRUM:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS');
    expect(res.primarySig).not.toContain('THIN LAYER');
  });

  it('does not prepend THEN when no preceding cleansing/pat-dry action is present', () => {
    const raw = 'Apply to sacrum topically every shift for wound care';
    const res = translate('Zinc Oxide Topical Paste 20 %', raw);
    expect(res.primarySig).toBe('TO SACRUM:APPLY ZINC OXIDE QS');
    expect(res.primarySig).not.toContain('THEN APPLY');
  });

  it('normalizes bilateral, left/right and conjunction AND between anatomical areas (scavenged from PR #35)', () => {
    const rawProse =
      'Apply to bil buttock and left lower back wound topically every shift and prn. Cleanse with wound cleanser, pat dry';
    const res = translate('Extra Protective Ointment', rawProse);

    const expected1 = 'TO BIL BUTTOCK/LT LOWER BACK WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY EXTRA PROTECTIVE QS';
    const expected2 = 'TO BIL BUTTOCK/LT LOWER BACK WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY EXTRA PROTECTIVE PRN';

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
