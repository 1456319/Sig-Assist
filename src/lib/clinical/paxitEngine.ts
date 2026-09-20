import { traceLogger } from '../diagnostics/traceLogger';

export interface PaxitPackagingEvaluation {
  readonly isPaxitSolid: boolean;
  readonly isControlled: boolean;
  readonly requiresSplit: boolean;
  readonly splitParts: Array<{ prose: string; label: string }>;
  readonly splitDirectives: string[];
  readonly packagingNotice?: string;
}

const CONTROLLED_SUBSTANCE_PATTERNS: readonly RegExp[] = [
  // C-II / C-III / C-IV Opioids & Narcotics
  /\bOXYCODONE\b/i,
  /\bOXYCONTIN\b/i,
  /\bPERCOCET\b/i,
  /\bHYDROCODONE\b/i,
  /\bNORCO\b/i,
  /\bVICODIN\b/i,
  /\bLORTAB\b/i,
  /\bMORPHINE\b/i,
  /\bMS\s*CONTIN\b/i,
  /\bHYDROMORPHONE\b/i,
  /\bDILAUDID\b/i,
  /\bFENTANYL\b/i,
  /\bDURAGESIC\b/i,
  /\bMETHADONE\b/i,
  /\bOXYMORPHONE\b/i,
  /\bOPANA\b/i,
  /\bCODEINE\b/i,
  /\bTYLENOL\s*(?:#|NO\.?)\s*[234]\b/i,
  /\bTYLENOL\s+WITH\s+CODEINE\b/i,
  /\bBUPRENORPHINE\b/i,
  /\bSUBOXONE\b/i,
  /\bSUBUTEX\b/i,
  /\bBUTRANS\b/i,
  /\bBELBUCA\b/i,
  /\bTRAMADOL\b/i,
  /\bULTRAM\b/i,
  /\bMEPERIDINE\b/i,
  /\bDEMEROL\b/i,
  /\bTAPENTADOL\b/i,
  /\bNUCYNTA\b/i,
  // C-IV Benzodiazepines & Sedatives
  /\bLORAZEPAM\b/i,
  /\bATIVAN\b/i,
  /\bALPRAZOLAM\b/i,
  /\bXANAX\b/i,
  /\bCLONAZEPAM\b/i,
  /\bKLONOPIN\b/i,
  /\bDIAZEPAM\b/i,
  /\bVALIUM\b/i,
  /\bTEMAZEPAM\b/i,
  /\bRESTORIL\b/i,
  /\bOXAZEPAM\b/i,
  /\bTRIAZOLAM\b/i,
  /\bHALCION\b/i,
  /\bCHLORDIAZEPOXIDE\b/i,
  /\bLIBRIUM\b/i,
  /\bCLORAZEPATE\b/i,
  /\bMIDAZOLAM\b/i,
  /\bZOLPIDEM\b/i,
  /\bAMBIEN\b/i,
  /\bESZOPICLONE\b/i,
  /\bLUNESTA\b/i,
  /\bZALEPLON\b/i,
  /\bSONATA\b/i,
  /\bSUVOREXANT\b/i,
  /\bBELSOMRA\b/i,
  /\bLEMBOREXANT\b/i,
  /\bDAYVIGO\b/i,
  // C-II / C-IV Stimulants
  /\bMETHYLPHENIDATE\b/i,
  /\bRITALIN\b/i,
  /\bCONCERTA\b/i,
  /\bMETADATE\b/i,
  /\bFOCALIN\b/i,
  /\bDEXMETHYLPHENIDATE\b/i,
  /\bAMPHETAMINE\b/i,
  /\bDEXTROAMPHETAMINE\b/i,
  /\bADDERALL\b/i,
  /\bDEXEDRINE\b/i,
  /\bLISDEXAMFETAMINE\b/i,
  /\bVYVANSE\b/i,
  /\bMODAFINIL\b/i,
  /\bPROVIGIL\b/i,
  /\bARMODAFINIL\b/i,
  /\bNUVIGIL\b/i,
  /\bPHENTERMINE\b/i,
  // C-III / C-IV / C-V Anticonvulsants & Others
  /\bPREGABALIN\b/i,
  /\bLYRICA\b/i,
  /\bPHENOBARBITAL\b/i,
  /\bBUTALBITAL\b/i,
  /\bFIORICET\b/i,
  /\bFIORINAL\b/i,
  /\bLOMOTIL\b/i,
  /\bDIPHENOXYLATE\b/i,
  /\bTESTOSTERONE\b/i,
];

export function isControlledSubstance(drugName: string): boolean {
  return CONTROLLED_SUBSTANCE_PATTERNS.some((pattern) => pattern.test(drugName));
}

function evaluatePaxitPackagingInternal(drugName: string, rawProse: string): PaxitPackagingEvaluation {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();

  const isControlled = isControlledSubstance(upperDrug);
  const isOralSolid =
    upperDrug.includes('TAB') ||
    upperDrug.includes('CAP') ||
    upperDrug.includes('TABLET') ||
    upperDrug.includes('CAPSULE') ||
    upperProse.includes('TAB') ||
    upperProse.includes('CAP') ||
    isControlled;
  const isExcluded = upperDrug.includes('GEL') || upperDrug.includes('SYR') || upperDrug.includes('INJ') || upperDrug.includes('SOLN');

  if (!isOralSolid || isExcluded) {
    return {
      isPaxitSolid: false,
      isControlled,
      requiresSplit: false,
      splitParts: [],
      splitDirectives: []
    };
  }

  const unitLabel = (upperDrug.includes('CAP') || upperProse.includes('CAP')) ? 'capsule' : 'tablet';

  // Extract trailing clinical context (indication or PRN clause) to preserve across split sub-orders
  const trailingContextMatch = rawProse.match(/\b((?:AS NEEDED\s+FOR|PRN\s+FOR|AS NEEDED|PRN|FOR)\s+(?!\d+\s*(?:DAYS?|D\b))[\s\S]+)$/i);
  const contextSuffix = trailingContextMatch ? ` ${trailingContextMatch[1].trim()}` : '';

  // Extract acute duration clause (e.g. for 7 days / x14d) to preserve across split sub-orders
  const durationMatch = rawProse.match(/\b(?:FOR|X)\s*(\d+)\s*(?:DAYS?|D\b)/i);
  const durationSuffix = durationMatch ? ` for ${durationMatch[1]} days` : '';

  function parseCountValue(raw: string): number {
    const upper = raw.trim().toUpperCase();
    if (upper === 'HALF') return 0.5;
    if (upper.includes('/')) {
      const parts = upper.split(/[- ]+/);
      if (parts.length === 2) {
        const [num, den] = parts[1].split('/').map(Number);
        return Number(parts[0]) + (den ? num / den : 0);
      }
      const [num, den] = upper.split('/').map(Number);
      return den ? num / den : 0;
    }
    return parseFloat(raw) || 0;
  }

  function normalizeFrequencyProse(rawFreq?: string): string {
    if (!rawFreq) return 'daily';
    const u = rawFreq.toUpperCase();
    if (u.includes('TWICE') || /\bBID\b/.test(u)) return 'twice daily';
    if (u.includes('THREE') || /\bTID\b/.test(u)) return 'three times a day';
    if (u.includes('FOUR') || /\bQID\b/.test(u)) return 'four times a day';
    if (u.includes('12 HOUR') || /\bQ12H\b/.test(u)) return 'every 12 hours';
    if (u.includes('8 HOUR') || /\bQ8H\b/.test(u)) return 'every 8 hours';
    if (u.includes('6 HOUR') || /\bQ6H\b/.test(u)) return 'every 6 hours';
    if (u.includes('4 HOUR') || /\bQ4H\b/.test(u)) return 'every 4 hours';
    if (u.includes('MORNING') || /\bQAM\b/.test(u)) return 'every morning';
    if (u.includes('BEDTIME') || /\bQHS\b/.test(u)) return 'at bedtime';
    return 'daily';
  }

  let hasDifferentialDosing = false;
  let splitParts: Array<{ prose: string; label: string }> = [];

  const countPattern = '(?:HALF|\\d+\\s*[- ]\\s*\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)';

  // Differing morning and bedtime doses (supporting decimals and fractions)
  const diffDoseRegex = new RegExp(
    `(${countPattern})\\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?.*?\\b(?:MORNING|QAM|AM)\\b.*?\\bAND\\b\\s*(${countPattern})\\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\\s*(?:AT\\s*NIGHT|AT\\s*BEDTIME|BEDTIME|QHS|HS|EVENING|PM)\\b`,
    'i'
  );
  const diffDoseMatch = upperProse.match(diffDoseRegex);
  if (diffDoseMatch) {
    const count1 = diffDoseMatch[1].trim();
    const count2 = diffDoseMatch[2].trim();
    // Only flag differential dosing if counts differ numerically
    if (parseCountValue(count1) !== parseCountValue(count2)) {
      hasDifferentialDosing = true;
      splitParts = [
        { prose: `Take ${count1} ${unitLabel} by mouth every morning${durationSuffix}${contextSuffix}`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} ${unitLabel} by mouth at bedtime${durationSuffix}${contextSuffix}`, label: 'Order 2 of 2' }
      ];
    }
  }

  // Titration / step-down (supporting decimals, secondary frequency, phase 2 duration, and stop directives)
  if (!hasDifferentialDosing) {
    const titrationRegex = new RegExp(
      `(${countPattern})\\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\\s*(?:(?:BY\\s*MOUTH|PO)\\s*)?(?:\\s*(\\bDAILY\\b|\\bQD\\b|\\bEVERY\\s*DAY\\b|\\bONCE\\s*(?:A\\s*)?DAY\\b|\\bTWICE\\s*(?:A\\s*)?DAY\\b|\\bTWICE\\s*DAILY\\b|\\bBID\\b|\\bTHREE\\s*TIMES\\s*(?:A\\s*)?DAY\\b|\\bTID\\b|\\bFOUR\\s*TIMES\\s*(?:A\\s*)?DAY\\b|\\bQID\\b|\\bEVERY\\s*12\\s*HOURS?\\b|\\bQ12H\\b|\\bEVERY\\s*8\\s*HOURS?\\b|\\bQ8H\\b|\\bEVERY\\s*6\\s*HOURS?\\b|\\bQ6H\\b|\\bEVERY\\s*4\\s*HOURS?\\b|\\bQ4H\\b|\\bEVERY\\s*MORNING\\b|\\bIN\\s*THE\\s*MORNING\\b|\\bQAM\\b|\\bAT\\s*BEDTIME\\b|\\bBEDTIME\\b|\\bQHS\\b))?\\s*(?:X|FOR)\\s*(\\d+)\\s*DAYS?\\s*THEN\\s*(?:TAKE\\s*)?(${countPattern})\\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\\s*(?:(?:BY\\s*MOUTH|PO)\\s*)?(?:\\s*(\\bDAILY\\b|\\bQD\\b|\\bEVERY\\s*DAY\\b|\\bONCE\\s*(?:A\\s*)?DAY\\b|\\bTWICE\\s*(?:A\\s*)?DAY\\b|\\bTWICE\\s*DAILY\\b|\\bBID\\b|\\bTHREE\\s*TIMES\\s*(?:A\\s*)?DAY\\b|\\bTID\\b|\\bFOUR\\s*TIMES\\s*(?:A\\s*)?DAY\\b|\\bQID\\b|\\bEVERY\\s*12\\s*HOURS?\\b|\\bQ12H\\b|\\bEVERY\\s*8\\s*HOURS?\\b|\\bQ8H\\b|\\bEVERY\\s*6\\s*HOURS?\\b|\\bQ6H\\b|\\bEVERY\\s*4\\s*HOURS?\\b|\\bQ4H\\b|\\bEVERY\\s*MORNING\\b|\\bIN\\s*THE\\s*MORNING\\b|\\bQAM\\b|\\bAT\\s*BEDTIME\\b|\\bBEDTIME\\b|\\bQHS\\b))?(?:\\s*(?:X|FOR)\\s*(\\d+)\\s*DAYS?)?(?:\\s*THEN\\s*(?:STOP|DISCONTINUE))?`,
      'i'
    );
    const titrationMatch = upperProse.match(titrationRegex);
    if (titrationMatch) {
      hasDifferentialDosing = true;
      const count1 = titrationMatch[1].trim();
      const rawFreq1 = titrationMatch[2];
      const days1 = titrationMatch[3].trim();
      const count2 = titrationMatch[4].trim();
      const rawFreq2 = titrationMatch[5];
      const days2 = titrationMatch[6];

      const phase1Freq = normalizeFrequencyProse(rawFreq1);
      const phase2Freq = normalizeFrequencyProse(rawFreq2);

      const days2Suffix = days2 ? ` for ${days2.trim()} days` : '';
      const stopSuffix = /\bTHEN\s*(?:STOP|DISCONTINUE)\b/i.test(upperProse) ? ' then stop' : '';
      splitParts = [
        { prose: `Take ${count1} ${unitLabel} by mouth ${phase1Freq} for ${days1} days${contextSuffix}`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} ${unitLabel} by mouth ${phase2Freq}${days2Suffix}${stopSuffix}${contextSuffix}`, label: 'Order 2 of 2' }
      ];
    }
  }

  if (isControlled) {
    return {
      isPaxitSolid: false,
      isControlled: true,
      requiresSplit: false,
      splitParts: hasDifferentialDosing ? splitParts : [],
      splitDirectives: hasDifferentialDosing ? splitParts.map(p => p.prose) : [],
      packagingNotice: 'Controlled Substance: Must remain on a single prescription order in FrameworkLTC (cannot be split into multiple orders). If total quantity exceeds card capacity (60 count), Framework will generate multiple labels/cards for this single order.'
    };
  }

  return {
    isPaxitSolid: true,
    isControlled: false,
    requiresSplit: hasDifferentialDosing,
    splitParts: hasDifferentialDosing ? splitParts : [],
    splitDirectives: hasDifferentialDosing ? splitParts.map(p => p.prose) : []
  };
}

export function evaluatePaxitPackaging(drugName: string, rawProse: string): PaxitPackagingEvaluation {
  const result = evaluatePaxitPackagingInternal(drugName, rawProse);
  traceLogger.debug('packaging', 'paxitEngine', 'Evaluated packaging constraints', {
    drugName,
    isControlled: result.isControlled,
    isPaxitSolid: result.isPaxitSolid,
    requiresSplit: result.requiresSplit,
    splitPartsCount: result.splitParts.length,
    hasPackagingNotice: Boolean(result.packagingNotice)
  });
  return result;
}

