import { describe, expect, it } from 'vitest';
import { compactScaleSpacing, estimateScaleExpansion, fitSlidingScaleBudget, scaleBudgetFindings } from '../src/lib/clinical/slidingScaleBudget';

const padded = (size: number) => `CBS QID SS 150-200=2U ${'X'.repeat(size)} FDM2`;
describe('site scale concessions use the expanded shared budget', () => {
  it('removes padding without deleting essential word/code boundaries', () => {
    expect(compactScaleSpacing('CBS QID SS  < 70 = HYPOGLYCEMIC PROTOCOL & CALL MD ; 150 - 200 = 2 U'))
      .toBe('CBS QID SS <70=HYPOGLYCEMIC PROTOCOL&CALL MD;150-200=2U');
  });
  it('uses site prefix meanings and preserves dotted literal forms', () => {
    expect(estimateScaleExpansion('CBS QID SS 150-200=2U')).toBe('CHECK BLOOD SUGAR FOUR TIMES A DAY AND INJECT SUBCUTANEOUSLY ACCORDING TO SLIDING SCALE 150-200=2U');
    expect(estimateScaleExpansion('C.B.S. QID S.S. 150-200=2U')).toBe('C.B.S. FOUR TIMES A DAY S.S. 150-200=2U');
  });
  it.each([
    [60, [], false], [80, ['diagnosis'], false], [100, ['diagnosis'], false],
    [110, ['diagnosis', 'literal_ss'], false],
    [150, ['diagnosis', 'literal_ss', 'literal_cbs'], false],
    [180, ['diagnosis', 'literal_ss', 'literal_cbs'], true],
  ] as const)('stops at the first sufficient concession for padding %s', (size, steps, over) => {
    const result = fitSlidingScaleBudget([padded(size)]);
    expect(result.concessions).toEqual(steps);
    expect(result.overLimit).toBe(over);
    expect(result.parts[0]).toContain('150-200=2U');
    expect(result.parts[0]).toContain('X'.repeat(size));
    if (size === 100) expect(result.estimatedExpandedLength).toBe(199);
    if (over) expect(scaleBudgetFindings(result).some(f => f.id === 'sliding_scale_budget_exceeded')).toBe(true);
  });
  it('counts main and split parts together and does not grant each its own 199', () => {
    const first = 'CBS QID SS 150-200=2U ' + 'X'.repeat(60);
    const second = '3U QID ' + 'Y'.repeat(40);
    expect(fitSlidingScaleBudget([first]).concessions).toEqual([]);
    expect(fitSlidingScaleBudget([second]).concessions).toEqual([]);
    const group = fitSlidingScaleBudget([first, second]);
    expect(group.concessions).toContain('literal_ss');
    expect(group.estimatedExpandedLength).toBe(group.parts.map(estimateScaleExpansion).join(' ; ').length);
    expect(group.parts[1]).toContain('3U QID');
  });
  it.each(['FOR DM2', 'FOR DIABETES MELLITUS TYPE 2', 'FOR TYPE 2 DIABETES'])('omits a literal diagnosis only when the budget requires it: %s', diagnosis => {
    const result = fitSlidingScaleBudget([`CBS QID SS 150-200=2U ${'X'.repeat(100)} ${diagnosis}`]);
    expect(result.parts[0]).not.toContain(diagnosis);
    expect(result.concessions).toContain('diagnosis');
    expect(result.parts[0]).toContain('150-200=2U');
  });
});
