// Codes from docs/Sig Codes (searchable).docx. Only the complete indication
// matches: e.g. PAIN -> FPAIN, while NECK PAIN stays FOR NECK PAIN.
export const INDICATION_MAP: Record<string, string> = {
  GERD: 'FGERD', SUPPLEMENT: 'FSU', DM: 'FDM', DM2: 'FDM2',
  'TYPE 2 DIABETES': 'FDM2', BPH: 'FBPH', HYPOTHYROIDISM: 'FHYT',
  'GI PROPHYLAXIS': 'FGIP', COUGH: 'FCOU', HTN: 'FHTN', CONSTIPATION: 'FCON',
  'DVT PREVENTION': 'FDVTP', 'BLOOD CLOT PREVENTION': 'FBCP', PAIN: 'FPAIN',
  'SHORTNESS OF BREATH OR WHEEZING': 'FSOBW', 'SOB OR WHEEZING': 'FSOBW',
};

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
  return `FOR ${cleaned}`;
}

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
  const start = indicationStart(prose);
  if (start === undefined) return undefined;
  const indication = prose.slice(start).replace(/^FOR\s+/i, '')
    .split(/\b(?:HOLD\s+(?:IF|FOR|WHEN)|FOR\s+(?:UP\s+TO\s+)?\d[\d./ -]*\s*(?:DAYS?|D\b)|THEN\s+(?:STOP|DISCONTINUE)|BEFORE\s+BREAKFAST|AFTER\s+DINNER)\b/i)[0].trim();
  return resolveIndicationToken(indication);
}

export function administrationScheduleProse(prose: string): string {
  const start = indicationStart(prose);
  if (start === undefined) return prose;
  // A diagnosis containing DAILY/EVERY/EACH must not supply an absent interval.
  // Preserve the established post-indication meal relationships separately.
  const meals = prose.slice(start).match(/\b(?:BEFORE BREAKFAST|AFTER DINNER)\b/gi) || [];
  return [prose.slice(0, start), ...meals].join(' ');
}
