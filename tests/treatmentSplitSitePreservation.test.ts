import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(extra: string) {
  return translateClinicalSig({
    id: 'synthetic-treatment-sites', pon: 'SYNTHETIC', sourceFormat: 'manual_text',
    drugName: 'Zinc oxide cream',
    rawProse: `Cleanse left heel with saline, pat dry, apply cream daily and as needed AND ${extra}`,
  });
}

describe('additional treatment clauses', () => {
  it.each([
    'Apply to right elbow as needed for itching.',
    'Apply to right heel as needed for itching.',
    'Apply to left heel twice daily as needed for itching.',
    'Apply to left heel as needed for itching for 7 days.',
    'Apply to right elbow as needed, cover with dry dressing.',
  ])('preserves a distinct clause on its own card and in combined output: %s', extra => {
    const result = translate(extra);
    expect(result.subOrders).toHaveLength(3);
    expect(result.subOrders[1].suggestedSig).not.toContain('ITCHING');
    expect(result.subOrders[2].suggestedSig).toBe(extra.toUpperCase());
    expect(result.subOrders.map(part => part.label)).toEqual([
      'Order 1 of 3 (Routine)', 'Order 2 of 3 (PRN)', 'Order 3 of 3 (PRN)',
    ]);
    expect(result.primarySig).toBe(result.subOrders.map(part => part.suggestedSig).join(' **SPLIT** '));
    expect(result.subOrders[2].abnormalities.some(finding => finding.tier === 'uncorrected_gap')).toBe(true);
    expect(result.abnormalities.find(finding => finding.id.startsWith('treatment_order_split_'))?.correction).toContain('Split 3:');
  });

  it('collapses a duplicate site and adds its reason to the existing PRN card', () => {
    const result = translate('Apply to left heel as needed for itching.');
    expect(result.subOrders).toHaveLength(2);
    expect(result.subOrders[1].suggestedSig).toBe('TO LT HEEL:CLEANSE W/SALINE,PAT DRY,THEN APPLY ZINC OXIDE PRN FOR ITCHING');
  });

  it('preserves every additional site when there are several explicit clauses', () => {
    const result = translate('Apply to right elbow as needed for itching AND Apply to right ankle as needed for redness.');
    expect(result.subOrders).toHaveLength(4);
    expect(result.primarySig).toContain('RIGHT ELBOW');
    expect(result.primarySig).toContain('RIGHT ANKLE');
    expect(result.subOrders[3].label).toBe('Order 4 of 4 (PRN)');
  });
});
