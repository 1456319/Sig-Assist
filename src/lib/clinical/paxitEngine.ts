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

  // Differing morning and bedtime doses
  const diffDoseMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?[^AND]*MORNING[^AND]*AND\s*(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\s*(?:AT\s*NIGHT|AT\s*BEDTIME|BEDTIME)/i);
  if (diffDoseMatch) {
    const count1 = diffDoseMatch[1];
    const count2 = diffDoseMatch[2];
    const splitParts = [
      { prose: `Take ${count1} ${unitLabel} by mouth every morning`, label: 'Order 1 of 2' },
      { prose: `Take ${count2} ${unitLabel} by mouth at bedtime`, label: 'Order 2 of 2' }
    ];
    return {
      isPaxitSolid: true,
      requiresSplit: true,
      splitParts,
      splitDirectives: splitParts.map(p => p.prose)
    };
  }

  // Titration / step-down
  const titrationMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\s*(?:BY\s*MOUTH)?\s*(?:X|FOR)\s*(\d+)\s*DAYS?\s*THEN\s*(?:TAKE\s*)?(\d+)\s*(?:TAB|TABLET|CAP|CAPSULE)?/i);
  if (titrationMatch) {
    const count1 = titrationMatch[1];
    const days1 = titrationMatch[2];
    const count2 = titrationMatch[3];
    const splitParts = [
      { prose: `Take ${count1} ${unitLabel} by mouth daily for ${days1} days`, label: 'Order 1 of 2' },
      { prose: `Take ${count2} ${unitLabel} by mouth daily`, label: 'Order 2 of 2' }
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
