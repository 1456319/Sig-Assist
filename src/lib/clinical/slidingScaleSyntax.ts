import type { AbnormalityFinding } from './types';

const rangeSeparator = '(?:-|TO|THRU|THROUGH|\\.\\.)';
const number = '\\d+(?:\\.\\d+)?';
const comparison = '(?:[<>]=?|GREATER THAN(?: OR EQUALS?(?: TO)?)?|LESS THAN(?: OR EQUALS?(?: TO)?)?)';
export const scaleConditionPattern = new RegExp(
  `(?<![\\d.])\\b${number}\\s*${rangeSeparator}\\s*${number}|\\b${number}\\s*\\+|${comparison}\\s*${number}`, 'g',
);

// A threshold after a recheck is a condition on the follow-up, not a new tier.
const followup = new RegExp(
  `\\bIF\\s+(?:(?:THE\\s+)?(?:READINGS?|(?:BLOOD\\s+)?(?:SUGAR|GLUCOSE)|CBS|BG|BS)\\s+)?(?:(?:IS|ARE|REMAINS?)\\s+)?STILL\\s+${comparison}\\s*${number}(?:\\s*MG\\s*\\/\\s*DL)?\\s*,?\\s+(?:CALL|NOTIFY)\\b(?:(?![.;]|,?\\s+(?:IF|FOR|SUBCUTANEOUS(?:LY)?|SQ|TID|QID|ACHS|AC|AT BEDTIME|BEFORE MEALS)\\b).)+`, 'g',
);

export const numericScaleFollowups = (text: string) => [...text.matchAll(followup)];
export const hasNumericScaleFollowup = (text: string) =>
  new RegExp(`\\bIF\\b[^.;]*?\\bSTILL\\s+${comparison}\\s*${number}`).test(text);

export function scaleCoverageFindings(conditions: readonly string[], trigger?: string): AbnormalityFinding[] {
  const intervals = conditions.map(condition => {
    const [a, b] = condition.match(/\d+(?:\.\d+)?/g)!.map(Number);
    if (b !== undefined) return { lower: a, upper: b, lowerClosed: true, upperClosed: true };
    if (condition.startsWith('<')) return { lower: -Infinity, upper: a, lowerClosed: false, upperClosed: condition.startsWith('<=') };
    return { lower: a, upper: Infinity, lowerClosed: condition.endsWith('+'), upperClosed: false };
  }).sort((a, b) => a.lower - b.lower || Number(b.lowerClosed) - Number(a.lowerClosed));
  const whole = intervals.every(({ lower, upper }) => [lower, upper].every(n => !Number.isFinite(n) || Number.isInteger(n)));
  const findings: AbnormalityFinding[] = [];
  let covered = intervals[0];
  for (const next of intervals.slice(1)) {
    const previousEnd = covered.upper - (whole && !covered.upperClosed ? 1 : 0);
    const nextStart = next.lower + (whole && !next.lowerClosed ? 1 : 0);
    const overlap = whole ? nextStart <= previousEnd
      : nextStart < previousEnd || (nextStart === previousEnd && covered.upperClosed && next.lowerClosed);
    const gap = whole ? nextStart > previousEnd + 1
      : nextStart > previousEnd || (nextStart === previousEnd && !covered.upperClosed && !next.lowerClosed);
    if (overlap || gap) {
      const missing = whole
        ? (nextStart === previousEnd + 2 ? String(previousEnd + 1) : `${previousEnd + 1}–${nextStart - 1}`)
        : `between ${covered.upper} and ${next.lower}`;
      findings.push({
        id: overlap ? 'sliding_scale_overlap' : 'sliding_scale_gap',
        tier: 'uncorrected_gap',
        title: overlap ? 'Overlapping Sliding-Scale Bands' : 'Sliding-Scale Coverage Gap',
        message: overlap ? 'Prescribed dose bands overlap. Pharmacist clarification required before use.'
          : `No prescribed dose band covers ${missing}. Pharmacist clarification required before use.`,
        trigger,
      });
    }
    if (next.upper > covered.upper || (next.upper === covered.upper && next.upperClosed)) covered = next;
  }
  return findings;
}
