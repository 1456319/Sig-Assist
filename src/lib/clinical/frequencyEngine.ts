import { AbnormalityFinding } from './types';
import { traceLogger } from '../diagnostics/traceLogger';
import { splitSupplementalDirections } from './instructionClauses';
import { extractIndicationToken, administrationScheduleProse } from './indicationEngine';
import { resolveWeekdaySchedule } from './weekdaySchedule';
import { resolveDuration } from './durationEngine';
import { SIG_CODE_REFERENCE } from './sigCodeReference';
import { normalizeNumericDirections } from './numericDirections';
import { hourlySchedule } from './hourlySchedule';

export interface FrequencyScheduleResult {
  readonly frequencyToken: string;
  readonly durationToken?: string;
  readonly prnToken?: string;
  readonly indicationToken?: string;
  readonly holdToken?: string;
  readonly stopToken?: string;
  readonly slidingScaleString?: string;
  readonly blendedTemplate?: string;
  readonly abnormalities: AbnormalityFinding[];
  readonly requiresManualTranslation?: boolean;
}

function resolveFrequencyAndScheduleInternal(rawProse: string, defaultTemplate?: string): FrequencyScheduleResult {
  let upper = normalizeNumericDirections(splitSupplementalDirections(rawProse).primary)
    .replace(/\b(?:AS NEEDED|PRN)\s+FOR\s+(QD|BID|TID|QID|Q\d+H)\s+PRN\s+FOR\b/g, '$1 PRN FOR')
    .replace(/\bDAY\(S\)/g, 'DAYS')
    .replace(/\b(?:VIA|USING|WITH)\s+(?:A\s+)?NEBULI[ZS]ER\b/g, '').trim();
  const abnormalities: AbnormalityFinding[] = [];

  if (!upper.trim()) {
    abnormalities.push({
      id: `abn_freq_empty_${Date.now()}`,
      tier: 'potential_error',
      title: 'Missing Frequency',
      message: 'Original directions are empty or missing frequency directives.',
      trigger: 'Empty directions'
    });
    return {
      frequencyToken: '',
      abnormalities
    };
  }

  // Sliding scale insulin check
  if (upper.includes('SLIDING SCALE')) {
    // Keep named-recipient notifications verbatim, including their phone number
    // and threshold. Only detach a fully understood terminal notification.
    const namedCall = '(?:CALL|NOTIFY)\\s+DR\\.?\\s+[A-Z][A-Z.\' -]*?\\s+AT\\s+\\d{3}[ .-]\\d{3}[ .-]\\d{4}';
    const terminalCall = upper.match(new RegExp(`\\b${namedCall}\\s+WITH ALL (?:BLOOD )?GLUCOSE LEVELS (?:GREATER THAN|LESS THAN) \\d+[.]?$`));
    if (terminalCall) upper = upper.slice(0, terminalCall.index).trim();
    if (/\b\d+\s+UNIS\b/.test(upper)) {
      upper = upper.replace(/\bUNIS\b/g, 'UNITS');
      abnormalities.push({ id: 'insulin_unit_typo', tier: 'applied_correction', title: 'Insulin Unit Typo Normalized',
        message: 'UNIS was interpreted as UNITS on the numeric insulin scale. Verify the original electronic hardcopy before copying.', trigger: 'Numeric insulin scale specifies UNIS' });
    }
    const isAcHs = /\b(BEDTIME|HS|ACHS)\b/i.test(upper);
    const prefix = isAcHs ? 'CBS ACHS SS' : 'CBS AC SS';

    if (upper.includes('ML')) {
      abnormalities.push({
        id: `abn_ss_ml_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Insulin Volume Normalization',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Normalized mL volume to Units (U)',
        trigger: 'Prescriber specified mL instead of Units on insulin order'
      });
    }

    const segments: Array<{ sortKey: number; text: string }> = [];
    const translatedMarkers = new Set<number>();
    let unrecognizedNotification = false;

    // Hypoglycemic protocol / low MD call
    const lowMatch = upper.match(/(?:<|LESS THAN)\s*(\d+)[^;,\n]*(?:HYPOGLYCEMIC PROTOCOL|NOTIFY MD|CALL MD)/i);
    if (lowMatch) {
      const val = parseInt(lowMatch[1], 10);
      const action = /HYPOGLYCEMIC/.test(lowMatch[0]) ? `HYPOGLYCEMIC PROTOCOL${/CALL MD|NOTIFY MD/.test(lowMatch[0]) ? '&CALL MD' : ''}` : 'CALL MD';
      segments.push({ sortKey: val, text: `<${val}=${action}` });
      translatedMarkers.add(lowMatch.index!);
    }

    // Bracket matches: 181 - 200 = 1 unit or 200 - 300 = 5ml
    const bracketRegex = /(\d+)\s*-\s*(\d+)\s*=\s*(\d+)\s*(?:UNITS?|U|ML)\b/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bracketRegex.exec(upper)) !== null) {
      const low = parseInt(bMatch[1], 10);
      const high = parseInt(bMatch[2], 10);
      const units = parseInt(bMatch[3], 10);
      const tail = upper.slice(bMatch.index + bMatch[0].length);
      const notification = tail.match(new RegExp(`^\\s+(${namedCall})(?=\\s*[,;]|\\s*$)`));
      segments.push({ sortKey: low, text: `${low}-${high}=${units}U${notification ? ` ${notification[1]}` : ''}` });
      translatedMarkers.add(bMatch.index);
    }

    // High threshold: > 350 = 5 units or Greater than 500 notify MD
    const highActionMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)[^;,\n]*(?:NOTIFY MD|CALL MD)/i);
    if (highActionMatch) {
      const val = parseInt(highActionMatch[1], 10);
      segments.push({ sortKey: val + 1000, text: `>${val}=CALL MD` });
      translatedMarkers.add(highActionMatch.index!);
      if (/\b(?:ADMINISTER|GIVE)\b/.test(highActionMatch[0])) unrecognizedNotification = true;
    } else {
      const highUnitMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)\s*=\s*(\d+)\s*(?:UNITS?|U)\b/i);
      if (highUnitMatch) {
        const val = parseInt(highUnitMatch[1], 10);
        const units = parseInt(highUnitMatch[2], 10);
        segments.push({ sortKey: val + 1000, text: `>${val}=${units}U` });
        translatedMarkers.add(highUnitMatch.index!);
      }
    }

    // Inclusive plus thresholds retain both dose and notification recipient.
    for (const match of upper.matchAll(/\b(\d+)\s*\+\s*=\s*(\d+)\s*(?:UNITS?|U)\b/g)) {
      const tail = upper.slice(match.index! + match[0].length).split(/[;,]/)[0];
      const notify = tail.match(/\b(?:NOTIFY|CALL)\s+(MD|NP\s*\/\s*PA|PA\s*\/\s*NP|NP|PA|PROVIDER|PRESCRIBER|PHYSICIAN)\b/);
      if (/\b(?:NOTIFY|CALL)\b/.test(tail) && !notify) unrecognizedNotification = true;
      const action = notify ? `&CALL ${notify[1].replace(/\s*\/\s*/g, '/')}` : '';
      segments.push({ sortKey: Number(match[1]) + 1000, text: `${match[1]}+=${match[2]}U${action}` });
      translatedMarkers.add(match.index!);
    }
    if (highActionMatch && /(?:>|GREATER THAN)\s*\d+\s*=/.test(highActionMatch[0])) {
      const dose = highActionMatch[0].match(/(?:>|GREATER THAN)\s*(\d+)\s*=\s*(\d+)\s*(?:UNITS?|U)\b/);
      if (dose) {
        const high = segments.find(s => s.text === `>${dose[1]}=CALL MD`);
        if (high) high.text = `>${dose[1]}=${dose[2]}U&CALL MD`;
        translatedMarkers.add(highActionMatch.index!);
      }
    }
    for (const match of upper.matchAll(/(?:>\s*(?:OR\s*)?=|GREATER THAN OR EQUAL TO)\s*(\d+)\s*(?:ADMINISTER|GIVE|=)\s*(\d+)\s*(?:UNITS?|U)\b/g)) {
      const tail = upper.slice(match.index! + match[0].length).split(/[;,]/)[0];
      const notify = tail.match(/\b(?:NOTIFY|NOTIFIED|CALL)\s+(MD|NP\s*\/\s*PA|PA\s*\/\s*NP|NP|PA|PROVIDER|PRESCRIBER|PHYSICIAN)\b/);
      if (/\b(?:NOTIFY|NOTIFIED|CALL)\b/.test(tail) && !notify) unrecognizedNotification = true;
      segments.push({ sortKey: Number(match[1]) + 1000, text: `${match[1]}+=${match[2]}U${notify ? `&CALL ${notify[1].replace(/\s*\/\s*/g, '/')}` : ''}` });
      translatedMarkers.add(match.index!);
    }
    // Check all condition starts, not just the successfully parsed bands.
    // Unknown <= thresholds or unsupported doses must retain the complete scale.
    const markers = [...upper.matchAll(/\b\d+\s*-\s*\d+\s*=|\b\d+\s*\+\s*=|(?:[<>]\s*(?:(?:OR\s*)?=)?|(?:GREATER|LESS) THAN(?: OR EQUAL TO)?)\s*\d+/g)];
    const sourceNotifications = [...upper.matchAll(/\b(?:NOTIFY|NOTIFIED|CALL)\b/g)].length;
    const capturedNotifications = segments.filter(s => /\b(?:CALL|NOTIFY)\b/.test(s.text)).length;
    const hasMealSchedule = /\b(?:BEFORE MEALS|AC|ACHS)\b/.test(upper);
    if (!segments.length || !hasMealSchedule || unrecognizedNotification || sourceNotifications > capturedNotifications || markers.some(m => !translatedMarkers.has(m.index!))) {
      abnormalities.push({ id: 'incomplete_sliding_scale', tier: 'uncorrected_gap', title: 'Incomplete Sliding Scale',
        message: 'At least one scale band or notification could not be translated. Original directions were retained; no partial scale was proposed.', trigger: rawProse });
      return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
    }
    segments.sort((a, b) => a.sortKey - b.sortKey);
    const scaleDuration = resolveDuration(upper);
    if (scaleDuration.unsupported) return { frequencyToken: '', abnormalities: [...abnormalities, ...scaleDuration.abnormalities], requiresManualTranslation: true };
    const lastIndication = upper.match(/\bFOR\s+((?:T1DM|DMII|DM2?|TYPE [12] DIABETES))\s*$/)?.[0];
    const route = /\bSUBCUTANEOUS(?:LY)?\b/.test(upper) ? 'SQ' : '';
    const scale = [prefix, segments.map(s => s.text).join(';'), route, scaleDuration.token, lastIndication ? extractIndicationToken(lastIndication) : ''].filter(Boolean).join(' ');
    const slidingScaleString = terminalCall ? `${scale}. ${terminalCall[0]}` : scale;

    return {
      frequencyToken: prefix,
      slidingScaleString,
      abnormalities
    };
  }

  // Hold parameters
  let holdToken: string | undefined;
  if (upper.includes('HOLD FOR SBP LESS THAN 100 OR HEART RATE LESS THAN 60')) {
    holdToken = 'HR60SBP100';
  } else if (/HOLD\s+(?:IF|FOR)\s+SBP\s*(?:<|LESS\s+THAN)\s*100/i.test(upper)) {
    holdToken = 'SBP100';
  } else if (upper.includes('HOLD IF MORE THAN 2 BOWEL MOVEMENT')) {
    holdToken = '(H >2 BOWEL MOVEMENTS DAILY)';
  } else {
    const genericHoldMatch = upper.match(/\b(HOLD\s+(?:IF|FOR|WHEN)\s+[^;,\n.]+)/i);
    if (genericHoldMatch) {
      holdToken = `(${genericHoldMatch[1].trim()})`;
    }
  }

  if (holdToken) {
    abnormalities.push({
      id: `abn_hold_${Date.now()}`,
      tier: 'applied_correction',
      title: 'Hold Directive Detected',
      message: 'The generated Sig CONTAINS A CLINICAL HOLD PARAMETER.',
      correction: `Preserved hold parameter directive: ${holdToken}`,
      trigger: 'Prescriber specified clinical hold condition'
    });
  }

  // Stop directives
  let stopToken: string | undefined;
  if (/\bTHEN\s+(?:STOP|DISCONTINUE)\b/i.test(upper)) {
    stopToken = 'THEN STOP';
  } else if (/\bUNTIL FINISHED\b/.test(upper)) stopToken = 'UNTIL FINISHED';

  const duration = resolveDuration(upper);
  const administrations = upper.match(/\bFOR\s+(\d+)\s+ADMINISTRATIONS?\b/);
  const durationToken = duration.token || (administrations && administrations[1] !== '1' ? `FOR ${administrations[1]} DOSES` : undefined);
  abnormalities.push(...duration.abnormalities);
  if (duration.unsupported) return { frequencyToken: '', abnormalities, requiresManualTranslation: true };

  // PRN
  const prnToken = upper.includes('AS NEEDED') || /\bPRN\b/i.test(upper) ? 'PRN' : undefined;

  const indicationToken = extractIndicationToken(upper);
  const scheduleProse = administrationScheduleProse(upper);

  // Frequency tokens
  let frequencyToken = '';
  const weekday = resolveWeekdaySchedule(scheduleProse);
  const compoundShift = scheduleProse.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+AND\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  const dayInterval = scheduleProse.match(/\bEVERY\s+(\d+)\s+DAYS?\b/);
  const shift = scheduleProse.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  if (weekday.unsupported) {
    abnormalities.push({ id: 'unsupported_weekday_schedule', tier: 'uncorrected_gap', title: 'Weekday Schedule Requires Review',
      message: 'The complete weekday schedule could not be translated. Original directions were retained; no day or qualifier was discarded.', trigger: rawProse });
    return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
  } else if (administrations && (duration.token || weekday.token || Number(administrations[1]) <= 0)) {
    abnormalities.push({ id: 'complex_administration_count', tier: 'uncorrected_gap', title: 'Administration Count Requires Review', message: 'The administration count and other course restrictions were retained together for review.', trigger: rawProse });
    return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
  } else if (weekday.token) {
    frequencyToken = weekday.token;
  } else if (administrations?.[1] === '1') {
    frequencyToken = 'X1 ONLY';
  } else if (compoundShift && compoundShift[1] !== compoundShift[2]) {
    frequencyToken = `BID (DURING ${compoundShift[1]} AND ${compoundShift[2]} SHIFT)`;
  } else if (dayInterval && dayInterval[1] !== '2') {
    if (/\b(?:[2-9] TIMES|TWICE|BID|TID|QID|Q\d+H)\b|\bMORNING\b.*\bBEDTIME\b/.test(scheduleProse) || Number(dayInterval[1]) <= 0) {
      abnormalities.push({ id: 'complex_day_interval', tier: 'uncorrected_gap', title: 'Day Interval Requires Review', message: 'The interval and within-day schedule were retained for review.', trigger: rawProse });
      return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
    }
    const code = `QDQ${Number(dayInterval[1])}D`;
    frequencyToken = SIG_CODE_REFERENCE[code] ? code : `ONCE DAILY EVERY ${Number(dayInterval[1])} DAYS`;
    if (/\b(?:EVERY MORNING|IN THE MORNING)\b/.test(scheduleProse)) frequencyToken += ' IN THE MORNING';
    if (/\bAT BEDTIME\b/.test(scheduleProse)) frequencyToken += ' AT BEDTIME';
  } else if (shift) {
    frequencyToken = `QD (DURING ${shift[1]} SHIFT)`;
  } else if (/\b(?:EVERY|EACH) SHIFT\b/.test(scheduleProse)) {
    frequencyToken = 'QS';
  } else if (/\b(?:EVERY OTHER DAY|EVERY 2 DAYS|QOD|QDQ2D)\b/.test(scheduleProse)) {
    if (/\b(?:[2-9] TIMES|TWICE|BID|TID|QID|Q\d+H)\b|\bMORNING\b.*\bBEDTIME\b/.test(scheduleProse)) {
      abnormalities.push({ id: 'complex_alternate_day_schedule', tier: 'uncorrected_gap', title: 'Alternate-Day Schedule Requires Review',
        message: 'The within-day frequency and alternate-day qualifier were retained for review.', trigger: rawProse });
      return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
    }
    frequencyToken = 'QDQ2D';
    if (/\b(?:EVERY MORNING|IN THE MORNING)\b/.test(scheduleProse)) frequencyToken += ' IN THE MORNING';
    if (/\bAT BEDTIME\b/.test(scheduleProse)) frequencyToken += ' AT BEDTIME';
  } else if (scheduleProse.includes('EVERY MORNING AND AT BEDTIME') || (/\b(?:EVERY\s+)?MORNING\b.*?\bAND\b.*?\bBEDTIME\b/i.test(scheduleProse))) {
    frequencyToken = 'BIDAMHS';
  } else if (scheduleProse.includes('BEFORE BREAKFAST')) {
    frequencyToken = 'QDA/B';
  } else if (scheduleProse.includes('AFTER DINNER')) {
    frequencyToken = scheduleProse.includes('IN THE EVENING') ? 'QDP/D IN THE EVENING' : 'QDP/D';
  } else if (/\bBEFORE MEALS AND AT BEDTIME\b/.test(scheduleProse)) {
    frequencyToken = 'ACHS';
  } else if (scheduleProse.includes('AT BEDTIME') || /\bBEDTIME\b/i.test(scheduleProse) || /\bQHS\b/i.test(scheduleProse)) {
    frequencyToken = 'QHS';
  } else if (scheduleProse.includes('EVERY MORNING') || scheduleProse.includes('IN THE MORNING') || /\bQAM\b/i.test(scheduleProse)) {
    frequencyToken = 'QAM';
  } else if (/\b(?:IN THE EVENING|EVERY EVENING|QPM)\b/.test(scheduleProse)) {
    frequencyToken = 'QPM';
  } else if (scheduleProse.includes('EVERY 12 HOURS') || /\bQ12H\b/i.test(scheduleProse)) {
    frequencyToken = 'Q12H';
  } else if (scheduleProse.includes('EVERY 8 HOURS') || /\bQ8H\b/i.test(scheduleProse)) {
    frequencyToken = 'Q8H';
  } else if (scheduleProse.includes('EVERY 6 HOURS') || /\bQ6H\b/i.test(scheduleProse)) {
    frequencyToken = 'Q6H';
  } else if (scheduleProse.includes('EVERY 4 HOURS') || /\bQ4H\b/i.test(scheduleProse)) {
    frequencyToken = 'Q4H';
  } else if (/\bEVERY\s+(\d+)\s*HOURS?\b/i.test(scheduleProse) || /\bQ(\d+)H\b/i.test(scheduleProse)) {
    const qhMatch = scheduleProse.match(/\bEVERY\s+(\d+)\s*HOURS?\b/i) || scheduleProse.match(/\bQ(\d+)H\b/i);
    frequencyToken = /\bEVERY\b/.test(qhMatch![0]) ? hourlySchedule(qhMatch![1]) : `Q${qhMatch![1]}H`;
  } else if (/\b(?:FOUR|4) TIMES (?:A|PER|EACH) DAY\b|\bQID\b/.test(scheduleProse)) {
    frequencyToken = 'QID';
  } else if (/\b(?:THREE|3) TIMES (?:A|PER|EACH) DAY\b|\bTID\b/.test(scheduleProse)) {
    frequencyToken = 'TID';
  } else if (/\b(?:TWO|2) TIMES (?:A|PER|EACH) DAY\b|\bTWICE DAILY\b|\bBID\b/.test(scheduleProse)) {
    frequencyToken = 'BID';
  } else if (/\b(?:(?:ONE|1) TIME ONLY|ONCE ONLY|X1)\b/.test(scheduleProse)) {
    frequencyToken = /\bONLY\b/.test(scheduleProse) ? 'X1 ONLY' : 'X1';
  } else if (/\b(?:DAILY|EVERY\s+DAY|ONCE\s+(?:A\s+)?DAY|(?:ONE|1)\s+TIME\s+(?:A|PER|EACH)\s+DAY|QD)\b/.test(scheduleProse)) {
    frequencyToken = 'QD';
  }

  if (/\bBEFORE MEALS\b/.test(scheduleProse)) {
    const mealCodes: Record<string, string> = { QD: 'QDAC', BID: 'BIDAC', TID: 'TIDAC', QID: 'QIDAC' };
    if (mealCodes[frequencyToken] && SIG_CODE_REFERENCE[mealCodes[frequencyToken]]) frequencyToken = mealCodes[frequencyToken];
    else if (!frequencyToken) {
      frequencyToken = 'TIDAC';
      abnormalities.push({ id: 'before_meals_schedule', tier: 'applied_correction', title: 'Before-Meals Schedule Applied',
        message: 'Before meals was represented as TIDAC using the site convention. Verify three meals per day for this order.', correction: 'BEFORE MEALS → TIDAC', trigger: rawProse });
    } else if (frequencyToken !== 'ACHS') frequencyToken += ' BEFORE MEALS';
  }
  if (frequencyToken && /\bWITH MEALS\b/.test(scheduleProse)) {
    const code = ({ QD: 'WMQD', BID: 'WMBID', TID: 'WMTID' } as Record<string, string>)[frequencyToken];
    frequencyToken = code && SIG_CODE_REFERENCE[code] ? code : `${frequencyToken} WM`.trim();
  }
  if (frequencyToken && /\bON AN? EMPTY STOMACH\b/.test(scheduleProse)) frequencyToken = `${frequencyToken} ON AN EMPTY STOMACH`.trim();

  const unsupportedInterval = !frequencyToken && /\b(?:EVERY|EACH\s+(?:DAY|HOUR|WEEK|MORNING|EVENING|NIGHT)|TIMES\s+(?:A|PER))\b/.test(scheduleProse);
  if (!frequencyToken) {
    abnormalities.push({ id: `abn_freq_unrecognized_${Date.now()}`, tier: 'uncorrected_gap',
      title: unsupportedInterval ? 'Unrecognized Frequency' : 'Missing Frequency',
      message: unsupportedInterval ? 'The supplied interval could not be translated. Original directions were retained for manual translation.' : 'No dosing interval was supplied. No QD or other scheduled frequency was added. Verify the frequency or PRN interval before copying.', trigger: rawProse });
  }

  // Default template reconstitution blending
  let blendedTemplate: string | undefined;
  if (defaultTemplate) {
    let base = defaultTemplate.trim();
    const scheduledPreparation = base.match(/^((?:MIX|DISSOLVE)\b[\s\S]*\b(?:GIVE|TAKE)(?:\s+(?:PO|GT|PEGT|JT|NG))?)\s+(QD|BID|TID|QID|Q\d+H|QAM|QPM|QHS|(?:QD|QAM|QPM)DAY[1-7]+)\s*$/i);
    if (scheduledPreparation) {
      base = scheduledPreparation[1];
      if (scheduledPreparation[2].toUpperCase() !== frequencyToken) {
        abnormalities.push({ id: 'preparation_schedule_updated', tier: 'applied_correction', title: 'Preparation Schedule Updated',
          message: 'The preparation template schedule was replaced with the source schedule. Verify the final instructions before copying.',
          correction: `${scheduledPreparation[2].toUpperCase()} → ${frequencyToken || 'no scheduled frequency supplied'}`, trigger: rawProse });
      }
    }
    const ind = indicationToken ? ` ${indicationToken}` : '';
    if (/\b(?:PO|GT|PEGT|JT|NG|GIVE|TAKE)$/.test(base.toUpperCase())) {
      const scheduleParts = [frequencyToken];
      if (prnToken) scheduleParts.push(prnToken, indicationToken || '', durationToken || '');
      else scheduleParts.push(durationToken || '', indicationToken || '');
      scheduleParts.push(holdToken || '', stopToken || '');
      blendedTemplate = `${base} ${scheduleParts.filter(Boolean).join(' ')}`.trim();
    } else {
      blendedTemplate = `${base}${ind}`;
    }
  }

  return {
    frequencyToken,
    durationToken,
    prnToken,
    indicationToken,
    holdToken,
    stopToken,
    blendedTemplate,
    abnormalities,
    requiresManualTranslation: unsupportedInterval
  };
}

export function resolveFrequencyAndSchedule(rawProse: string, defaultTemplate?: string): FrequencyScheduleResult {
  const result = resolveFrequencyAndScheduleInternal(rawProse, defaultTemplate);
  traceLogger.debug('clinical', 'frequencyEngine', 'Resolved frequency and schedule tokens', {
    frequencyToken: result.frequencyToken,
    durationToken: result.durationToken,
    prnToken: result.prnToken,
    indicationToken: result.indicationToken,
    holdToken: result.holdToken,
    stopToken: result.stopToken,
    blendedTemplate: result.blendedTemplate,
    abnormalitiesCount: result.abnormalities.length
  });
  return result;
}
