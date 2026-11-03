import { AbnormalityFinding } from './types';

export interface TreatmentParseResult {
  readonly isTreatment: boolean;
  readonly primarySig: string;
  readonly subOrders: Array<{
    label: string;
    sig: string;
  }>;
  readonly abnormalities: AbnormalityFinding[];
}

/**
 * Normalizes anatomical application site descriptions.
 * E.g., "sacrum MASD wound" -> "SACRUM MASD WOUND"
 * "bil buttock and left lower back wound" -> "BIL BUTTOCK/LT LOWER BACK WOUND"
 */
export function normalizeApplicationArea(rawArea: string): string {
  let area = rawArea.trim().toUpperCase();
  // Normalize bilateral
  area = area.replace(/\bBILATERAL\b/g, 'BIL');
  area = area.replace(/\bB\/L\b/g, 'BIL');
  // Normalize left / right
  area = area.replace(/\bLEFT\b/g, 'LT');
  area = area.replace(/\bRIGHT\b/g, 'RT');
  // Normalize conjunction "AND" connecting areas to "/"
  area = area.replace(/\s+AND\s+/g, '/');
  // Clean multiple spaces
  area = area.replace(/\s+/g, ' ').trim();
  return area;
}

/**
 * Detects whether the order prose indicates a treatment order.
 * Treatment orders typically involve wound care instructions:
 * cleansing (with wound cleanser, soap and water, normal saline),
 * patting dry, leaving open to air (OTA), applying dressing, etc.
 */
export function isTreatmentOrder(drugName: string, rawProse: string): boolean {
  const text = `${drugName} ${rawProse}`.toUpperCase();

  const treatmentPhrases = [
    /\bCLEANSE\b/i,
    /\bPAT\s+DRY\b/i,
    /\bWOUND\s+CLEANSER\b/i,
    /\bSOAP\s+AND\s+WATER\b/i,
    /\bNORMAL\s+SALINE\b/i,
    /\bWOUND\s+CARE\b/i,
    /\bLEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)\b/i,
    /\bCOVER\s+WITH\b.*?\bDRESSING\b/i,
    /\bDRY\s+STERILE\s+DRESSING\b/i,
    /\bVASHE\b/i,
    /\bDERMAL\s+WOUND\b/i,
    /\bSKIN\s+TEAR\b/i,
  ];

  let matches = 0;
  for (const regex of treatmentPhrases) {
    if (regex.test(text)) {
      matches++;
    }
  }

  // If "cleanse" or "pat dry" or "leave open to air" or "wound cleanser" is present, it's a treatment order.
  if (/\b(?:CLEANSE|PAT\s+DRY|WOUND\s+CLEANSER|OPEN\s+TO\s+AIR|OTA|DSD|DRESSING)\b/i.test(text)) {
    return true;
  }

  return matches >= 2;
}

/**
 * Extracts the primary application site/wound location from prose.
 */
