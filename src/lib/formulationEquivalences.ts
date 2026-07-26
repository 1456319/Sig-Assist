import { roundClinical, type MedicationAmount, type MedicationUnit } from './sigMath';

export interface FormulationEquivalent {
  formulation: string;
  elementalIngredient: string;
  product: MedicationAmount;
  elemental: MedicationAmount;
}

interface FormulationRule {
  match: RegExp;
  elementalIngredient: string;
  factor: number;
  productUnit: MedicationUnit;
  elementalUnit: MedicationUnit;
}

// Curated rules: activate only when the named formulation is present.
const rules: FormulationRule[] = [
  { match: /\bcalcium citrate\b/i, elementalIngredient: 'calcium', factor: 0.21, productUnit: 'MG', elementalUnit: 'MG' },
  { match: /\bmagnesium oxide\b/i, elementalIngredient: 'magnesium', factor: 24.305 / 40.304, productUnit: 'MG', elementalUnit: 'MG' },
  { match: /\bvitamin d3\b|\bcholecalciferol\b/i, elementalIngredient: 'vitamin d3', factor: 1 / 40, productUnit: 'UN', elementalUnit: 'MCG' },
];

const elementalNames = ['calcium', 'magnesium', 'zinc'];

function strength(text: string): MedicationAmount | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(mcg|mg|gm|g|iu|units?|u)\b/i);
  if (!match) return undefined;
  const unit = match[2].toLowerCase();
  return { amount: Number(match[1]), unit: unit === 'g' ? 'GM' : /^(iu|u|unit)/.test(unit) ? 'UN' : unit.toUpperCase() as MedicationUnit };
}

export function resolveFormulationEquivalent(drug: string): FormulationEquivalent | undefined {
  const product = strength(drug);
  const rule = rules.find((candidate) => candidate.match.test(drug));
  if (!product || !rule || product.unit !== rule.productUnit) return undefined;
  return { formulation: rule.match.source, elementalIngredient: rule.elementalIngredient, product, elemental: { amount: roundClinical(product.amount * rule.factor), unit: rule.elementalUnit } };
}

export function isUnknownElementalCandidate(drug: string): boolean {
  const product = strength(drug);
  if (!product || resolveFormulationEquivalent(drug)) return false;
  return elementalNames.some((name) => new RegExp(`\\b${name}\\b`, 'i').test(drug));
}
