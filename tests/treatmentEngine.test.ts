import { describe, it, expect } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { isTreatmentOrder, normalizeApplicationArea } from '../src/lib/clinical/treatmentEngine';

describe('Treatment Order Engine and Discrepancy Case Fixes', () => {
  it('correctly normalizes anatomical application areas', () => {
    expect(normalizeApplicationArea('sacrum MASD wound')).toBe('SACRUM MASD WOUND');
    expect(normalizeApplicationArea('bil buttock and left lower back wound')).toBe('BIL BUTTOCK/LT LOWER BACK WOUND');
    expect(normalizeApplicationArea('b/l lower extremity and right forearm')).toBe('BIL LOWER EXTREMITY/RT FOREARM');
    expect(normalizeApplicationArea('left hip and left thigh')).toBe('LT HIP/LT THIGH');
  });

  it('detects treatment orders from wound care and cleansing keywords', () => {
    expect(isTreatmentOrder('Zinc Oxide Topical Paste 20 %', 'Cleanse sacrum with wound cleanser, pat dry, apply zinc oxide')).toBe(true);
    expect(isTreatmentOrder('Unknown', 'Cleanse lt hip and left thigh with soap and water, pat dry, then leave OTA')).toBe(true);
    expect(isTreatmentOrder('Normal Saline', 'Cleanse wound with normal saline and cover with dressing')).toBe(true);
    // Non-treatment order should not match
    expect(isTreatmentOrder('Metformin TAB 500MG', 'Take 1 tablet by mouth twice daily with meals')).toBe(false);
  });

  it('resolves reported discrepancy disc_012c5832-d452-44c7-bf5e-f3064a06542b exactly matching technicianSig', () => {
    const rawProse = 'Apply to sacrum MASD wound  topically every shift for sacrum MASD wound care Cleanse the sacrum MASD with wound cleanser, pat dry, apply zinc oxide q/shift and PRN  AND  Apply to sacrum MASD wound  topically as needed for MASD wound care';
    const drugName = 'Zinc Oxide Topical Paste 20 %';

    const result = translateClinicalSig({
      id: 'disc_012c5832-d452-44c7-bf5e-f3064a06542b',
      pon: '12413310',
      drugName,
      rawProse,
      sourceFormat: 'manual_text'
    });

    const expectedTechnicianSig = 'TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS **SPLIT** TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE PRN';

    expect(result.primarySig).toBe(expectedTechnicianSig);
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders[0].label).toBe('Order 1 of 2');
    expect(result.subOrders[0].suggestedSig).toBe('TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE QS');
    expect(result.subOrders[1].label).toBe('Order 2 of 2');
    expect(result.subOrders[1].suggestedSig).toBe('TO SACRUM MASD WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY ZINC OXIDE PRN');

    // Both sub-orders and primarySig must not exceed the 199 character limit
    expect(result.subOrders[0].suggestedSig.length).toBeLessThanOrEqual(199);
    expect(result.subOrders[1].suggestedSig.length).toBeLessThanOrEqual(199);
  });

  it('handles treatment order with soap and water and leave OTA', () => {
    const rawProse = 'CLEANSE LT HIP AND LEFT THIGH WITH SOAP AND WATER, PAT DRY, THEN LEAVE OTA';
    const drugName = 'Treatment Order';

    const result = translateClinicalSig({
      id: 'test_treatment_ota',
      pon: '12413311',
      drugName,
      rawProse,
      sourceFormat: 'manual_text'
    });

    expect(result.primarySig).toBe('TO LT HIP/LT THIGH:CLEANSE W/SOAP AND WATER,PAT DRY,THEN LEAVE OPEN TO AIR');
    expect(result.subOrders).toHaveLength(1);
    expect(result.primarySig.length).toBeLessThanOrEqual(199);
  });

  it('correctly handles variations in freetyped nurse instructions', () => {
    // Normal saline cleansing and BID frequency
    const res1 = translateClinicalSig({
      id: 'test_treatment_ns',
      pon: '12413312',
      drugName: 'Triple Antibiotic Ointment',
      rawProse: 'Cleanse wound on right forearm with normal saline, pat dry, apply ointment twice daily',
      sourceFormat: 'manual_text'
    });
    expect(res1.primarySig).toBe('TO RT FOREARM:CLEANSE W/NORMAL SALINE,PAT DRY,THEN APPLY TRIPLE ANTIBIOTIC BID');
    expect(res1.subOrders).toHaveLength(1);

    // Routine + PRN with bilateral site
    const res2 = translateClinicalSig({
      id: 'test_treatment_bil',
      pon: '12413313',
      drugName: 'Extra Protective Ointment',
      rawProse: 'Apply to bil buttock and left lower back wound topically every shift and prn. Cleanse with wound cleanser, pat dry',
      sourceFormat: 'manual_text'
    });
    expect(res2.subOrders).toHaveLength(2);
    expect(res2.subOrders[0].suggestedSig).toBe('TO BIL BUTTOCK/LT LOWER BACK WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY EXTRA PROTECTIVE QS');
    expect(res2.subOrders[1].suggestedSig).toBe('TO BIL BUTTOCK/LT LOWER BACK WOUND:CLEANSE W/WOUND CLEANSER,PAT DRY,THEN APPLY EXTRA PROTECTIVE PRN');
  });

  it('progressively condenses long treatment orders so that each sub-order remains strictly <= 199 characters', () => {
    const lengthySite = 'BILATERAL LOWER EXTREMITIES AND RIGHT UPPER EXTREMITY AND LEFT FOREARM SACRAL AREA';
    const lengthyProse = `Cleanse ${lengthySite} with soap and water, pat dry, then apply moisture barrier ointment every shift and as needed for extensive stage 3 pressure ulcer wound care and redness`;
    const res = translateClinicalSig({
      id: 'test_lengthy_condensing',
      pon: '12413314',
      drugName: 'Moisture Barrier Ointment',
      rawProse: lengthyProse,
      sourceFormat: 'manual_text'
    });

    for (const sub of res.subOrders) {
      expect(sub.suggestedSig.length).toBeLessThanOrEqual(199);
    }
  });
});
