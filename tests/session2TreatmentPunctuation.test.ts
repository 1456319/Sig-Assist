import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

it('retains the routine and PRN wound clauses without a hanging period before their condition', () => {
  const rawProse = 'Apply to right elbow wound topically every day shift every Mon, Wed, Fri for wound care see TAR AND Apply to right elbow wound topically as needed if dressing is soiled, saturated or dislodged';
  const result = translateClinicalSig({ id: 'synthetic-session2-punctuation', pon: 'SYNTHETIC-SESSION2', drugName: 'Synthetic wound solution', sourceFormat: 'manual_text', rawProse });
  const prn = result.subOrders.find(part => /PRN/i.test(part.label));
  expect(prn).toBeDefined();
  expect(prn!.suggestedSig).toContain('PRN IF');
  expect(prn!.suggestedSig).not.toContain('PRN. IF');
  expect(prn!.suggestedSig).toContain('SOILED');
  expect(prn!.suggestedSig).toContain('SATURATED');
  expect(prn!.suggestedSig).toContain('DISLODGED');
  expect(rawProse).toContain('as needed if');
});
