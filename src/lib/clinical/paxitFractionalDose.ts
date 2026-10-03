import { normalizeNumericDirections } from './numericDirections';

/** Whole and fractional tablet components need distinct Paxit order cards. */
export function splitMixedTabletDose(drugName: string, prose: string): { parts: string[]; total: string } | undefined {
  if (!/\b(?:TABLET|TAB)\b/i.test(drugName) || /\b(?:ER|DR|EC|EXTENDED|DELAYED|CAPSULE)\b|[-+/]/i.test(drugName)) return undefined;
  const normalized = normalizeNumericDirections(prose);
  const count = normalized.match(/^(?:GIVE|TAKE)\s+(1\.(?:25|5|75)|1[ -](?:1\/4|1\/2|3\/4))\s+(?:TABLETS?|TABS?)\s+(?:BY MOUTH|ORALLY|PO)\s+/);
  if (!count || /\b(?:THEN|MAY|TAKE|GIVE|ADMINISTER)\b|\bAND\s+\d/.test(normalized.slice(count[0].length))
      || /\b(?:TABLETS?|TABS?)\b/.test(normalized.slice(count[0].length))) return undefined;
  const strengths = [...drugName.toUpperCase().matchAll(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)\b/g)];
  if (strengths.length !== 1 || Number(strengths[0][1]) <= 0) return undefined;
  const fraction = count[1].includes('/') ? count[1].slice(2).split('/').map(Number) : undefined;
  const quantity = fraction ? 1 + fraction[0] / fraction[1] : Number(count[1]);
  const remainder = ({ '0.25': '1/4', '0.5': '1/2', '0.75': '3/4' } as Record<string, string>)[String(quantity - 1)];
  if (!remainder) return undefined;
  const replace = (n: string) => normalized.replace(/^(GIVE|TAKE)\s+\S+(?:\s+\d\/\d)?\s+(TABLETS?|TABS?)/, `$1 ${n} $2`);
  return { parts: [replace('1'), replace(remainder)], total: `${Number((quantity * Number(strengths[0][1])).toFixed(6))}${strengths[0][2]}` };
}
