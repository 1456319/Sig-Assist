import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(rawProse: string) {
  return translateClinicalSig({
    id: 'synthetic-final-treatment-sequence', pon: 'SYNTHETIC', sourceFormat: 'manual_text',
    drugName: 'ZINC OXIDE 20% PASTE', rawProse,
  });
}

describe('Final treatment audit: preserve temporal schedule scope', () => {
  it('retains the audit course in order instead of merging BID and QD', () => {
    const result = translate('Cleanse sacrum with normal saline, pat dry, apply zinc oxide twice daily for 7 days then daily.');
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE,PAT DRY,THEN APPLY ZINC OXIDE TWICE DAILY FOR 7 DAYS THEN DAILY');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
    expect(result.abnormalities.some(a => a.id === 'treatment_frequency_missing')).toBe(false);
    expect(result.abnormalities.some(a => a.id === 'treatment_untranslated_clause' && a.trigger === 'THEN')).toBe(false);
    expect(result.subOrders).toHaveLength(1);
  });

  it('keeps repeated phase durations, PRN reasons and follow-up in source order', () => {
    const result = translate('Cleanse sacrum with normal saline, apply zinc oxide twice daily as needed for redness for 7 days then daily as needed for moisture for up to 14 days. Notify MD if redness worsens.');
    expect(result.primarySig).toContain('APPLY ZINC OXIDE TWICE DAILY AS NEEDED FOR REDNESS FOR 7 DAYS THEN DAILY AS NEEDED FOR MOISTURE FOR UP TO 14 DAYS');
    expect(result.primarySig).toContain(',NOTIFY MD IF REDNESS WORSENS');
    expect(result.subOrders).toHaveLength(1);
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
  });

  it.each([
    'daily for 7 days then as needed for redness',
    'as needed for redness for 7 days then daily',
    'BID X7D then QD X3D then PRN for moisture',
    'every Monday and Thursday for 2 weeks then weekly until healed',
  ])('retains schedule transitions including PRN: %s', schedule => {
    const result = translate(`Cleanse sacrum with normal saline, apply zinc oxide ${schedule}.`);
    expect(result.primarySig).toContain(`APPLY ZINC OXIDE ${schedule.toUpperCase()}`);
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
    expect(result.abnormalities.some(a => a.id === 'treatment_frequency_missing')).toBe(false);
    expect(result.subOrders).toHaveLength(1);
  });

  it('keeps a sequential cleansing schedule and later qualifiers beside their own actions', () => {
    const result = translate('Cleanse sacrum with normal saline twice daily for 7 days then daily after bath, pat dry, apply zinc oxide as needed for redness.');
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE TWICE DAILY FOR 7 DAYS THEN DAILY AFTER BATH,PAT DRY,THEN APPLY ZINC OXIDE PRN FOR REDNESS');
    expect(result.subOrders).toHaveLength(1);
  });

  it('keeps ONCE with the initial schedule instead of interpreting it as part of the site', () => {
    const result = translate('Apply to sacrum once daily for 7 days then twice daily.');
    expect(result.primarySig).toBe('TO SACRUM:APPLY ZINC OXIDE ONCE DAILY FOR 7 DAYS THEN TWICE DAILY');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
  });

  it.each(['one time a day', '1 time per day', 'one time each day', 'once daily'])(
    'separates the stated daily schedule from the wound site: %s', schedule => {
      const result = translate(`Apply to right elbow wound topically ${schedule} for redness.`);
      expect(result.primarySig).toBe('TO RT ELBOW WOUND:APPLY ZINC OXIDE QD FOR REDNESS');
      expect(result.abnormalities.some(a => a.id === 'treatment_frequency_missing')).toBe(false);
    },
  );

  it.each([
    ['one time a day on Tuesday and Saturday', 'QDDAY26'],
    ['one time a day in the morning', 'QAM'],
    ['once daily every 3 days', 'QDQ3D'],
  ])('keeps the qualifier attached in %s', (schedule, expected) => {
    const result = translate(`Cleanse the left knee with saline ${schedule}.`);
    expect(result.primarySig).toBe(`TO LT KNEE:CLEANSE W/SALINE ${expected}`);
  });

  it('retains a daily-to-PRN transition in the source order', () => {
    const result = translate('Apply to right elbow wound one time a day for 3 days then as needed for redness.');
    expect(result.primarySig).toBe('TO RT ELBOW WOUND:APPLY ZINC OXIDE ONE TIME A DAY FOR 3 DAYS THEN AS NEEDED FOR REDNESS');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(true);
  });

  it('does not turn a one-time procedure into a daily treatment', () => {
    const result = translate('Cleanse left elbow with saline one time only.');
    expect(result.primarySig).toContain('ONE TIME ONLY');
    expect(result.primarySig).not.toMatch(/\bQD\b/);
  });

  it('still flags an unknown procedural clause before a retained schedule', () => {
    const result = translate('Cleanse sacrum with normal saline, blot carefully twice daily for 7 days then daily.');
    expect(result.primarySig).toContain('CLEANSE W/NORMAL SALINE, BLOT CAREFULLY TWICE DAILY FOR 7 DAYS THEN DAILY');
    expect(result.abnormalities.some(a => a.id === 'treatment_untranslated_clause' && a.trigger === 'BLOT CAREFULLY')).toBe(true);
  });

  it('does not split an AND PRN phase out of a sequential course', () => {
    const result = translate('Cleanse sacrum with normal saline, apply zinc oxide daily for 7 days then twice daily and as needed for moisture.');
    expect(result.primarySig).toContain('APPLY ZINC OXIDE DAILY FOR 7 DAYS THEN TWICE DAILY AND AS NEEDED FOR MOISTURE');
    expect(result.subOrders).toHaveLength(1);
  });

  it('distinguishes THEN action connectors from a change in schedule', () => {
    const result = translate('Cleanse sacrum with normal saline daily for 7 days then apply zinc oxide twice daily for 14 days.');
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE QD X7D,THEN APPLY ZINC OXIDE BID X14D');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(false);
  });

  it('keeps a negative action intact without promoting its schedule to a course phase', () => {
    const result = translate('Cleanse sacrum with normal saline daily for 7 days then do not apply zinc oxide daily.');
    expect(result.primarySig).toBe('TO SACRUM:CLEANSE W/NORMAL SALINE QD X7D,DO NOT APPLY ZINC OXIDE DAILY');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(false);
  });

  it('does not mistake a follow-up duration for a second treatment schedule', () => {
    const result = translate('Cleanse sacrum with normal saline, apply zinc oxide daily for 14 days then reassess.');
    expect(result.primarySig).toContain('APPLY ZINC OXIDE QD X14D THEN REASSESS');
    expect(result.abnormalities.some(a => a.id === 'treatment_sequential_schedule')).toBe(false);
  });
});