export function extractTreatmentSite(rawProse: string): string | undefined {
  const prose = rawProse.replace(/\s+/g, ' ').trim();

  // Pattern 1: Apply to <area> topically / for / with / every
  const applyMatch = prose.match(/\bAPPLY\s+TO\s+([\w\s/-]+?)(?=\s+(?:TOPICALLY|TPCL|EVERY|EACH|DAILY|Q\/|AS\s+NEEDED|PRN|FOR|CLEANSE|W\/)\b|[.,;]|$)/i);
  if (applyMatch && applyMatch[1].trim() && !/^(?:THE\s+)?AFFECTED\s+AREA$/i.test(applyMatch[1].trim())) {
    return normalizeApplicationArea(applyMatch[1]);
  }

  // Pattern 2: Cleanse (the) wound on <area> with ... / Cleanse (the) <area> with ...
  const cleanseWoundOnMatch = prose.match(/\bCLEANSE\s+(?:THE\s+)?WOUND\s+(?:ON|AT|IN)\s+(?:THE\s+)?([\w\s/-]+?)(?=\s+WITH\b|[.,;]|$)/i);
  if (cleanseWoundOnMatch && cleanseWoundOnMatch[1].trim()) {
    return normalizeApplicationArea(cleanseWoundOnMatch[1]);
  }

  const cleanseMatch = prose.match(/\bCLEANSE\s+(?:THE\s+)?([\w\s/-]+?)(?=\s+WITH\b|[.,;]|$)/i);
  if (cleanseMatch && cleanseMatch[1].trim() && !/^(?:AFFECTED\s+AREA|AREA|SKIN|WOUND)$/i.test(cleanseMatch[1].trim())) {
    return normalizeApplicationArea(cleanseMatch[1]);
  }

  // Pattern 3: To <area>
  const toMatch = prose.match(/\bTO\s+([\w\s/-]+?)(?=\s+(?:TOPICALLY|TPCL|EVERY|EACH|DAILY|FOR|CLEANSE)\b|[.,;]|$)/i);
  if (toMatch && toMatch[1].trim()) {
    return normalizeApplicationArea(toMatch[1]);
  }

  return undefined;
}

/**
 * Extracts the cleansed action wording:
 * e.g., "CLEANSE W/WOUND CLEANSER" or "W/SOAP&WATER"
 */
function extractCleansingPhrase(rawProse: string): { standard: string; condensed: string; tight: string } | undefined {
  if (/\b(?:CLEANSE|WASH)\b.*?\b(?:WOUND\s+CLEANSER|WC|DWC|VASHE)\b/i.test(rawProse)) {
    return {
      standard: 'CLEANSE WITH WOUND CLEANSER',
      condensed: 'CLEANSE W/WOUND CLEANSER',
      tight: 'CLEANSE W/WOUND CLEANSER',
    };
  }
  if (/\b(?:CLEANSE|WASH)\b.*?\b(?:SOAP\s+AND\s+WATER|S&W|MILD\s+SOAP)\b/i.test(rawProse)) {
    return {
      standard: 'CLEANSE WITH SOAP AND WATER',
      condensed: 'CLEANSE W/SOAP AND WATER',
      tight: 'W/SOAP&WATER',
    };
  }
  if (/\b(?:CLEANSE|WASH)\b.*?\b(?:NORMAL\s+SALINE|NS)\b/i.test(rawProse)) {
    return {
      standard: 'CLEANSE WITH NORMAL SALINE',
      condensed: 'CLEANSE W/NORMAL SALINE',
      tight: 'W/NS',
    };
  }
  if (/\bCLEANSE\b/i.test(rawProse)) {
    return {
      standard: 'CLEANSE',
      condensed: 'CLEANSE',
      tight: 'CLEANSE',
    };
  }
  return undefined;
}

/**
 * Extracts drug name keyword for topical application (e.g., ZINC OXIDE, EXTRA PROTECTIVE OINTMENT, etc.).
 */
function extractDrugShortName(drugName: string, rawProse: string): string {
  // Check if specific drug is mentioned in the prose (e.g. "apply zinc oxide")
  const proseMatch = rawProse.match(/\bAPPLY\s+([A-Z0-9\s/-]+?)(?=\s+(?:Q\/|EVERY|DAILY|BID|TID|QID|PRN|AS\s+NEEDED|THEN|AND|TWICE|ONCE)\b|[.,;]|$)/i);
  if (proseMatch) {
    const candidate = proseMatch[1].trim().toUpperCase();
    if (!/^(?:TO|A|THIN|GENEROUS|SPARINGLY|LIBERALLY|TOPICALLY|TPCL|OINTMENT|CREAM|PASTE)/i.test(candidate) && candidate.length > 2) {
      return candidate;
    }
  }

  // Derive from drugName: drop strength and dosage form
  let name = drugName.toUpperCase();
  name = name.replace(/\s+\d+(?:\.\d+)?\s*%.*$/, '');
  name = name.replace(/\s+\d+(?:\.\d+)?\s*(?:MG|MCG|GM|G|ML).*$/, '');
  name = name.replace(/\b(?:TOPICAL|PASTE|OINTMENT|OINT|CREAM|CRM|GEL|LOTION)\b/g, '');
  return name.replace(/\s+/g, ' ').trim() || 'MEDICATION';
}

