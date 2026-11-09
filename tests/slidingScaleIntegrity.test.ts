import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { parseSigOrder, renderSig } from '../src/lib/sigEngine';

const drugName = 'Insulin Lispro Injection 100 UNIT/ML';
function translate(rawProse: string) {
  return translateClinicalSig({ id: 'scale-test', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse });
}
const schedules = [
  ['before meals', 'AC'], ['before meals and at bedtime', 'ACHS'], ['at bedtime', 'QHS'],
  ['three times a day', 'TID'], ['four times a day', 'QID'], ['every 6 hours', 'Q6H'],
];
const thresholds = ['>=350', '> or = 350', '≥ 350', 'greater than or equal to 350', 'greater than or equals 350', '350+'];
const variants = thresholds.flatMap(threshold => schedules.flatMap(([schedule, code]) => ['-', '–', ' to '].map(dash => ({ threshold, schedule, code, dash }))));

describe('sliding-scale completeness and grammar', () => {
  it.each(variants)('retains final $threshold band with $schedule and $dash ranges', ({ threshold, schedule, code, dash }) => {
    const raw = `Inject as per sliding scale: if 150${dash}199 = 1 unit;\n200${dash}249 = 2 units; 250${dash}299 = 3 units; 300${dash}349 = 4 units; ${threshold} give 5 units, subcutaneously ${schedule} for DM`;
    const expected = `CBS ${code} SS 150-199=1U;200-249=2U;250-299=3U;300-349=4U;350+=5U SQ FDM`;
    expect(translate(raw).primarySig).toBe(expected);
    expect(renderSig(parseSigOrder(raw, { drug: drugName }))).toBe(expected);
  });

  it.each([
    'Notify MD if BS >400 or BS <60',
    'BS >400 or BS <60 notify MD',
    'Call MD for blood glucose >400 or blood glucose <60',
  ])('preserves both conditions in a shared notification: %s', notice => {
    const raw = `Inject as per sliding scale: 0-200=0 units;201-400=2 units; ${notice}, subcutaneously before meals for DM`;
    expect(translate(raw).primarySig).toBe('CBS AC SS <60=CALL MD;0-200=0U;201-400=2U;>400=CALL MD SQ FDM');
  });

  it.each(['<=70', '≤70', 'less than or equal to 70'])('preserves an inclusive low threshold: %s', low => {
    const raw = `Inject as per sliding scale: ${low} follow hypoglycemic protocol and call MD;71-150=0 units;>150=2 units, SQ at bedtime for DM`;
    expect(translate(raw).primarySig).toBe('CBS QHS SS <=70=HYPOGLYCEMIC PROTOCOL&CALL MD;71-150=0U;>150=2U SQ FDM');
  });

  it('merges duplicate same-dose conditions without discarding an added notification', () => {
    const raw = 'Inject as per sliding scale: 0-199=0 units;200+=2 units;200+=2 units and call NP/PA, SQ TID for DM';
    expect(translate(raw).primarySig).toBe('CBS TID SS 0-199=0U;200+=2U&CALL NP/PA SQ FDM');
  });

  it('makes omitted units explicit and reports normalization of unit typos', () => {
    const r = translate('Inject as per sliding-scale: 0-199=0;200-299=2 unites;300+=4 unis, SQ QID for diabetes');
    expect(r.primarySig).toBe('CBS QID SS 0-199=0U;200-299=2U;300+=4U SQ FDM');
    expect(r.abnormalities.map(a => a.id)).toEqual(expect.arrayContaining(['sliding_scale_implied_units', 'insulin_unit_typo']));
  });

  it.each([
    '0-199=0 units;200+=2 ml',
    '0-199=0 units;200+=2 mg',
    '0-199=0 units;200+=an unspecified dose',
    '0-199=0 units;200+=^ units',
    '0-199=0 units;200+=2 units call supervisor',
    '0-199=0 units;200+=2 units;200+=4 units',
    '199-100=2 units;200+=4 units',
  ])('retains the entire source when a band is unresolved: %s', bands => {
    const raw = `Inject as per sliding scale: ${bands}, SQ before meals for DM`;
    const r = translate(raw);
    expect(r.primarySig).toBe(raw.toUpperCase());
    expect(r.abnormalities.some(a => a.id === 'incomplete_sliding_scale')).toBe(true);
    expect(renderSig(parseSigOrder(raw, { drug: drugName }))).toBe(r.primarySig);
  });

  it.each([
    'Inject 5 units plus sliding scale: 0-199=0 units;200+=2 units, SQ TID',
    'Inject as per sliding scale: 0-199=0 units, SQ TID;200+=2 units',
  ])('retains a fixed dose or a late band instead of silently dropping it', raw => {
    expect(translate(raw).primarySig).toBe(raw.toUpperCase());
  });

  it.each([
    ['0-199=0 units;201+=2 units', 'sliding_scale_gap', '0-199=0U;201+=2U'],
    ['0-199=0 units;199+=2 units', 'sliding_scale_overlap', '0-199=0U;199+=2U'],
  ])('flags %s without rewriting boundaries', (bands, finding, expected) => {
    const r = translate(`Inject as per sliding scale: ${bands}, SQ TID for DM`);
    expect(r.primarySig).toBe(`CBS TID SS ${expected} SQ FDM`);
    expect(r.abnormalities.some(a => a.id === finding)).toBe(true);
  });

  it('preserves device instructions after the schedule', () => {
    const r = translate('Inject as per sliding scale: 0-199=0 units;200+=2 units, SQ TID for DM. Do not use Dexcom, use glucose meter');
    expect(r.primarySig).toBe('CBS TID SS 0-199=0U;200+=2U SQ FDM. DO NOT USE DEXCOM, USE GLUCOSE METER');
  });

  it('never truncates a long scale to fit the destination field', () => {
    const bands = Array.from({ length: 20 }, (_, i) => `${i * 10}-${i * 10 + 9}=${i} units`).join(';');
    const r = translate(`Inject as per sliding scale: ${bands}, SQ QHS for DM`);
    expect(r.primarySig.length).toBeGreaterThan(199);
    expect(r.primarySig).toContain('190-199=19U SQ FDM');
    expect(r.abnormalities.some(a => a.id === 'sig_length_review')).toBe(true);
  });
});
