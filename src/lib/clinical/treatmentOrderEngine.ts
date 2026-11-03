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

  // Must contain wound care / treatment order procedural markers
  const hasCleanse = /\bCLEANSE\b/i.test(upperProse);
  const hasPatDry = /\bPAT\s+DRY\b/i.test(upperProse);
  const hasLeaveOta = /\bLEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)\b/i.test(upperProse);
  const hasWoundCare = /\b(?:WOUND\s+CLEANSER|WOUND\s+CARE|WOUND\s+DRESSING)\b/i.test(upperProse);
  const hasDressing = /\b(?:XEROFORM|KERLIX|GAUZE|WRAP)\b/i.test(upperProse);

  if (!hasCleanse && !hasPatDry && !hasLeaveOta && !hasWoundCare) {
    return undefined;
  }

  // 1. Site extraction:
  let site = '';
  const siteMatch1 = upperProse.match(
    /\b(?:APPLY\s+(?:TOPICALLY\s+)?TO)\s+(?:THE\s+)?([\s\S]+?)(?=\s+(?:TOPICALLY|TPCL|EVERY|EACH|DAILY|TWICE|THREE|FOUR|\d+\s+TIMES|BID|TID|QID|QD|FOR|AS\s+NEEDED|CLEANSE)\b|[.;]|$)/i
  );
  const siteMatch2 = upperProse.match(/\bCLEANSE\s+(?:THE\s+)?([A-Z0-9 /-]+?)\s+(?:WITH|W\/)\b/i);
  const siteMatch3 = upperProse.match(/\bTO\s+(?:THE\s+)?([A-Z0-9 /-]+?):/i);

  if (siteMatch1 && siteMatch1[1].trim()) {
    site = siteMatch1[1].trim();
  } else if (siteMatch2 && siteMatch2[1].trim()) {
    site = siteMatch2[1].trim();
  } else if (siteMatch3 && siteMatch3[1].trim()) {
    site = siteMatch3[1].trim();
  }

  if (site) {
    site = site.replace(/\bLEFT\b/g, 'LT').replace(/\bRIGHT\b/g, 'RT').replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();
  }

  // 2. Cleanser extraction:
  let cleanser = '';
  const cleanseMatch = upperProse.match(
    /\bCLEANSE\s+(?:(?:THE\s+)?[A-Z0-9 /-]+?\s+)?(?:WITH|W\/)\s*([A-Z0-9 /&-]+?)(?=\s*[,.;]|\s+(?:THEN\b|PAT\s+DRY\b|LEAVE\b|APPLY\b|COVER\b|WRAP\b)|$)/i
  );
  if (cleanseMatch) {
    cleanser = cleanseMatch[1].trim();
  } else if (/\bWITH\s+WOUND\s+CLEANSER\b/i.test(upperProse)) {
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
    } else if (/\b(?:WOUND\s+CLEANSER)\b/i.test(cleanser)) {
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
      /\b(?:THEN\s+)?APPLY\s+([A-Z0-9 /-]+?)(?=\s+(?:EVERY|EACH|DAILY|TWICE|THREE|FOUR|Q[/-]|QS|QD|BID|TID|QID|QAM|QPM|QHS|PRN|AS\s+NEEDED|AND\s+PRN)\b|[.,;]|$)/i
    );
    if (applyMatch && applyMatch[1].trim() && !/^(?:THE\s+)?(?:SACRUM|WOUND|SITE)\b/i.test(applyMatch[1].trim())) {
      applyDrug = applyMatch[1].trim();
    } else if (!isDressingOrSupply) {
      // Core drug from product name
      applyDrug = upperDrug.replace(/\b(?:TOPICAL|PASTE|OINTMENT|CREAM|LOTION|GEL|SOLUTION|BARRIER|SPRAY|\d+%\s*.*).*$/i, '').trim();
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

  let wrap = '';
  const wrapMatch = upperProse.match(
    /\bWRAP\s+(?:WITH|W\/)\s*([A-Z0-9 /&-]+?)(?=\s*[,.;]|\s+(?:AND|THEN|EVERY|EACH|DAILY|ONCE|TWICE|THREE|FOUR|Q[/-]|QS|QD|BID|TID|QID|QOD|Q3D|QAM|QPM|QHS|PRN|AS\s+NEEDED)\b|$)/i
  );
  if (wrapMatch) {
    wrap = wrapMatch[1].trim();
  }

  // 5. Schedules & Split detection:
  const hasShift = /\b(?:EVERY\s+SHIFT|Q[/-]?SHIFT|QS)\b/i.test(upperProse);
  const hasDaily = /\b(?:DAILY|ONCE\s+(?:A\s+)?DAY|EVERY\s+DAY|QD)\b/i.test(upperProse);
  const hasBid = /\b(?:TWICE\s+(?:DAILY|A\s+)?DAY|2\s+TIMES\s+(?:A|PER)\s+DAY|BID)\b/i.test(upperProse);
  const hasTid = /\b(?:THREE\s+TIMES\s+(?:A|PER)\s+DAY|3\s+TIMES\s+(?:A|PER)\s+DAY|TID)\b/i.test(upperProse);
  const hasQid = /\b(?:FOUR\s+TIMES\s+(?:A|PER)\s+DAY|4\s+TIMES\s+(?:A|PER)\s+DAY|QID)\b/i.test(upperProse);
  const hasQhs = /\b(?:AT\s+BEDTIME|BEDTIME|QHS)\b/i.test(upperProse);
  const hasQam = /\b(?:IN\s+THE\s+MORNING|EVERY\s+MORNING|QAM)\b/i.test(upperProse);
  const hasQod = /\b(?:EVERY\s+OTHER\s+DAY|QOD)\b/i.test(upperProse);
  const hasQ3d = /\b(?:EVERY\s+(?:3|THREE)\s+DAYS?|Q3D)\b/i.test(upperProse);
  const hasBiw = /\b(?:TWICE\s+(?:A\s+)?WEEK|2\s+TIMES\s+(?:A|PER)\s+WEEK|BIW)\b/i.test(upperProse);
  const hasWeekly = /\b(?:WEEKLY|ONCE\s+(?:A\s+)?WEEK|QWEEK)\b/i.test(upperProse);
  const hasPrn = /\b(?:AS\s+NEEDED|PRN|AND\s+PRN)\b/i.test(upperProse);

  const routineFreq = hasShift ? 'QS'
    : hasQ3d ? 'Q3D'
    : hasQod ? 'QOD'
    : hasBiw ? 'BIW'
    : hasWeekly ? 'QWEEK'
    : hasDaily ? 'QD'
    : hasBid ? 'BID'
    : hasTid ? 'TID'
    : hasQid ? 'QID'
    : hasQhs ? 'QHS'
    : hasQam ? 'QAM'
    : '';

  const isSplit = Boolean(routineFreq && hasPrn);

  function formatSig(freqToken: string): string {
    const proceduralParts: string[] = [];
    if (cleanser) {
      proceduralParts.push(`CLEANSE W/${cleanser}`);
    }
    if (hasPatDry) {
      proceduralParts.push('PAT DRY');
    }
    if (hasLeaveOta) {
      proceduralParts.push('THEN LEAVE OPEN TO AIR');
    } else if (applyDrug) {
      proceduralParts.push(`THEN APPLY ${applyDrug}`);
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
    return full;
  }

  const abnormalities: AbnormalityFinding[] = [];

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
