import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const drug = 'Synthetic tablet';
const clinical = (rawProse: string) => translateClinicalSig({ id: 'synthetic-repeated-route', pon: 'SYNTHETIC', drugName: drug, rawProse, sourceFormat: 'manual_text' });

describe('differing oral doses with a repeated route', () => {
  it.each([
    'Take 2 tablets by mouth in the morning and 1 tablet by mouth at bedtime for 5 days',
    'Take 2 tablets PO every morning and take 1 tablet PO at bedtime for 5 days',
    'Give 2 tablets orally in the morning and give 1 tablet orally in the evening for 5 days',
  ])('preserves each dose and its own schedule: %s', raw => {
    const result = clinical(raw);
    expect(result.subOrders.map(part => part.suggestedSig)).toEqual(['2T PO QAM X5D', '1T PO QHS X5D']);
    expect(result.primarySig).toBe('2T PO QAM AND 1T PO QHS X5D');
  });

  it('keeps both source doses in the classic path rather than assigning the first dose to bedtime', () => {
    const raw = 'Take 2 tablets by mouth in the morning and 1 tablet by mouth at bedtime for 5 days';
    const result = translateFreeTextSig(raw, { drug });
    expect(result.sig).toBe(raw.toUpperCase());
    expect(result.order.issues.some(issue => issue.code === 'multiple-dose-schedules')).toBe(true);
  });

  it('retains existing split behavior when the second route is omitted', () => {
    expect(clinical('Take 2 tablets in the morning and 1 tablet at bedtime for 5 days').subOrders.map(part => part.suggestedSig))
      .toEqual(['2T PO QAM X5D', '1T PO QHS X5D']);
  });

  it('does not split an equal morning and bedtime dose', () => {
    const result = clinical('Take 1 tablet by mouth in the morning and 1 tablet by mouth at bedtime');
    expect(result.subOrders).toHaveLength(1);
    expect(result.primarySig).toBe('1T PO BIDAMHS');
  });
});
