import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { splitSupplementalDirections } from '../src/lib/clinical/instructionClauses';

function translate(drugName: string, rawProse: string) {
  return translateClinicalSig({ id: 'final-monitoring', pon: 'SYNTHETIC', sourceFormat: 'manual_text', drugName, rawProse });
}

describe('non-scale monitoring instructions retain their clinical scope', () => {
  it.each([
    {
      drug: 'METFORMIN 500 MG TABLET',
      dose: 'Take 1 tablet by mouth twice daily with meals',
      note: 'Check blood sugar 2 times a day, call MD if over 300.',
      expectedDose: '1T PO WMBID',
    },
    {
      drug: 'FUROSEMIDE 20 MG TABLET',
      dose: 'Take 1 tablet by mouth daily',
      note: 'Weigh daily, notify MD if weight gain exceeds 3 pounds in 1 day.',
      expectedDose: '1T PO QD',
    },
    {
      drug: 'LISINOPRIL 10 MG TABLET',
      dose: 'Give 1 tablet by mouth twice daily',
      note: 'Monitor blood pressure every 4 hours; call MD if systolic pressure is below 90.',
      expectedDose: '1T PO BID',
    },
    {
      drug: 'POTASSIUM CHLORIDE 10 MEQ TABLET',
      dose: 'Give 1 tablet by mouth daily',
      note: 'Recheck potassium in 7 days, notify MD if less than 3.5.',
      expectedDose: '1T PO QD',
    },
  ])('keeps the full $note after translating only $dose', ({ drug, dose, note, expectedDose }) => {
    const result = translate(drug, `${dose}. ${note}`);
    expect(result.primarySig).toBe(`${expectedDose}. ${note.toUpperCase()}`);
    expect(result.subOrders).toHaveLength(1);
    expect(result.subOrders[0].suggestedSig).toBe(result.primarySig);
    expect(result.abnormalities).toContainEqual(expect.objectContaining({
      id: 'retained_supplemental_instructions', tier: 'uncorrected_gap', trigger: note,
    }));
  });

  it.each([
    'At bedtime check blood sugar, call MD if over 300.',
    'After meals monitor blood pressure every 4 hours, notify MD if systolic pressure is below 90.',
    'Before breakfast, recheck blood sugar and call MD if less than 70.',
    'Never check blood sugar from the arm with the fistula, notify MD if unable to obtain sample.',
    'After meals do not check blood sugar from the arm with the fistula.',
  ])('retains the entire scoped action: %s', note => {
    const result = translate('METFORMIN 500 MG TABLET', `Take 1 tablet by mouth twice daily with meals. ${note}`);
    expect(result.primarySig).toBe(`1T PO WMBID. ${note.toUpperCase()}`);
    expect(result.abnormalities).toContainEqual(expect.objectContaining({
      id: 'retained_supplemental_instructions', trigger: note,
    }));
  });
});

describe('supplemental clause boundaries', () => {
  it.each([
    ['. At bedtime give half the dose.', 'At bedtime give half the dose.'],
    ['; After 7 days take half the dose.', 'After 7 days take half the dose.'],
    [', before breakfast administer half the dose.', 'before breakfast administer half the dose.'],
    [' then after 7 days take half the dose.', 'then after 7 days take half the dose.'],
    [' and after breakfast and before lunch check blood sugar.', 'after breakfast and before lunch check blood sugar.'],
  ])('keeps temporal and phase prefixes in %s', (tail, supplemental) => {
    expect(splitSupplementalDirections(`Give 1 tablet by mouth daily${tail}`)).toEqual({
      primary: 'Give 1 tablet by mouth daily', supplemental,
    });
  });

  it('keeps the primary bedtime schedule when a later check follows AND', () => {
    expect(splitSupplementalDirections('Take 1 tablet by mouth at bedtime and check blood sugar every morning.')).toEqual({
      primary: 'Take 1 tablet by mouth at bedtime', supplemental: 'check blood sugar every morning.',
    });
  });

  it.each(['At bedtime give half a tablet by mouth', 'Before breakfast take half a tablet by mouth'])('keeps an initial scoped dose as primary: %s', prose => {
    expect(splitSupplementalDirections(prose)).toEqual({ primary: prose });
  });

  it('does not move a primary bedtime schedule into a later crushing restriction', () => {
    const result = translate('GUAIFENESIN ER 600 MG TABLET', 'Give 1 tablet by mouth every morning and at bedtime for cough for 7 days do not crush, chew, or split');
    expect(result.primarySig).toBe('1T PO BIDAMHS X7D FCOU. DO NOT CRUSH, CHEW, OR SPLIT');
  });

  it('keeps primary hold conditions and their notification together', () => {
    const prose = 'Take 1 tablet by mouth daily, hold if systolic blood pressure less than 100 or pulse less than 60 and notify MD';
    expect(splitSupplementalDirections(prose)).toEqual({ primary: prose });
  });

  it('leaves an ordinary dose and schedule unchanged', () => {
    const prose = 'Give 1 tablet by mouth twice daily with meals';
    expect(splitSupplementalDirections(prose)).toEqual({ primary: prose });
    expect(translate('METFORMIN 500 MG TABLET', prose).primarySig).toBe('1T PO WMBID');
  });

  it.each([
    'At bedtime give half the sliding scale dose.',
    'After meals check blood sugar and call MD if over 300.',
    'Give half the sliding scale dose.',
    'Do not give half the sliding scale dose.',
  ])('allows an isolated scale footer to retain its initial action: %s', footer => {
    expect(splitSupplementalDirections(footer, { allowScaleActions: true })).toEqual({
      primary: '', supplemental: footer,
    });
  });

  it('keeps a full scale intact by default', () => {
    const prose = 'Inject per sliding scale before meals: 150-199 2 units; 200-249 4 units. At bedtime give half the sliding scale dose.';
    expect(splitSupplementalDirections(prose)).toEqual({ primary: prose });
  });
});
