import { describe, expect, it } from 'vitest';
import { applyOutputCodePolicy, rejectedOutputMatches } from '../src/lib/clinical/outputCodePolicy';
import { translateClinicalSig, getCachedClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { copyBlockReason, reviewStamp } from '../src/lib/reviewPolicy';
const inbound = { id: 'test', pon: 'MANUAL_ENTRY', drugName: 'EXAMPLE TAB', rawProse: 'Give 1 tablet by mouth daily', sourceFormat: 'manual_text' as const };

describe('packaging restrictions across generation and review', () => {
  it.each(['INH', 'FNA', 'FVOM', 'Q23H', 'PNA'])('rejects %s even in a manually approved draft', code => {
    const draft = `1T PO QD (${code});`;
    expect(copyBlockReason('source', draft, [], reviewStamp('source', draft, []))).toContain('rejected packaging code');
    expect(rejectedOutputMatches(applyOutputCodePolicy(draft).sig)).toEqual([]);
  });
  it('matches punctuation and slash-separated rejected tokens without damaging longer words/codes', () => {
    expect(rejectedOutputMatches('INHALE FNAU FPNE INH/FVOM')).toEqual(['INH', 'FVOM']);
    expect(applyOutputCodePolicy('FNAU FPNE INHALER').sig).toBe('FNAU FPNE INHALER');
  });
  it('uses known expansions during generation and keys the cache by exclusions', () => {
    const excluded = { exclusions: [{ kind: 'code' as const, value: 'QD' }] };
    expect(getCachedClinicalSig(inbound).primarySig).toBe('1T PO QD');
    const result = getCachedClinicalSig(inbound, excluded);
    expect(result.primarySig).toBe('1T PO ONE TIME A DAY');
    expect(result.subOrders[0].suggestedSig).toBe(result.primarySig);
    expect(getCachedClinicalSig(inbound).primarySig).toBe('1T PO QD');
  });
  it('applies exclusions to retained instructions, templates and every split card', () => {
    const tail = translateClinicalSig({ ...inbound, rawProse: inbound.rawProse + '. May give for PNA or FVOM' });
    expect(tail.primarySig).toContain('PNEUMONIA OR FOR VOMITING');
    const template = translateClinicalSig({ ...inbound, defaultSigTemplate: 'CUSTOM INH Q23H' });
    expect(template.primarySig).toBe('CUSTOM BY INHALATION EVERY 2 TO 3 HOURS');
    const split = translateClinicalSig({ ...inbound, drugName: 'EXAMPLE TAB 5MG', rawProse: 'Give 1.5 tablets by mouth daily for PNA' }, { exclusions: [{ kind: 'code', value: 'PO' }] });
    expect(split.subOrders).toHaveLength(2);
    split.subOrders.forEach(card => { expect(card.suggestedSig).toContain('BY MOUTH'); expect(card.suggestedSig).not.toMatch(/\b(?:PO|PNA)\b/); });
  });
  it('supports new reported codes with replacements, but never overrides built-in restrictions', () => {
    expect(applyOutputCodePolicy('ZZZ', [{ kind: 'code', value: 'ZZZ', replacement: 'AS DIRECTED' }]).sig).toBe('AS DIRECTED');
    expect(applyOutputCodePolicy('Q23H', [{ kind: 'code', value: 'Q23H', replacement: 'EVERY 23 HOURS' }]).sig).toBe('EVERY 2 TO 3 HOURS');
  });
  it('withholds an unknown or cyclic excluded suggestion without deleting its clinical clause', () => {
    expect(applyOutputCodePolicy('1T PO QD ZZZ', [{ kind: 'code', value: 'ZZZ' }])).toMatchObject({ sig: '', unresolved: ['ZZZ'] });
    expect(applyOutputCodePolicy('AAA', [{ kind: 'code', value: 'AAA', replacement: 'BBB' }, { kind: 'code', value: 'BBB', replacement: 'AAA' }]).sig).toBe('');
    const r = translateClinicalSig(inbound, { exclusions: [{ kind: 'sig', value: '1T PO QD' }] });
    expect(r.primarySig).toBe('');
    expect(r.abnormalities.some(a => a.id === 'unresolved_output_exclusion')).toBe(true);
  });
  it('keeps custom route exclusions atomic for established PO/SL combined codes', () => {
    expect(applyOutputCodePolicy('1T PO/SL QD', [{ kind: 'code', value: 'PO' }]).sig).toBe('1T PO/SL QD');
  });
});
