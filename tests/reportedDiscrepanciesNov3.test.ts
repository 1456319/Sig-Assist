import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-11-03-reviewed.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { rejectedOutputMatches } from '../src/lib/clinical/outputCodePolicy';

describe('October 29 and November 3 discrepancy replay', () => {
  it('covers every report, with duplicate inputs sharing a regression case', () => {
    expect(cases).toHaveLength(101);
    expect(cases.reduce((n, c) => n + c.sources.length, 0)).toBe(138);
    expect(new Set(cases.map(c => JSON.stringify([c.drugName, c.rawProse]))).size).toBe(101);
  });
  it.each(cases)('case $case: $drugName ($status)', c => {
    const input = { id: 'nov-regression', pon: 'SYNTHETIC', sourceFormat: 'manual_text' as const, drugName: c.drugName, rawProse: c.rawProse };
    const r = translateClinicalSig(input);
    expect(r.primarySig).toBe(c.expected);
    expect(r.subOrders.map(s => s.suggestedSig)).toEqual(c.subOrders);
    expect(input.rawProse).toBe(c.rawProse);
    expect(rejectedOutputMatches(r.primarySig)).toEqual([]);
    if (c.status === 'source-review') expect(c.reviewNote.length).toBeGreaterThan(0);
  });
});
