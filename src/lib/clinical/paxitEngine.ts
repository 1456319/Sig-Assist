export interface PaxitPackagingEvaluation {
  readonly isPaxitSolid: boolean;
  readonly requiresSplit: boolean;
  readonly splitParts: Array<{ prose: string; label: string }>;
  readonly splitDirectives: string[];
}

export function evaluatePaxitPackaging(drugName: string, rawProse: string): PaxitPackagingEvaluation {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();

  const isOralSolid = upperDrug.includes('TAB') || upperDrug.includes('CAP') || upperDrug.includes('TABLET') || upperDrug.includes('CAPSULE');
  const isExcluded = upperDrug.includes('GEL') || upperDrug.includes('SYR') || upperDrug.includes('INJ') || upperDrug.includes('SOLN');

  if (!isOralSolid || isExcluded) {
    return { isPaxitSolid: false, requiresSplit: false, splitParts: [], splitDirectives: [] };
  }

  const unitLabel = upperDrug.includes('CAP') ? 'capsule' : 'tablet';

  // Extract trailing clinical context (indication or PRN clause) to preserve across split sub-orders
  const trailingContextMatch = rawProse.match(/\b((?:AS NEEDED\s+FOR|PRN\s+FOR|AS NEEDED|PRN|FOR)\s+(?!\d+\s*(?:DAYS?|D\b))[\s\S]+)$/i);
  const contextSuffix = trailingContextMatch ? ` ${trailingContextMatch[1].trim()}` : '';

  // Differing morning and bedtime doses (using non-greedy wildcard and \bAND\b word boundary)
  const diffDoseMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?.*?\b(?:MORNING|QAM|AM)\b.*?\bAND\b\s*(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\s*(?:AT\s*NIGHT|AT\s*BEDTIME|BEDTIME|QHS|HS|EVENING|PM)\b/i);
  if (diffDoseMatch) {
    const count1 = diffDoseMatch[1];
    const count2 = diffDoseMatch[2];
    // Guard: Only split if doses differ. Identical doses consolidate into BIDAMHS per spec Section 4.1
    if (count1 !== count2) {
      const splitParts = [
        { prose: `Take ${count1} ${unitLabel} by mouth every morning${contextSuffix}`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} ${unitLabel} by mouth at bedtime${contextSuffix}`, label: 'Order 2 of 2' }
      ];
      return {
        isPaxitSolid: true,
        requiresSplit: true,
        splitParts,
        splitDirectives: splitParts.map(p => p.prose)
      };
    }
  }

  // Titration / step-down (supporting frequency keywords before duration)
  const titrationMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\s*(?:(?:BY\s*MOUTH|PO)\s*)?(?:\s*(?:DAILY|QD|EVERY\s*DAY|ONCE\s*A\s*DAY))?\s*(?:X|FOR)\s*(\d+)\s*DAYS?\s*THEN\s*(?:TAKE\s*)?(\d+)\s*(?:TAB|TABLET|CAP|CAPSULE)?/i);
  if (titrationMatch) {
    const count1 = titrationMatch[1];
    const days1 = titrationMatch[2];
    const count2 = titrationMatch[3];
    const splitParts = [
      { prose: `Take ${count1} ${unitLabel} by mouth daily for ${days1} days${contextSuffix}`, label: 'Order 1 of 2' },
      { prose: `Take ${count2} ${unitLabel} by mouth daily${contextSuffix}`, label: 'Order 2 of 2' }
    ];
    return {
      isPaxitSolid: true,
      requiresSplit: true,
      splitParts,
      splitDirectives: splitParts.map(p => p.prose)
    };
  }

  return { isPaxitSolid: true, requiresSplit: false, splitParts: [], splitDirectives: [] };
}