/**
 * Checks whether the treatment order has both routine and PRN directions.
 */
function hasRoutineAndPrn(rawProse: string): boolean {
  const upper = rawProse.toUpperCase();
  const hasPrn = /\b(?:PRN|AS\s+NEEDED)\b/.test(upper);
  const hasRoutine = /\b(?:EVERY\s+SHIFT|Q\/SHIFT|DAILY|ONCE\s+A\s+DAY|QD|BID|TID|QID|Q12H|Q8H|Q6H|Q4H|EVERY\s+DAY|EVERY\s+EVENING|AT\s+BEDTIME)\b/.test(upper);
  return hasPrn && hasRoutine;
}

/**
 * Builds a treatment SIG clause with progressive condensing levels:
 * Level 0: Standard wording with spaces after commas and colons
 * Level 1: Compact punctuation (no space after comma/colon), W/ abbreviations
 * Level 2: Tight phrasing (e.g. W/SOAP&WATER)
 * Level 3: Omit site prefix on secondary/PRN split if needed to fit under limit
 */
function assembleTreatmentSigClause(params: {
  sitePrefix?: string;
  cleansing?: { standard: string; condensed: string; tight: string };
  patDry: boolean;
  drugApp?: string;
  leaveOta?: boolean;
  frequencyCode?: string; // e.g. "QS" or "PRN"
  condenseLevel: number;
}): string {
  const { sitePrefix, cleansing, patDry, drugApp, leaveOta, frequencyCode, condenseLevel } = params;

  const parts: string[] = [];

  if (cleansing) {
    if (condenseLevel >= 2) {
      parts.push(cleansing.tight);
    } else if (condenseLevel >= 1) {
      parts.push(cleansing.condensed);
    } else {
      parts.push(cleansing.standard);
    }
  }

  if (patDry) {
    parts.push('PAT DRY');
  }

  if (drugApp) {
    parts.push(`THEN APPLY ${drugApp}`);
  } else if (leaveOta) {
    parts.push('THEN LEAVE OPEN TO AIR');
  }

  const joiner = condenseLevel >= 1 ? ',' : ', ';
  let body = parts.join(joiner);

  // Append frequency code with space if present
  if (frequencyCode) {
    if (body) {
      body = `${body} ${frequencyCode}`;
    } else {
      body = frequencyCode;
    }
  }

  if (sitePrefix) {
    const colon = condenseLevel >= 1 ? ':' : ': ';
    return `${sitePrefix}${colon}${body}`;
  }
  return body;
}

/**
 * Parses and translates a treatment order into structured SIG.
 */
