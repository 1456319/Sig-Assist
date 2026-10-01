import { SIG_CODE_REFERENCE } from './sigCodeReference';

const referenceIndications: Record<string, string> = {};
for (const [code, expansion] of Object.entries(SIG_CODE_REFERENCE)) {
  if (expansion.startsWith('FOR ') && !referenceIndications[expansion.slice(4)]) referenceIndications[expansion.slice(4)] = code;
}

// Match complete phrases, preserving qualifiers and conjunctions. Existing
// institutional aliases choose among synonymous codes in the root reference.
export const INDICATION_MAP: Record<string, string> = {
  ...referenceIndications,
  GERD: 'FGERD', SUPPLEMENT: 'FSU', DM: 'FDM', DM2: 'FDM2',
  'TYPE 2 DIABETES': 'FDM2', BPH: 'FBPH', HYPOTHYROIDISM: 'FHYT',
  'GI PROPHYLAXIS': 'FGIP', COUGH: 'FCOU', HTN: 'FHTN', CONSTIPATION: 'FCON',
  'DVT PREVENTION': 'FDVTP', 'BLOOD CLOT PREVENTION': 'FBCP', PAIN: 'FPAIN',
  'SHORTNESS OF BREATH OR WHEEZING': 'FSOBW', 'SOB OR WHEEZING': 'FSOBW',
  AFIB: 'FAFIB',
};

// X 2 DAYS in the FBM codes describes the triggering condition, not the
// treatment duration. Protect that phrase before parsing course durations.
export function protectIndicationDurations(prose: string): string {
  return prose.replace(/\bFOR\s+NO\s+BOWEL\s+MOVEMENT\s+X\s*(\d+)\s*DAYS?\b/gi, original => {
    const days = original.match(/X\s*(\d+)/i)![1];
    const code = INDICATION_MAP[`NO BOWEL MOVEMENT X ${days} DAYS`];
    return code ? `FOR ${code}` : original;
  });
}

function removeDiagnosisCodes(value: string): string {
  // Require a decimal ICD code or an explicit ICD-10 prefix; do not erase
  // ordinary terms such as vitamin B12 or non-code parenthetical instructions.
  return value
    .replace(/\(\s*(?:ICD[ -]?10(?:[ -]?CM)?(?:\s+CODE)?\s*[:=-]?\s*)?[A-TV-Z]\d{2}\.[A-Z0-9]{1,4}\s*\)/g, '')
    .replace(/\(?\bICD[ -]?10(?:[ -]?CM)?(?:\s+CODE)?\s*[:=-]?\s*[A-TV-Z]\d{2}(?:\.[A-Z0-9]{1,4})?\b\)?/g, '')
    .replace(/\b[A-TV-Z]\d{2}\.[A-Z0-9]{1,4}\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function resolveIndicationToken(indication?: string): string | undefined {
  if (!indication) return undefined;
  const cleaned = removeDiagnosisCodes(indication.toUpperCase().trim().replace(/^FOR\s+/, ''))
    .replace(/[.;,]+$/, '').trim();
  if (!cleaned) return undefined;
  if (INDICATION_MAP[cleaned]) return INDICATION_MAP[cleaned];
  if (Object.values(INDICATION_MAP).includes(cleaned)) return cleaned;
  const clauses = cleaned.split(/\s+(AND|OR)\s+/);
  if (clauses.length > 1 && clauses.some((c, i) => i % 2 === 0 && INDICATION_MAP[c])) {
    return clauses.map((clause, i) => i % 2 ? clause : INDICATION_MAP[clause] || `FOR ${clause}`).join(' ');
  }
  return `FOR ${cleaned}`;
}

// Only explicit directives qualify here. A diagnosis such as DAILY EYE
// DISCOMFORT cannot supply a missing frequency.
const TRAILING_SCHEDULE = /\b(?:(?:\d+|ONE|TWO|THREE|FOUR)\s+TIMES?\s+(?:A|PER|EACH)\s+DAY|TWICE\s+DAILY|EVERY\s+(?:\d+\s+HOURS?|MORNING)|IN\s+THE\s+(?:MORNING|EVENING)|(?:TAKE\s+)?BEFORE\s+MEALS|BEFORE\s+BREAKFAST|AFTER\s+DINNER|AS\s+NEEDED|PRN)\b/i;

function indicationStart(prose: string): number | undefined {
  const upper = prose.toUpperCase();
  for (const match of upper.matchAll(/\bFOR\s+/g)) {
    if (match.index === undefined || /\bHOLD\s*$/.test(upper.slice(0, match.index))) continue;
    const tail = upper.slice(match.index + match[0].length);
    if (/^(?:(?:UP\s+TO\s+)?\d|HOLD\b|SBP\b|HEART\s+RATE\b)/.test(tail)) continue;
    return match.index;
  }
  return undefined;
}

export function extractIndicationToken(prose: string): string | undefined {
  prose = protectIndicationDurations(prose);
  const start = indicationStart(prose);
  if (start === undefined) return undefined;
  const indication = prose.slice(start).replace(/^FOR\s+/i, '')
    .split(/\b(?:HOLD\s+(?:IF|FOR|WHEN)|(?:FOR\s+(?:UP\s+TO\s+)?|X\s*)\d[\d./ -]*\s*(?:DAYS?|D\b|WEEKS?|WK\b|MONTHS?|HOURS?)|THEN\s+(?:STOP|DISCONTINUE)|SWISH\s+AND\s+(?:SWALLOW|SPIT))\b/i)[0].trim();
  return resolveIndicationToken(indication.split(TRAILING_SCHEDULE)[0]);
}

export function administrationScheduleProse(prose: string): string {
  const start = indicationStart(prose);
  if (start === undefined) return prose;
  // A diagnosis containing DAILY/EVERY/EACH must not supply an absent interval.
  // Preserve the established post-indication meal relationships separately.
  const tail = prose.slice(start);
  const directive = tail.match(TRAILING_SCHEDULE);
  return [prose.slice(0, start), directive?.index === undefined ? '' : tail.slice(directive.index)].join(' ');
}
