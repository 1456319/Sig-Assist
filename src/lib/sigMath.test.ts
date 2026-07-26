import { describe, expect, it } from 'vitest';
import { convertMedicationAmount, doseForSolidQuantity, doseForVolume, volumeForDose } from './sigMath';

describe('SIG dose math', () => {
  it('converts compatible mass units without converting units to mass', () => {
    expect(convertMedicationAmount({ amount: 0.5, unit: 'MG' }, 'MCG')).toBe(500);
    expect(convertMedicationAmount({ amount: 1, unit: 'UN' }, 'MG')).toBeUndefined();
  });
  it('calculates injection volume from prescribed dose', () => {
    expect(volumeForDose({ amount: 4.5, unit: 'MG' }, { amount: 4.5, unit: 'MG', volumeMl: 0.5 })).toBe(0.5);
    expect(volumeForDose({ amount: 1.8, unit: 'MG' }, { amount: 18, unit: 'MG', volumeMl: 3 })).toBe(0.3);
  });
  it('calculates delivered dose from volume and solid quantity', () => {
    expect(doseForVolume(0.25, { amount: 20, unit: 'MG', volumeMl: 1 })).toEqual({ amount: 5, unit: 'MG' });
    expect(doseForSolidQuantity(0.5, { amount: 25, unit: 'MCG' })).toEqual({ amount: 12.5, unit: 'MCG' });
  });
});
