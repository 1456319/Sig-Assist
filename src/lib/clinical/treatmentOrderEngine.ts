import { AbnormalityFinding } from './types';

export interface TreatmentSplitPart {
  readonly label: string;
  readonly sig: string;
  readonly abnormalities: AbnormalityFinding[];
}

export interface TreatmentOrderEvaluation {
  readonly isTreatment: boolean;
  readonly isSplit: boolean;
  readonly singleSig?: string;
  readonly splitParts: readonly TreatmentSplitPart[];
  readonly abnormalities: AbnormalityFinding[];
}

/**
 * Recognizes wound care treatment orders (cleansing, pat dry, topical barrier/medication,
 * dressing, or leave open to air) and formats them into condensed, compliant SIGs.
 */
export function resolveTreatmentOrder(drugName: string, rawProse: string): TreatmentOrderEvaluation | undefined {
  const upperProse = rawProse.toUpperCase().replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();
  const upperDrug = drugName.toUpperCase().trim();

  // Exclude oral solid/liquid formulations and explicit oral administration instructions
  const isOralDosageForm =
    /\b(?:CAPSULE|CAP|TABLET|TAB|SUSPENSION|SYRUP|ELIXIR)\b/i.test(upperDrug) &&
    !/\b(?:TOPICAL|POWDER\s+FOR\s+TOPICAL)\b/i.test(upperDrug);
  const hasOralProse = /\b(?:BY\s+MOUTH|PO|SWALLOW|TAKE\s+\d+|TAKE\s+ONE|TAKE\s+TWO)\b/i.test(upperProse);

  if (isOralDosageForm || hasOralProse) {
    return undefined;
  }

  // Must contain wound care / treatment order procedural markers
  const hasCleanse = /\bCLEANSE\b/i.test(upperProse);
  const hasPatDry = /\bPAT\s+DRY\b/i.test(upperProse);
  const hasLeaveOta = /\bLEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)\b/i.test(upperProse);
  const hasWoundCleanser = /\b(?:WOUND\s+CLEANSER|WOUND\s+DRESSING)\b/i.test(upperProse);
  const hasDressingVerb = /\b(?:COVER|WRAP|DRESS)\s+(?:WITH|W\/)\b/i.test(upperProse);
  const hasDressing = /\b(?:XEROFORM|KERLIX|GAUZE|WRAP|MEPILEX|TEGADERM)\b/i.test(upperProse);
  const hasTopicalWoundTreatment =
    /\b(?:APPLY\s+TOPICALLY|APPLY\s+TO)\b/i.test(upperProse) &&
    /\b(?:WOUND|MASD|SACRUM|ULCER|PRESSURE\s+INJURY|PRESSURE\s+SORE)\b/i.test(upperProse);

  if (!hasCleanse && !hasPatDry && !hasLeaveOta && !hasWoundCleanser && !hasDressingVerb && !hasTopicalWoundTreatment) {
    return undefined;
  }

  // 1. Site extraction:
  let site = '';
  const siteMatch1 = upperProse.match(
    /\b(?:APPLY\s+(?:TOPICALLY\s+)?TO)\s+(?:THE\s+)?([\s\S]+?)(?=\s+(?:TOPICALLY|TPCL|EVERY|EACH|DAILY|TWICE|THREE|FOUR|\d+\s+TIMES|BID|TID|QID|QD|FOR|AS\s+NEEDED|THEN|CLEANSE|PAT\s+DRY|LEAVE\s+OPEN|LEAVE\s+OTA|COVER|WRAP|AND\s+(?:LEAVE|CLEANSE|PAT|APPLY|COVER|WRAP))\b|[.;]|$)/i
  );
  const siteMatch2 = upperProse.match(
    /\bCLEANSE\s+(?:(?:THE\s+)?(?:WOUND|SITE|SKIN)\s+(?:ON|AT|IN|OF)\s+(?:THE\s+)?)?([A-Z0-9 /-]+?)\s+(?:WITH|W\/)\b/i
  );
  const siteMatch3 = upperProse.match(/\bTO\s+(?:THE\s+)?([A-Z0-9 /-]+?):/i);

  if (siteMatch1 && siteMatch1[1].trim()) {
    site = siteMatch1[1].trim();
  } else if (siteMatch2 && siteMatch2[1].trim()) {
    site = siteMatch2[1].trim();
  } else if (siteMatch3 && siteMatch3[1].trim()) {
    site = siteMatch3[1].trim();
  }

  if (site) {
    site = site
      .replace(/\bBILATERAL\b/g, 'BIL')
      .replace(/\bB\/L\b/g, 'BIL')
      .replace(/\bLEFT\b/g, 'LT')
      .replace(/\bRIGHT\b/g, 'RT')
      .replace(/\s+AND\s+/g, '/')
      .replace(/^[.,;:\s]+|[.,;:\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 2. Cleanser extraction:
  let cleanser = '';
  const cleanseMatch = upperProse.match(
    /\bCLEANSE\s+(?:(?:THE\s+)?[A-Z0-9 /-]+?\s+)?(?:WITH|W\/)\s*([A-Z0-9 /&-]+?)(?=\s*[,.;]|\s+(?:THEN\b|PAT\s+DRY\b|LEAVE\b|APPLY\b|COVER\b|WRAP\b)|$)/i
  );
  if (cleanseMatch) {
    cleanser = cleanseMatch[1].trim();
  } else if (/\bWITH\s+WOUND\s+CLEANSER\b/i.test(upperProse) || /\b(?:WITH|W\/)\s+VASHE\b/i.test(upperProse)) {
    cleanser = 'WOUND CLEANSER';
  } else if (/\bWITH\s+(?:SOAP\s+(?:AND|&)\s+WATER)\b/i.test(upperProse)) {
    cleanser = 'SOAP AND WATER';
  } else if (/\bWITH\s+(?:NORMAL\s+SALINE|SALINE|NS|0\.9%\s+SODIUM\s+CHLORIDE)\b/i.test(upperProse)) {
    cleanser = 'NORMAL SALINE';
  }

  if (cleanser) {
    if (/\b(?:NORMAL\s+SALINE|0\.9%\s+SODIUM\s+CHLORIDE)\b/i.test(cleanser)) {
      cleanser = 'NORMAL SALINE';
    } else if (/\b(?:SOAP\s+(?:AND|&)\s+WATER)\b/i.test(cleanser)) {
      cleanser = 'SOAP AND WATER';
    } else if (/\b(?:WOUND\s+CLEANSER|VASHE)\b/i.test(cleanser)) {
      cleanser = 'WOUND CLEANSER';
    }
  }

  // 3. Drug application extraction:
  let applyDrug = '';
  const isDressingOrSupply = /\b(?:GAUZE|KERLIX|XEROFORM|WRAP|BANDAGE|DRESSING|TAPE|CLEANSER|SALINE|PAD|MEPILEX|TEGADERM)\b/i.test(upperDrug);
  if (!hasLeaveOta) {
    const postCleanseIdx = upperProse.search(/\b(?:CLEANSE|PAT\s+DRY)\b/);
    const searchScope = postCleanseIdx >= 0 ? upperProse.slice(postCleanseIdx) : upperProse;
    const applyMatch = searchScope.match(
      /\b(?:THEN\s+)?APPLY\s+([A-Z0-9 /-]+?)(?=\s+(?:EVERY|EACH|DAILY|TWICE|THREE|FOUR|\d+\s+TIMES|Q[/-]|QS|QD|BID|TID|QID|QAM|QPM|QHS|PRN|AS\s+NEEDED|AND\s+PRN)\b|[.,;]|$)/i
    );
    if (
      applyMatch &&
      applyMatch[1].trim() &&
      !/^(?:THE\s+)?(?:SACRUM|WOUND|SITE|AFFECTED\s+AREA)\b/i.test(applyMatch[1].trim()) &&
      !/^(?:TOPICALLY|TPCL|TO\b|A\s+THIN\s+LAYER|THIN\s+LAYER|LIBERALLY|SPARINGLY|GENEROUSLY|EVENLY|AS\s+DIRECTED|OINTMENT|CREAM|PASTE|LOTION|GEL|BARRIER|MEDICATION)\b/i.test(applyMatch[1].trim())
    ) {
      applyDrug = applyMatch[1].trim();
    } else if (!isDressingOrSupply) {
      // Core drug from product name, cleanly stripping topical forms and decimal percentages
      applyDrug = upperDrug
        .replace(/\b(?:TOPICAL|PASTE|OINTMENT|CREAM|LOTION|GEL|SOLUTION|BARRIER|SPRAY)\b/gi, '')
        .replace(/(?:\d+(?:\.\d+)?\s*%|\b\d+\s*%).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // 4. Dressing & Wrap:
  let dressing = '';
  const dressingMatch = upperProse.match(
    /\b(?:COVER|DRESS)\s+(?:WITH|W\/)\s*([A-Z0-9 /&-]+?)(?=\s*[,.;]|\s+(?:AND|THEN|WRAP|EVERY|EACH|DAILY|ONCE|TWICE|THREE|FOUR|Q[/-]|QS|QD|BID|TID|QID|QOD|Q3D|QAM|QPM|QHS|PRN|AS\s+NEEDED)\b|$)/i
  );
  if (dressingMatch) {
    dressing = dressingMatch[1].trim();
  } else if (hasDressing) {
    const dMatch = upperProse.match(/\b(XEROFORM|KERLIX|GAUZE)\b/i);
    if (dMatch) dressing = dMatch[1].trim();
  }

  // Deduplicate if product is a dressing/supply and applyDrug matches dressing
  if (isDressingOrSupply && applyDrug && dressing && (dressing.includes(applyDrug) || applyDrug.includes(dressing))) {
    applyDrug = '';
  }

  let wrap = '';
  const wrapMatch = upperProse.match(
    /\bWRAP\s+(?:WITH|W\/)\s*([A-Z0-9 /&-]+?)(?=\s*[,.;]|\s+(?:AND|THEN|EVERY|EACH|DAILY|ONCE|TWICE|THREE|FOUR|Q[/-]|QS|QD|BID|TID|QID|QOD|Q3D|QAM|QPM|QHS|PRN|AS\s+NEEDED)\b|$)/i
  );
  if (wrapMatch) {
    wrap = wrapMatch[1].trim();
  }

  // 5. Schedules & Split detection:
  const hasShift = /\b(?:EVERY\s+SHIFT|Q[/-]?SHIFT|QS)\b/i.test(upperProse);
  const hasQid = /\b(?:FOUR\s+TIMES\s+(?:A\s+DAY|DAILY)|4\s+TIMES\s+(?:A|PER)\s+DAY|QID)\b/i.test(upperProse);
  const hasTid = /\b(?:THREE\s+TIMES\s+(?:A\s+DAY|DAILY)|3\s+TIMES\s+(?:A|PER)\s+DAY|TID)\b/i.test(upperProse);
  const hasBid = /\b(?:TWICE\s+(?:A\s+DAY|DAILY)|2\s+TIMES\s+(?:A|PER)\s+DAY|BID)\b/i.test(upperProse);
  const hasQ3d = /\b(?:EVERY\s+(?:3|THREE)\s+DAYS?|Q3D)\b/i.test(upperProse);
  const hasQod = /\b(?:EVERY\s+OTHER\s+DAY|QOD)\b/i.test(upperProse);
  const hasBiw = /\b(?:TWICE\s+(?:A\s+)?WEEK|2\s+TIMES\s+(?:A|PER)\s+WEEK|BIW)\b/i.test(upperProse);
  const hasWeekly = /\b(?:WEEKLY|ONCE\s+(?:A\s+)?WEEK|QWEEK)\b/i.test(upperProse);
  const hasQhs = /\b(?:AT\s+BEDTIME|BEDTIME|QHS)\b/i.test(upperProse);
  const hasQam = /\b(?:IN\s+THE\s+MORNING|EVERY\s+MORNING|QAM)\b/i.test(upperProse);
  const hasDaily = /\b(?:DAILY|ONCE\s+(?:A\s+)?DAY|EVERY\s+DAY|QD)\b/i.test(upperProse);
  const hasPrn = /\b(?:AS\s+NEEDED|PRN|AND\s+PRN)\b/i.test(upperProse);

  // Multi-dose schedules evaluated before QD to prevent substring collision with DAILY
  const routineFreq = hasShift ? 'QS'
    : hasQid ? 'QID'
    : hasTid ? 'TID'
    : hasBid ? 'BID'
    : hasQ3d ? 'Q3D'
    : hasQod ? 'QOD'
    : hasBiw ? 'BIW'
    : hasWeekly ? 'QWEEK'
    : hasQhs ? 'QHS'
    : hasQam ? 'QAM'
    : hasDaily ? 'QD'
    : '';

  const isSplit = Boolean(routineFreq && hasPrn);
  const abnormalities: AbnormalityFinding[] = [];

  function formatSig(freqToken: string): string {
    const proceduralParts: string[] = [];
    if (cleanser) {
      proceduralParts.push(`CLEANSE W/${cleanser}`);
    }
    if (hasPatDry) {
      proceduralParts.push('PAT DRY');
    }
    const thenPrefix = proceduralParts.length > 0 ? 'THEN ' : '';
    if (hasLeaveOta) {
      proceduralParts.push(`${thenPrefix}LEAVE OPEN TO AIR`);
    } else if (applyDrug) {
      proceduralParts.push(`${thenPrefix}APPLY ${applyDrug}`);
    }
    if (dressing) {
      proceduralParts.push(`COVER W/${dressing}`);
    }
    if (wrap) {
      proceduralParts.push(`WRAP W/${wrap}`);
    }

    const proceduralString = proceduralParts.join(',');
    const withSite = site ? `TO ${site}:${proceduralString}` : proceduralString;
    let full = `${withSite} ${freqToken}`.trim();

    // Progressive condensation if exceeding 199 characters
    if (full.length > 199) {
      full = full.replace(/\bSOAP AND WATER\b/g, 'SOAP&WATER');
      full = full.replace(/\bNORMAL SALINE\b/g, 'NS');
      full = full.replace(/\bWOUND CLEANSER\b/g, 'WOUND CLNSR');
      full = full.replace(/\bAND\b/g, '&');
      full = full.replace(/\bLEAVE OPEN TO AIR\b/g, 'LEAVE OTA');
      full = full.replace(/\bTHEN APPLY\b/g, 'APPLY');
      full = full.replace(/\bCOVER W\/\b/g, 'COVER:');
    }

    if (full.length > 199) {
      full = full.replace(/\bWITH\b/g, 'W/');
      full = full.replace(/\bPRESSURE\s+INJURY\b/g, 'PI');
      full = full.replace(/\bPRESSURE\s+ULCER\b/g, 'PU');
      full = full.replace(/\bSURROUNDING\b/g, 'SURR');
      full = full.replace(/\bEXTREMITIES\b/g, 'EXTS');
      full = full.replace(/\bEXTREMITY\b/g, 'EXT');
    }

    if (full.length > 199) {
      abnormalities.push({
        id: 'treatment_order_length_exceeded',
        tier: 'potential_error',
        title: 'Treatment Sig Exceeds 199 Characters',
        message: `The formatted treatment order is ${full.length} characters long and exceeds FrameworkLTC's 199-character limit. Manual technician condensation required.`,
        trigger: full
      });
      full = full.slice(0, 199);
    }

    return full;
  }

  if (isSplit) {
    const splitParts: TreatmentSplitPart[] = [
      {
        label: 'Order 1 of 2 (Routine)',
        sig: formatSig(routineFreq),
        abnormalities: []
      },
      {
        label: 'Order 2 of 2 (PRN)',
        sig: formatSig('PRN'),
        abnormalities: []
      }
    ];

    return {
      isTreatment: true,
      isSplit: true,
      splitParts,
      abnormalities
    };
  }

  const freq = routineFreq || (hasPrn ? 'PRN' : 'QS');
  const singleSig = formatSig(freq);

  return {
    isTreatment: true,
    isSplit: false,
    singleSig,
    splitParts: [],
    abnormalities
  };
}
