import { AbnormalityFinding } from './types';

export interface FrequencyScheduleResult {
  readonly frequencyToken: string;
  readonly durationToken?: string;
  readonly prnToken?: string;
  readonly indicationToken?: string;
  readonly holdToken?: string;
  readonly slidingScaleString?: string;
  readonly blendedTemplate?: string;
  readonly abnormalities: AbnormalityFinding[];
}

const INDICATION_MAP: Record<string, string> = {
  GERD: 'FGERD',
  SUPPLEMENT: 'FSU',
  DM: 'FDM',
  DM2: 'FDM2',
  'TYPE 2 DIABETES': 'FDM2',
  BPH: 'FBPH',
  HYPOTHYROIDISM: 'FHYT',
  'GI PROPHYLAXIS': 'FGIP',
  COUGH: 'FCOU',
  HTN: 'FHTN',
  CONSTIPATION: 'FCON',
  'DVT PREVENTION': 'FDVTP',
  PAIN: 'FPAIN',
  'MUSCLE PAIN': 'FOR MUSCLE PAIN',
  'SMOKING CESSATION': 'FOR SMOKING CESSATION',
  'BOWEL REGIMEN': 'FOR BOWEL REGIMEN'
};

export function resolveFrequencyAndSchedule(rawProse: string, defaultTemplate?: string): FrequencyScheduleResult {
  const upper = rawProse.toUpperCase();
  const abnormalities: AbnormalityFinding[] = [];

  // Sliding scale insulin check
  if (upper.includes('SLIDING SCALE')) {
    const isAcHs = upper.includes('BEDTIME') || upper.includes('HS') || upper.includes('ACHS');
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
  } else if (upper.includes('HOLD IF MORE THAN 2 BOWEL MOVEMENT')) {
    holdToken = '(H >2 BOWEL MOVEMENTS DAILY)';
  }

  // Duration
  let durationToken: string | undefined;
  const forDurMatch = upper.match(/FOR\s+(\d+)\s*(?:DAYS|DAY)\b/i);
  if (forDurMatch) {
    durationToken = `X${forDurMatch[1]}D`;
  } else {
    const standaloneDurMatch = upper.match(/\b(\d+)\s*(?:DAYS|DAY)\b/i);
    if (standaloneDurMatch && !upper.match(/EVERY\s+(\d+\s*)?(?:DAYS|DAY)/i) && !upper.includes('PER DAY')) {
      durationToken = `X${standaloneDurMatch[1]}D`;
    }
  }

  // PRN
  const prnToken = upper.includes('AS NEEDED') || upper.includes('PRN') ? 'PRN' : undefined;

  // Indication
  let indicationToken: string | undefined;
  const sortedIndicationKeys = Object.keys(INDICATION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedIndicationKeys) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(upper)) {
      indicationToken = INDICATION_MAP[key];
      break;
    }
  }

  // Frequency tokens
  let frequencyToken = 'QD';
  if (upper.includes('EVERY SUN') || upper.includes('EVERY SUNDAY')) {
    frequencyToken = upper.includes('EVENING') || upper.includes('QPM') ? 'QPMDAY7' : 'QDAY7';
  } else if (upper.includes('EVERY MORNING AND AT BEDTIME')) {
    frequencyToken = 'BIDAMHS';
  } else if (upper.includes('BEFORE BREAKFAST')) {
    frequencyToken = 'QDA/B';
  } else if (upper.includes('AFTER DINNER')) {
    frequencyToken = upper.includes('IN THE EVENING') ? 'QDP/D IN THE EVENING' : 'QDP/D';
  } else if (upper.includes('AT BEDTIME') || upper.includes('BEDTIME')) {
    frequencyToken = 'QHS';
  } else if (upper.includes('EVERY MORNING') || upper.includes('IN THE MORNING')) {
    frequencyToken = 'QAM';
  } else if (upper.includes('EVERY 12 HOURS') || upper.includes('Q12H')) {
    frequencyToken = 'Q12H';
  } else if (upper.includes('EVERY 6 HOURS') || upper.includes('Q6H')) {
    frequencyToken = 'Q6H';
  } else if (upper.includes('EVERY 4 HOURS') || upper.includes('Q4H')) {
    frequencyToken = 'Q4H';
  } else if (upper.includes('FOUR TIMES A DAY') || upper.includes('QID')) {
    frequencyToken = 'QID';
  } else if (upper.includes('THREE TIMES A DAY') || upper.includes('TID')) {
    frequencyToken = 'TID';
  } else if (upper.includes('TWO TIMES A DAY') || upper.includes('TWICE DAILY') || upper.includes('BID')) {
    frequencyToken = 'BID';
  }

  // Default template reconstitution blending
  let blendedTemplate: string | undefined;
  if (defaultTemplate) {
    const base = defaultTemplate.trim();
    const ind = indicationToken ? ` ${indicationToken}` : '';
    if (base.toUpperCase().endsWith('PO')) {
      blendedTemplate = `${base} ${frequencyToken}${ind}`;
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
    blendedTemplate,
    abnormalities
  };
}