export function processTreatmentOrder(drugName: string, rawProse: string): TreatmentParseResult {
  const abnormalities: AbnormalityFinding[] = [];
  const upperProse = rawProse.toUpperCase();

  const site = extractTreatmentSite(rawProse);
  const sitePrefix = site ? `TO ${site}` : undefined;

  const cleansing = extractCleansingPhrase(rawProse);
  const patDry = /\bPAT\s+DRY\b/i.test(upperProse);
  const leaveOta = /\b(?:LEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)|LOTA)\b/i.test(upperProse);
  const hasApp = /\b(?:APPLY|PUT)\b/i.test(upperProse) || !leaveOta;
  const drugApp = hasApp ? extractDrugShortName(drugName, rawProse) : undefined;

  const isSplit = hasRoutineAndPrn(rawProse);

  // Determine routine frequency code:
  // "every shift" / "q/shift" -> "QS"
  // "once a day" / "daily" -> "QD"
  // "twice a day" / "bid" -> "BID"
  let routineFreq = 'QS';
  if (/\b(?:EVERY\s+SHIFT|Q\/SHIFT)\b/i.test(upperProse)) {
    routineFreq = 'QS';
  } else if (/\b(?:TWICE\s+(?:A\s+DAY|DAILY)|BID)\b/i.test(upperProse)) {
    routineFreq = 'BID';
  } else if (/\b(?:THREE\s+TIMES\s+(?:A\s+DAY|DAILY)|TID)\b/i.test(upperProse)) {
    routineFreq = 'TID';
  } else if (/\b(?:ONCE\s+(?:A\s+)?DAY|DAILY|QD)\b/i.test(upperProse)) {
    routineFreq = 'QD';
  }

  // Check if a frequency is specified at all
  const hasAnyFreq = /\b(?:EVERY\s+SHIFT|Q\/SHIFT|DAILY|ONCE\s+A\s+DAY|QD|BID|TID|QID|AS\s+NEEDED|PRN|AT\s+BEDTIME)\b/i.test(upperProse);

  if (isSplit) {
    let routineSig = '';
    let prnSig = '';
    let combinedSig = '';

    // Progressive condensation: levels 1 to 3
    // For treatment orders, character conservation is by design (level >= 1)
    for (let level = 1; level <= 3; level++) {
      const routineSite = sitePrefix;
      // On split 2 (PRN), include sitePrefix if level < 3, but if level === 3, omit sitePrefix on split 2 to conserve characters
      const prnSite = level >= 3 ? undefined : sitePrefix;

      routineSig = assembleTreatmentSigClause({
        sitePrefix: routineSite,
        cleansing,
        patDry,
        drugApp,
        leaveOta,
        frequencyCode: routineFreq,
        condenseLevel: level,
      });

      prnSig = assembleTreatmentSigClause({
        sitePrefix: prnSite,
        cleansing,
        patDry,
        drugApp,
        leaveOta,
        frequencyCode: 'PRN',
        condenseLevel: level,
      });

      combinedSig = `${routineSig} **SPLIT** ${prnSig}`;
      // In FrameworkLTC, each split Sig line cannot exceed 199 characters
      if (routineSig.length <= 199 && prnSig.length <= 199) {
        break;
      }
    }

    abnormalities.push({
      id: `treatment_order_split_${Date.now()}`,
      tier: 'applied_correction',
      title: 'Treatment Order Split Applied',
      message: 'Treatment order with routine and PRN directions split into separate sub-orders with character conservation applied.',
      correction: combinedSig,
      trigger: rawProse,
    });

    return {
      isTreatment: true,
      primarySig: combinedSig,
      subOrders: [
        { label: 'Order 1 of 2', sig: routineSig },
        { label: 'Order 2 of 2', sig: prnSig },
      ],
      abnormalities,
    };
  }

  // Single treatment order (not routine + PRN)
  let freqCode: string | undefined = hasAnyFreq ? routineFreq : undefined;
  if (/\b(?:AS\s+NEEDED|PRN)\b/i.test(upperProse) && !/\b(?:EVERY\s+SHIFT|Q\/SHIFT|DAILY|BID)\b/i.test(upperProse)) {
    freqCode = 'PRN';
  }

  let singleSig = '';
  for (let level = 1; level <= 3; level++) {
    singleSig = assembleTreatmentSigClause({
      sitePrefix,
      cleansing,
      patDry,
      drugApp,
      leaveOta,
      frequencyCode: freqCode,
      condenseLevel: level,
    });
    if (singleSig.length <= 199) break;
  }

  abnormalities.push({
    id: `treatment_order_${Date.now()}`,
    tier: 'applied_correction',
    title: 'Treatment Order Format Applied',
    message: 'Treatment directions formatted with character conservation rules.',
    correction: singleSig,
    trigger: rawProse,
  });

  return {
    isTreatment: true,
    primarySig: singleSig,
    subOrders: [
      { label: 'Order 1 of 1', sig: singleSig },
    ],
    abnormalities,
  };
}
