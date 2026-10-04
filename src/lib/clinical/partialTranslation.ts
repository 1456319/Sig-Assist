import { indicationSpan, resolveIndicationToken } from './indicationEngine';
import { normalizeNumericDirections } from './numericDirections';
import { SIG_CODE_REFERENCE } from './sigCodeReference';
import { hourlySchedule } from './hourlySchedule';

/** Lossless phrase substitution: unknown dose, units, qualifiers and actions stay visible. */
export function translateRecognizedPhrases(rawProse: string): string {
  // A partial insulin scale is not a useful or safe substitute for the source scale.
  if (/\bSLIDING SCALE\b/i.test(rawProse)) return rawProse.replace(/\s+/g, ' ').trim().toUpperCase();
  const prose = normalizeNumericDirections(rawProse);
  const span = indicationSpan(prose);
  const translate = (text: string) => text
    .replace(/\bBY\s+MOUTH\b|\bORALLY\b/g, 'PO')
    .replace(/\b(?:VIA|PER|THROUGH)\s+(PEG|G|J|NG)[ -]?TUBE\b/g, (_, tube: string) => ({ PEG: 'PEGT', G: 'GT', J: 'JT', NG: 'NG' })[tube]!)
    .replace(/\bIN THE EVENING\b/g, 'QPM')
    .replace(/\bSUBCUTANEOUSLY\b/g, 'SQ')
    .replace(/\bSUBLINGUALLY\b/g, 'SL')
    .replace(/\bVAGINALLY\b/g, 'PV')
    .replace(/\bRECTALLY\b/g, 'PR')
    .replace(/\bTOPICALLY\b/g, 'TPCL')
    .replace(/\b(?:VIA|USING)\s+(?:A\s+)?NEBULI[ZS]ER\b/g, 'NEB')
    .replace(/\bEVERY\s+OTHER\s+DAY\b/g, 'QOD')
    .replace(/\bEVERY\s+(\d+)\s*(?:HOURS?|HRS?)\b/g, (original, n: string) => Number(n) > 0 ? hourlySchedule(n) : original)
    .replace(/\b(?:4\s+TIMES\s+(?:A|PER|EACH)\s+DAY|FOUR TIMES DAILY)\b/g, 'QID')
    .replace(/\b(?:3\s+TIMES\s+(?:A|PER|EACH)\s+DAY|THREE TIMES DAILY)\b/g, 'TID')
    .replace(/\b(?:2\s+TIMES\s+(?:A|PER|EACH)\s+DAY|TWICE\s+(?:DAILY|A DAY))\b/g, 'BID')
    .replace(/\b(?:1\s+TIME\s+(?:A|PER|EACH)\s+DAY|ONCE\s+(?:A\s+)?DAY|EVERY\s+DAY|DAILY)\b/g, 'QD')
    .replace(/\bAS\s+NEEDED\b/g, 'PRN')
    .replace(/\bFOR\s+(\d+)\s*(DAYS?|WEEKS?|MONTHS?|HOURS?)\b/g, (original, n: string, unit: string) => {
      const token = `X${n}${unit.startsWith('D') ? 'D' : unit.startsWith('W') ? 'WK' : unit.startsWith('M') ? 'M' : 'H'}`;
      return SIG_CODE_REFERENCE[token] ? token : original;
    });
  if (!span) return translate(prose);
  return [translate(prose.slice(0, span.start)), resolveIndicationToken(prose.slice(span.start, span.end)), translate(prose.slice(span.end))]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
