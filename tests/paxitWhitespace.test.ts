import { describe, expect, it } from 'vitest';
import { evaluatePaxitPackaging } from '../src/lib/clinical/paxitEngine';

describe('packaging whitespace normalization', () => {
  it('preserves titration phases, fractions and trailing context across whitespace', () => {
    const prose = 'Take 1/2 tablet by mouth daily for 7 days then take 1 tablet at bedtime for 3 days then stop. Hold if dizzy';
    expect(evaluatePaxitPackaging('EXAMPLE TABLET', prose.replace(/ /g, '\t \n')))
      .toEqual(evaluatePaxitPackaging('EXAMPLE TABLET', prose));
    expect(evaluatePaxitPackaging('EXAMPLE TABLET', prose).splitParts).toEqual([
      { prose: 'Take 1/2 tablet by mouth daily for 7 days Hold if dizzy', label: 'Order 1 of 2' },
      { prose: 'Take 1 tablet by mouth at bedtime for 3 days then stop Hold if dizzy', label: 'Order 2 of 2' },
    ]);
  });
  it('handles a long rejected titration without splitting or inventing directions', () => {
    const result = evaluatePaxitPackaging('EXAMPLE TABLET', `Take 1${' '.repeat(64_000)}unknown`);
    expect(result).toMatchObject({ isPaxitSolid: true, requiresSplit: false, splitParts: [] });
  });
});
