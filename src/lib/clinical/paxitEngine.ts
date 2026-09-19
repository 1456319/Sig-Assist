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

export function evaluatePaxitPackaging(drugName: string, rawProse: string): PaxitPackagingEvaluation {
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

  let hasDifferentialDosing = false;
  let splitParts: Array<{ prose: string; label: string }> = [];

  // Differing morning and bedtime doses (using non-greedy wildcard and \bAND\b word boundary)
  const diffDoseMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?.*?\b(?:MORNING|QAM|AM)\b.*?\bAND\b\s*(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)?\s*(?:AT\s*NIGHT|AT\s*BEDTIME|BEDTIME|QHS|HS|EVENING|PM)\b/i);
  if (diffDoseMatch) {
    const count1 = diffDoseMatch[1];
    const count2 = diffDoseMatch[2];
    // Only flag differential dosing if counts differ
    if (count1 !== count2) {
      hasDifferentialDosing = true;
      splitParts = [
        { prose: `Take ${count1} ${unitLabel} by mouth every morning${contextSuffix}`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} ${unitLabel} by mouth at bedtime${contextSuffix}`, label: 'Order 2 of 2' }
      ];
    }
  }

  // Titration / step-down (supporting frequency keywords before duration)
  if (!hasDifferentialDosing) {
    const titrationMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\s*(?:(?:BY\s*MOUTH|PO)\s*)?(?:\s*(?:DAILY|QD|EVERY\s*DAY|ONCE\s*A\s*DAY))?\s*(?:X|FOR)\s*(\d+)\s*DAYS?\s*THEN\s*(?:TAKE\s*)?(\d+)\s*(?:TAB|TABLET|CAP|CAPSULE)?/i);
    if (titrationMatch) {
      hasDifferentialDosing = true;
      const count1 = titrationMatch[1];
      const days1 = titrationMatch[2];
      const count2 = titrationMatch[3];
      splitParts = [
        { prose: `Take ${count1} ${unitLabel} by mouth daily for ${days1} days${contextSuffix}`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} ${unitLabel} by mouth daily${contextSuffix}`, label: 'Order 2 of 2' }
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
