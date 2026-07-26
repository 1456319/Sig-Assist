import { describe, expect, it } from 'vitest';
import { isUnknownElementalCandidate, resolveFormulationEquivalent } from './formulationEquivalences';

describe('formulation equivalences', () => {
  it('calculates known named formulations', () => {
    expect(resolveFormulationEquivalent('CALCIUM CITRATE 950MG TABLET')?.elemental).toEqual({ amount: 199.5, unit: 'MG' });
    expect(resolveFormulationEquivalent('VITAMIN D3 2000U')?.elemental).toEqual({ amount: 50, unit: 'MCG' });
    expect(resolveFormulationEquivalent('MAGNESIUM OXIDE 400MG')?.elemental.amount).toBeCloseTo(241.2, 1);
  });
  it('blocks bare elemental-looking strengths rather than guessing their salt', () => {
    expect(isUnknownElementalCandidate('CALCIUM 950MG TABLET')).toBe(true);
    expect(isUnknownElementalCandidate('CALCIUM CITRATE 950MG TABLET')).toBe(false);
  });
});
