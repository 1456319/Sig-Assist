import { AbnormalityFinding } from './types';
import { traceLogger } from '../diagnostics/traceLogger';
import { splitSupplementalDirections } from './instructionClauses';
import { extractIndicationToken, administrationScheduleProse } from './indicationEngine';
import { resolveWeekdaySchedule } from './weekdaySchedule';
import { resolveDuration } from './durationEngine';
import { SIG_CODE_REFERENCE } from './sigCodeReference';
import { normalizeNumericDirections } from './numericDirections';
import { hourlySchedule } from './hourlySchedule';
import { parseSlidingScale } from './slidingScale';

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
  const upper = normalizeNumericDirections(splitSupplementalDirections(rawProse).primary)
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

  if (/\bSLIDING[\s-]+SCALE\b/.test(upper)) {
    const scale = parseSlidingScale(upper);
    abnormalities.push(...scale.abnormalities);
    if (scale.incomplete) return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
    const tail = splitSupplementalDirections(scale.schedule);
    const schedule = resolveFrequencyAndScheduleInternal(tail.primary);
    if (!schedule.frequencyToken || schedule.requiresManualTranslation) {
      abnormalities.push({ id: 'incomplete_sliding_scale', tier: 'uncorrected_gap', title: 'Scale Schedule Requires Review',
        message: 'The scale schedule could not be resolved. Original directions were retained.', trigger: rawProse });
      return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
    }
    let frequency = schedule.frequencyToken;
    if (frequency === 'TIDAC' && !/\b(?:3|THREE) TIMES|\bTID\b/.test(tail.primary)) frequency = 'AC';
    const prefix = `CBS ${frequency} SS`;
    const core = [prefix, scale.bands, scale.route, schedule.prnToken, schedule.durationToken,
      schedule.indicationToken, schedule.holdToken, schedule.stopToken].filter(Boolean).join(' ');
    const slidingScaleString = tail.supplemental ? `${core}. ${tail.supplemental.toUpperCase()}` : core;
    return { frequencyToken: prefix, slidingScaleString, abnormalities: [...abnormalities, ...schedule.abnormalities] };
  }

  // Hold parameters
  let holdToken: string | undefined;
  const hold = upper.match(/\bHOLD\s+(?:IF|FOR|WHEN)\s+[^;.]+/)?.[0].trim();
  if (hold && /^HOLD (?:IF|FOR) (?:SBP|SYSTOLIC BLOOD PRESSURE) (?:LESS THAN|<)\s*100 OR (?:HEART RATE|HR) (?:LESS THAN|<)\s*60$/.test(hold)) {
    holdToken = 'HR60SBP100';
  } else if (hold && /^HOLD\s+(?:IF|FOR)\s+SBP\s*(?:<|LESS\s+THAN)\s*100$/.test(hold)) {
    holdToken = 'SBP100';
  } else if (hold && /^HOLD IF MORE THAN 2 BOWEL MOVEMENTS?(?: DAILY)?$/.test(hold)) {
    holdToken = '(H >2 BOWEL MOVEMENTS DAILY)';
  } else if (hold) {
    holdToken = `(${hold.replace(/^HOLD FOR\b/, 'H').replace(/\bLOOSE STOOLS?\b/g, 'LS')})`;
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
  let durationToken = duration.token || (administrations && administrations[1] !== '1' ? `FOR ${administrations[1]} DOSES` : undefined);
  abnormalities.push(...duration.abnormalities);
  if (duration.unsupported) return { frequencyToken: '', abnormalities, requiresManualTranslation: true };

  // PRN
  const prnToken = upper.includes('AS NEEDED') || /\bPRN\b/i.test(upper) ? 'PRN' : undefined;

  const indicationToken = extractIndicationToken(upper);
  const scheduleProse = administrationScheduleProse(upper);

  // Frequency tokens
  let frequencyToken = '';
  const weekday = resolveWeekdaySchedule(scheduleProse);
  if (weekday.token && administrations?.[1] === '1' && !duration.token) durationToken = 'X1 ONLY';
  const compoundShift = scheduleProse.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+AND\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  const dayInterval = scheduleProse.match(/\bEVERY\s+(\d+)\s+DAYS?\b/);
  const shift = scheduleProse.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  if (weekday.unsupported) {
    abnormalities.push({ id: 'unsupported_weekday_schedule', tier: 'uncorrected_gap', title: 'Weekday Schedule Requires Review',
      message: 'The complete weekday schedule could not be translated. Original directions were retained; no day or qualifier was discarded.', trigger: rawProse });
    return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
  } else if (administrations && (duration.token || Number(administrations[1]) <= 0)) {
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
  } else if (/\bSTAT\b/.test(scheduleProse)) {
    frequencyToken = 'STAT';
  } else if (/\bEVERY\s+\d+\s+MINUTES?\b/.test(scheduleProse)) {
    const minutes = Number(scheduleProse.match(/\bEVERY\s+(\d+)\s+MINUTES?\b/)![1]);
    const code = `Q${minutes}M`;
    frequencyToken = SIG_CODE_REFERENCE[code] === `EVERY ${minutes} MINUTES` ? code : `EVERY ${minutes} MINUTES`;
    if (/\bQD\b/.test(scheduleProse)) frequencyToken += ' QD';
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
  } else if (/\b(?:AFTER\s+(?:EACH\s+)?MEALS?\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME|PCHS)\b/i.test(scheduleProse)) {
    frequencyToken = 'PCHS';
  } else if (/\b(?:BEFORE\s+(?:EACH\s+)?MEALS?\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME|ACHS)\b/i.test(scheduleProse)) {
    frequencyToken = 'ACHS';
  } else if (/\b(?:WITH\s+(?:EACH\s+)?MEALS?\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME|WMHS)\b/i.test(scheduleProse)) {
    frequencyToken = 'WMHS';
  } else if (scheduleProse.includes('AT BEDTIME') || /\bBEDTIME\b/i.test(scheduleProse) || /\bQHS\b/i.test(scheduleProse)) {
    frequencyToken = 'QHS';
  } else if (scheduleProse.includes('EVERY MORNING') || scheduleProse.includes('IN THE MORNING') || /\bQAM\b/i.test(scheduleProse)) {
    frequencyToken = 'QAM';
  } else if (/\b(?:IN THE EVENING|EVERY EVENING|QPM)\b/.test(scheduleProse)) {
    frequencyToken = 'QPM';
  } else if (/\b(?:IN THE AFTERNOON|EVERY AFTERNOON)\b/.test(scheduleProse)) {
    frequencyToken = 'QD IN THE AFTERNOON';
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
  } else if (/\b(?:TWO|2)\s+TIMES\s+(?:A|PER|EACH)\s+DAY\b|\bTWICE\s+(?:A\s+DAY|DAILY)\b|\bBID\b/i.test(scheduleProse)) {
    frequencyToken = 'BID';
  } else if (/\b(?:(?:ONE|1) TIME ONLY|ONCE ONLY|X1)\b/.test(scheduleProse)) {
    frequencyToken = /\bONLY\b/.test(scheduleProse) ? 'X1 ONLY' : 'X1';
  } else if (/\b(?:DAILY|EVERY\s+DAY|ONCE\s+(?:A\s+)?DAY|(?:ONE|1)\s+TIME\s+(?:A|PER|EACH)\s+DAY|QD)\b/.test(scheduleProse)) {
    frequencyToken = 'QD';
  }

  if (/\bAFTER\s+(?:EACH\s+)?MEALS?\b|\bPC\b/i.test(scheduleProse)) {
    if (frequencyToken !== 'PCHS') {
      if (!frequencyToken || frequencyToken === 'TID') {
        frequencyToken = 'PC';
      } else {
        frequencyToken = `${frequencyToken} PC`.trim();
      }
    }
  } else if (/\bBEFORE\s+(?:EACH\s+)?MEALS?\b|\bAC\b/i.test(scheduleProse)) {
    if (frequencyToken !== 'ACHS') {
      const mealCodes: Record<string, string> = { QD: 'QDAC', BID: 'BIDAC', TID: 'TIDAC', QID: 'QIDAC' };
      if (mealCodes[frequencyToken] && SIG_CODE_REFERENCE[mealCodes[frequencyToken]]) {
        frequencyToken = mealCodes[frequencyToken];
      } else if (!frequencyToken) {
        frequencyToken = 'TIDAC';
        abnormalities.push({
          id: 'before_meals_schedule',
          tier: 'applied_correction',
          title: 'Before-Meals Schedule Applied',
          message: 'Before meals was represented as TIDAC using the site convention. Verify three meals per day for this order.',
          correction: 'BEFORE MEALS → TIDAC',
          trigger: rawProse,
        });
      } else {
        frequencyToken += ' BEFORE MEALS';
      }
    }
  }

  if (/\bWITH BREAKFAST\b/.test(scheduleProse)) {
    frequencyToken = ['QD', 'QAM', ''].includes(frequencyToken) ? 'QDW/B' : `${frequencyToken} WITH BREAKFAST`;
  }
  if (/\bWITH\s+(?:EACH\s+)?(?:MEALS?|FOOD)\b/i.test(scheduleProse) || /\bWM\b/.test(scheduleProse)) {
    if (!frequencyToken && /\bWITH\s+(?:EACH\s+)?MEALS?\b/.test(scheduleProse)) {
      frequencyToken = 'TID';
      abnormalities.push({ id: 'with_meals_schedule', tier: 'applied_correction', title: 'With-Meals Schedule Applied',
        message: 'With meals uses the reported site convention of three meals daily. Compare the source before copying.', trigger: rawProse });
    }
    if (frequencyToken !== 'WMHS') {
      const code = ({ QD: 'WMQD', BID: 'WMBID', TID: 'WMTID' } as Record<string, string>)[frequencyToken];
      frequencyToken = code && SIG_CODE_REFERENCE[code] ? code : `${frequencyToken} WM`.trim();
    }
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
