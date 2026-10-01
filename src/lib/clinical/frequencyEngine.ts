import { AbnormalityFinding } from './types';
import { traceLogger } from '../diagnostics/traceLogger';
import { splitSupplementalDirections } from './instructionClauses';
import { extractIndicationToken, administrationScheduleProse } from './indicationEngine';
import { resolveWeekdaySchedule } from './weekdaySchedule';

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
  const upper = splitSupplementalDirections(rawProse).primary.toUpperCase()
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

    // Hypoglycemic protocol / low MD call
    const lowMatch = upper.match(/(?:<|LESS THAN)\s*(\d+)[^;,\n]*(?:HYPOGLYCEMIC PROTOCOL|NOTIFY MD|CALL MD)/i);
    if (lowMatch) {
      const val = parseInt(lowMatch[1], 10);
      const action = upper.includes('HYPOGLYCEMIC') ? 'HYPOGLYCEMIC PROTOCOL' : 'CALL MD';
      segments.push({ sortKey: val, text: `<${val}=${action}` });
    }

    // Bracket matches: 181 - 200 = 1 unit or 200 - 300 = 5ml
    const bracketRegex = /(\d+)\s*-\s*(\d+)\s*=\s*(\d+)\s*(?:UNIT|UNITS|U|ML)/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bracketRegex.exec(upper)) !== null) {
      const low = parseInt(bMatch[1], 10);
      const high = parseInt(bMatch[2], 10);
      const units = parseInt(bMatch[3], 10);
      segments.push({ sortKey: low, text: `${low}-${high}=${units}U` });
    }

    // High threshold: > 350 = 5 units or Greater than 500 notify MD
    const highActionMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)[^;,\n]*(?:NOTIFY MD|CALL MD)/i);
    if (highActionMatch) {
      const val = parseInt(highActionMatch[1], 10);
      segments.push({ sortKey: val + 1000, text: `>${val}=CALL MD` });
    } else {
      const highUnitMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)\s*=\s*(\d+)\s*(?:UNIT|UNITS|U)/i);
      if (highUnitMatch) {
        const val = parseInt(highUnitMatch[1], 10);
        const units = parseInt(highUnitMatch[2], 10);
        segments.push({ sortKey: val + 1000, text: `>${val}=${units}U` });
      }
    }

    segments.sort((a, b) => a.sortKey - b.sortKey);
    const slidingScaleString = `${prefix} ${segments.map(s => s.text).join(';')}`;

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
  }

  // Duration
  let durationToken: string | undefined;
  const decimalDurMatch = upper.match(/\b(?:FOR|X)\s*(\d+\.\d+|\d+\s*[-/]\s*\d+)\s*(?:DAYS?|D\b)/i) || upper.match(/(?<!\bEVERY\s+)(?<!\bPER\s+)\b(\d+\.\d+|\d+\s*[-/]\s*\d+)\s*(?:DAYS?|D\b)/i);
  if (decimalDurMatch) {
    abnormalities.push({
      id: `abn_duration_non_integer_${Date.now()}`,
      tier: 'potential_error',
      title: 'Non-integer Day Supply',
      message: `Prescribed duration '${decimalDurMatch[0]}' contains a non-integer day supply. Day supplies must be whole numbers.`,
      trigger: decimalDurMatch[0]
    });
  } else {
    const forDurMatch = upper.match(/(?:\bFOR\s*|\bX\s*)(\d+)\s*(?:DAYS?|D\b)/i);
    if (forDurMatch) {
      durationToken = `X${forDurMatch[1]}D`;
    } else {
      const standaloneDurMatch = upper.match(/(?<![\d./])(\d+)(?!\s*[\d./])\s*(?:DAYS|DAY)\b/i);
      if (standaloneDurMatch && !upper.match(/EVERY\s+(\d+\s*)?(?:DAYS|DAY)/i) && !upper.includes('PER DAY')) {
        durationToken = `X${standaloneDurMatch[1]}D`;
      }
    }
  }

  // PRN
  const prnToken = upper.includes('AS NEEDED') || /\bPRN\b/i.test(upper) ? 'PRN' : undefined;

  const indicationToken = extractIndicationToken(upper);
  const scheduleProse = administrationScheduleProse(upper);

  // Frequency tokens
  let frequencyToken = '';
  const weekday = resolveWeekdaySchedule(scheduleProse);
  const shift = scheduleProse.match(/\b(?:EVERY|EACH)\s+(DAY|EVENING|NIGHT)\s+SHIFT\b/);
  if (weekday.unsupported) {
    abnormalities.push({ id: 'unsupported_weekday_schedule', tier: 'uncorrected_gap', title: 'Weekday Schedule Requires Review',
      message: 'The complete weekday schedule could not be translated. Original directions were retained; no day or qualifier was discarded.', trigger: rawProse });
    return { frequencyToken: '', abnormalities, requiresManualTranslation: true };
  } else if (weekday.token) {
    frequencyToken = weekday.token;
  } else if (shift) {
    frequencyToken = `QD (DURING ${shift[1]} SHIFT)`;
  } else if (scheduleProse.includes('EVERY MORNING AND AT BEDTIME') || (/\b(?:EVERY\s+)?MORNING\b.*?\bAND\b.*?\bBEDTIME\b/i.test(scheduleProse))) {
    frequencyToken = 'BIDAMHS';
  } else if (scheduleProse.includes('BEFORE BREAKFAST')) {
    frequencyToken = 'QDA/B';
  } else if (scheduleProse.includes('AFTER DINNER')) {
    frequencyToken = scheduleProse.includes('IN THE EVENING') ? 'QDP/D IN THE EVENING' : 'QDP/D';
  } else if (scheduleProse.includes('AT BEDTIME') || /\bBEDTIME\b/i.test(scheduleProse) || /\bQHS\b/i.test(scheduleProse)) {
    frequencyToken = 'QHS';
  } else if (scheduleProse.includes('EVERY MORNING') || scheduleProse.includes('IN THE MORNING') || /\bQAM\b/i.test(scheduleProse)) {
    frequencyToken = 'QAM';
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
    frequencyToken = `Q${qhMatch![1]}H`;
  } else if (scheduleProse.includes('FOUR TIMES A DAY') || /\bQID\b/i.test(scheduleProse)) {
    frequencyToken = 'QID';
  } else if (scheduleProse.includes('THREE TIMES A DAY') || /\bTID\b/i.test(scheduleProse)) {
    frequencyToken = 'TID';
  } else if (scheduleProse.includes('TWO TIMES A DAY') || scheduleProse.includes('TWICE DAILY') || /\bBID\b/i.test(scheduleProse)) {
    frequencyToken = 'BID';
  } else if (/\b(?:DAILY|EVERY\s+DAY|ONCE\s+(?:A\s+)?DAY|ONE\s+TIME\s+A\s+DAY|QD)\b/.test(scheduleProse)) {
    frequencyToken = 'QD';
  }

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
    const scheduledPreparation = base.match(/^(MIX\b[\s\S]*\b(?:GIVE|TAKE)\s+PO)\s+(QD|BID|TID|QID|Q\d+H|QAM|QPM|QHS|(?:QD|QAM|QPM)DAY[1-7]+)\s*$/i);
    if (scheduledPreparation) {
      base = scheduledPreparation[1];
      if (scheduledPreparation[2].toUpperCase() !== frequencyToken) {
        abnormalities.push({ id: 'preparation_schedule_updated', tier: 'applied_correction', title: 'Preparation Schedule Updated',
          message: 'The preparation template schedule was replaced with the source schedule. Verify the final instructions before copying.',
          correction: `${scheduledPreparation[2].toUpperCase()} → ${frequencyToken || 'no scheduled frequency supplied'}`, trigger: rawProse });
      }
    }
    const ind = indicationToken ? ` ${indicationToken}` : '';
    if (base.toUpperCase().endsWith('PO')) {
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
