export type MedicationUnit = 'MCG' | 'MG' | 'GM' | 'UN';

export interface MedicationAmount { amount: number; unit: MedicationUnit; }
export interface MedicationConcentration extends MedicationAmount { volumeMl: number; }

const massToMcg: Record<Exclude<MedicationUnit, 'UN'>, number> = { MCG: 1, MG: 1_000, GM: 1_000_000 };

export function toMedicationUnit(value: string): MedicationUnit | undefined {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'G') return 'GM';
  if (normalized === 'U' || normalized === 'UNIT' || normalized === 'UNITS') return 'UN';
  return ['MCG', 'MG', 'GM', 'UN'].includes(normalized) ? normalized as MedicationUnit : undefined;
}

/** Converts only compatible dimensions. Units are intentionally never converted to mass. */
export function convertMedicationAmount(value: MedicationAmount, target: MedicationUnit): number | undefined {
  if (value.unit === target) return value.amount;
  if (value.unit === 'UN' || target === 'UN') return undefined;
  return (value.amount * massToMcg[value.unit]) / massToMcg[target];
}

export function roundClinical(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function volumeForDose(requested: MedicationAmount, concentration: MedicationConcentration): number | undefined {
  const requestedInConcentrationUnit = convertMedicationAmount(requested, concentration.unit);
  if (requestedInConcentrationUnit === undefined || concentration.amount <= 0 || concentration.volumeMl <= 0) return undefined;
  return roundClinical((requestedInConcentrationUnit / concentration.amount) * concentration.volumeMl);
}

export function doseForVolume(volumeMl: number, concentration: MedicationConcentration): MedicationAmount | undefined {
  if (volumeMl < 0 || concentration.amount <= 0 || concentration.volumeMl <= 0) return undefined;
  return { amount: roundClinical((volumeMl / concentration.volumeMl) * concentration.amount), unit: concentration.unit };
}

export function doseForSolidQuantity(quantity: number, strength: MedicationAmount): MedicationAmount | undefined {
  if (quantity < 0 || strength.amount <= 0) return undefined;
  return { amount: roundClinical(quantity * strength.amount), unit: strength.unit };
}
