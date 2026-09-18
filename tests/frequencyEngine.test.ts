import { describe, expect, it } from 'vitest';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';

describe('frequencyEngine', () => {
  it('resolves standard QD variations and meal relationships', () => {
    const res1 = resolveFrequencyAndSchedule('Give 1 tablet by mouth one time a day for GERD');
    expect(res1.frequencyToken).toBe('QD');
    expect(res1.indicationToken).toBe('FGERD');

    const res2 = resolveFrequencyAndSchedule('Give 0.5 tablet by mouth one time a day for Hypothyroidism Before breakfast');
    expect(res2.frequencyToken).toBe('QDA/B');
    expect(res2.indicationToken).toBe('FHYT');

    const res3 = resolveFrequencyAndSchedule('Give 1 capsule by mouth in the evening for BPH after dinner');
    expect(res3.frequencyToken).toBe('QDP/D IN THE EVENING');
    expect(res3.indicationToken).toBe('FBPH');
  });

  it('orders duration before indication for scheduled orders', () => {
    const res = resolveFrequencyAndSchedule('Give 1 tablet by mouth every 12 hours for cough for 7 Days');
    expect(res.frequencyToken).toBe('Q12H');
    expect(res.durationToken).toBe('X7D');
    expect(res.indicationToken).toBe('FCOU');
    expect(res.prnToken).toBeUndefined();
  });

  it('orders indication before duration for PRN orders', () => {
    const res = resolveFrequencyAndSchedule('Give 1 tablet by mouth every 12 hours as needed for cough for 7 Days');
    expect(res.frequencyToken).toBe('Q12H');
    expect(res.prnToken).toBe('PRN');
    expect(res.indicationToken).toBe('FCOU');
    expect(res.durationToken).toBe('X7D');
  });

  it('resolves sliding scale insulin with ascending numerical sort and units normalization', () => {
    const prose = 'Inject as per sliding scale: if 181 - 200 = 1 unit < 70 follow hypoglycemic protocol; 201 - 250 = 2 unit; 251 - 300 = 3 units; 301 - 350 = 4 units > 350 = 5 units, subcutaneously before meals for DM';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.slidingScaleString).toBe('CBS AC SS <70=HYPOGLYCEMIC PROTOCOL;181-200=1U;201-250=2U;251-300=3U;301-350=4U;>350=5U');
  });

  it('corrects sliding scale ml to U with an Applied Correction notice', () => {
    const prose = 'Inject as per sliding scale: if 200 - 300 = 5ml; 301 - 400 = 10ml; 401 - 500 = 15ml Greater than 500 or less than 79 notify MD, subcutaneously before meals and at bedtime for DM2';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.slidingScaleString).toBe('CBS ACHS SS <79=CALL MD;200-300=5U;301-400=10U;401-500=15U;>500=CALL MD');
    expect(res.abnormalities.some(a => a.tier === 'applied_correction')).toBe(true);
  });

  it('merges default templates for packet reconstitutions', () => {
    const template = 'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO';
    const prose = 'Give 1 packet by mouth one time a day for Constipation';
    const res = resolveFrequencyAndSchedule(prose, template);
    expect(res.blendedTemplate).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('extracts clinical hold parameters', () => {
    const prose = 'Give 1 tablet by mouth one time a day for HTN HOLD FOR SBP LESS THAN 100 OR HEART RATE LESS THAN 60';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.holdToken).toBe('HR60SBP100');
  });

  it('does not falsely trigger BID from words containing bid, like morbid', () => {
    const res = resolveFrequencyAndSchedule('Give 1 tablet by mouth one time a day for morbid obesity');
    expect(res.frequencyToken).toBe('QD');
  });

  it('does not falsely trigger ACHS from words containing hs, like months', () => {
    const prose = 'Inject as per sliding scale for 3 months: if 181 - 200 = 1 unit < 70 follow hypoglycemic protocol; 201 - 250 = 2 unit; 251 - 300 = 3 units; 301 - 350 = 4 units > 350 = 5 units, subcutaneously before meals for DM';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.frequencyToken).toBe('CBS AC SS');
    expect(res.slidingScaleString).toMatch(/^CBS AC SS /);
  });
});

