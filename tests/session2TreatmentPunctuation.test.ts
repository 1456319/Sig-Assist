import { expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

it.each([
  ['Synthetic wound solution', 'if'],
  ['Synthetic antiseptic Topical Solution 0.1 %', 'if'],
  ['Synthetic antiseptic Topical Solution 0.1 %', 'for if'],
])('retains routine and PRN wound conditions for %s with %s', (drugName, condition) => {
  const rawProse = `Apply to right elbow wound topically every day shift every Mon, Wed, Fri for wound care see TAR AND Apply to right elbow wound topically as needed ${condition} dressing is soiled, saturated or dislodged`;
  const result = translateClinicalSig({ id: 'synthetic-session2-punctuation', pon: 'SYNTHETIC-SESSION2', drugName, sourceFormat: 'manual_text', rawProse });
  const prn = result.subOrders.find(part => /PRN/i.test(part.label));
  expect(prn).toBeDefined();
  expect(prn!.suggestedSig).toContain('PRN IF');
  expect(prn!.suggestedSig).not.toContain('PRN. IF');
  expect(prn!.suggestedSig).toContain('SOILED');
  expect(prn!.suggestedSig).toContain('SATURATED');
  expect(prn!.suggestedSig).toContain('DISLODGED');
  expect(rawProse).toContain(`as needed ${condition}`);
});
