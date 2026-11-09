import { normalizeNumericDirections } from './numericDirections';
import type { AbnormalityFinding } from './types';

interface Band { key: number; condition: string; action: string }
export interface ParsedSlidingScale {
  bands: string;
  schedule: string;
  route: string;
  abnormalities: AbnormalityFinding[];
  incomplete: boolean;
}

// Conditions and actions are parsed separately. A matched range is not evidence
// that its complete dose, notification or later threshold has been captured.
const recipient = '(?:NP\\s*\\/\\s*PA|PA\\s*\\/\\s*NP|MD|NP|PA|PROVIDER|PRESCRIBER|PHYSICIAN)';
const comparison = '(?:[<>]=?|GREATER THAN(?: OR EQUALS?(?: TO)?)?|LESS THAN(?: OR EQUALS?(?: TO)?)?)';
const threshold = `(?:${comparison})\\s*\\d+(?:\\.\\d+)?`;
const glucose = '(?:(?:BS|BG|CBS|BLOOD (?:SUGAR|GLUCOSE))\\s*)?';
const conditionList = `${glucose}${threshold}(?:\\s+(?:OR|AND)\\s+${glucose}${threshold})*`;
const conditionPattern = /(?<![\d.])\b\d+(?:\.\d+)?\s*(?:-|TO)\s*\d+(?:\.\d+)?\s*(?==|:|GIVE\b|ADMINISTER\b)|\b\d+(?:\.\d+)?\s*\+|(?:[<>]=?|GREATER THAN(?: OR EQUALS?(?: TO)?)?|LESS THAN(?: OR EQUALS?(?: TO)?)?)\s*\d+(?:\.\d+)?/g;

function condition(value: string): { key: number; text: string } {
  const numbers = value.match(/\d+(?:\.\d+)?/g)!.map(Number);
  if (numbers.length === 2) return { key: numbers[0], text: `${numbers[0]}-${numbers[1]}` };
  const low = /^(?:<|LESS)/.test(value);
  const inclusive = /[=+]|EQUAL/.test(value);
  return { key: low ? -1e9 + numbers[0] : numbers[0] + 0.01,
    text: low ? `${inclusive ? '<=' : '<'}${numbers[0]}` : inclusive ? `${numbers[0]}+` : `>${numbers[0]}` };
}

export function parseSlidingScale(raw: string): ParsedSlidingScale {
  const abnormalities: AbnormalityFinding[] = [];
  let upper = normalizeNumericDirections(raw).replace(/\bSLIDING[\s-]+SCALE\b/g, 'SLIDING SCALE').replace(/[–—−]/g, '-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/([<>])\s*(?:OR\s*)?=/g, '$1=');
  const fail = (message: string): ParsedSlidingScale => ({ bands: '', schedule: '', route: '', abnormalities: [...abnormalities,
    { id: 'incomplete_sliding_scale', tier: 'uncorrected_gap', title: 'Sliding Scale Requires Review', message,
      trigger: raw }], incomplete: true });

  if (/\b\d+(?:\.\d+)?\s*(?:UNIS|UNITES)\b/.test(upper)) {
    upper = upper.replace(/(\b\d+(?:\.\d+)?\s*)(?:UNIS|UNITES)\b/g, '$1UNITS');
    abnormalities.push({ id: 'insulin_unit_typo', tier: 'applied_correction', title: 'Insulin Unit Typo Normalized',
      message: 'UNIS/UNITES beside a numeric scale dose was read as UNITS. Compare the source before copying.', trigger: raw });
  }
  // A volume is not a unit count. The old parser silently changed 5 mL to 5 U.
  if (/\b\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?|MG)\b/.test(upper)) return fail('Scale dose units need review. Volumes and mass were not relabeled as insulin units.');

  const bands: Band[] = [];
  // Shared notifications can precede or follow several conditions. Remove only
  // the matched notification clause, retaining every condition and recipient.
  const notifications = [
    new RegExp(`\\b(?:NOTIFY|NOTIFIED|CALL)\\s+(${recipient})\\s+(?:IF|FOR)\\s+(${conditionList})`, 'g'),
    new RegExp(`(${conditionList})\\s+(?:NOTIFY|NOTIFIED|CALL)\\s+(${recipient})\\b`, 'g'),
  ];
  notifications.forEach((pattern, index) => {
    upper = upper.replace(pattern, (_whole, first: string, second: string) => {
      const conditions = index ? first : second;
      const who = (index ? second : first).replace(/\s*\/\s*/g, '/');
      for (const match of conditions.matchAll(new RegExp(threshold, 'g'))) {
        const c = condition(match[0]); bands.push({ key: c.key, condition: c.text, action: `CALL ${who}` });
      }
      return ' ';
    });
  });

  const first = [...upper.matchAll(conditionPattern)][0];
  if (!first) return fail('No complete numeric sliding scale was found. Original directions were retained.');
  const header = upper.slice(0, first.index);
  if (/\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/.test(header)) return fail('A fixed dose precedes the scale. Retain both instructions for technician review.');
  const after = upper.slice(first.index);
  // Route/schedule start the common tail. They must not be read from a dose or
  // a notification. Meal timing is optional: QHS/TID/QID/Q6H are valid too.
  const tailStart = after.search(/\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|INTRAMUSCULAR(?:LY)?|IM|BEFORE\s+(?:EACH\s+)?MEALS?|AFTER\s+(?:EACH\s+)?MEALS?|(?:AT\s+)?BEDTIME|(?:[1-4]|ONE|TWO|THREE|FOUR)\s+TIMES?\s+(?:A|PER|EACH)\s+DAY|TWICE DAILY|DAILY|EVERY\s+\d+\s+HOURS?|Q\d+H|ACHS|AC|QD|BID|TID|QID|QAM|QPM|QHS)\b/);
  const body = tailStart < 0 ? after : after.slice(0, tailStart);
  const tail = tailStart < 0 ? '' : after.slice(tailStart);
  if ([...tail.matchAll(conditionPattern)].length) return fail('An additional scale condition follows the schedule. Original directions were retained.');
  const prefixSchedule = header.replace(/\b(?:SLIDING\s+SCALE|INJECT|GIVE|ADMINISTER|AS|PER|THE|IF|FOR BS|FOR BG)\b/g, '').replace(/[:;,]/g, ' ').trim();
  const common = `${prefixSchedule} ${tail}`;
  const route = /\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC)\b/.test(common) ? 'SQ'
    : /\b(?:INTRAMUSCULAR(?:LY)?|IM)\b/.test(common) ? 'IM' : '';
  const schedule = common.replace(/\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|INTRAMUSCULAR(?:LY)?|IM)\b/g, '')
    .replace(/^[\s,;.]+|[\s,;.]+$/g, '').trim();
  const markers = [...body.matchAll(conditionPattern)];
  let impliedUnits = false;
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const c = condition(marker[0]);
    const range = c.text.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (range && Number(range[1]) > Number(range[2])) return fail('A scale range is reversed. Original directions were retained.');
    let action = body.slice(marker.index! + marker[0].length, markers[i + 1]?.index ?? body.length)
      .replace(/^[\s,;:=.]+|[\s,;:.]+$/g, '').trim();
    const actions: string[] = [];
    const dose = action.match(/^(?:(?:GIVE|ADMINISTER|INJECT)\s+)?(\d+(?:\.\d+)?)(?:\s*(UNITS?|U)\b)?(?=$|[\s,;.])/);
    if (dose) {
      actions.push(`${Number(dose[1])}U`);
      impliedUnits ||= !dose[2];
      action = action.slice(dose[0].length);
    }
    action = action.replace(/\b(?:(?:FOLLOW|INITIATE|START)\s+(?:THE\s+)?)?HYPOGLYCEMI[AC]\s+PROTOCOL\b/g, () => {
      actions.push('HYPOGLYCEMIC PROTOCOL'); return '';
    });
    action = action.replace(new RegExp(`\\b(?:NOTIFY|NOTIFIED|CALL)\\s+(${recipient})\\b`, 'g'), (_m, who: string) => {
      actions.push(`CALL ${who.replace(/\s*\/\s*/g, '/')}`); return '';
    });
    action = action.replace(/\bHOLD(?:\s+INSULIN)?\b/g, () => { actions.push('HOLD'); return ''; });
    // Only connective scaffolding may remain. Unknown numbers, operators,
    // recipients, repeat instructions or symbols (e.g. ^ units) cause review.
    const rest = action.replace(/\b(?:AND|FOR|IF|BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE)\b/g, '').replace(/[\s,;:.&]/g, '');
    if (!actions.length || rest) return fail('A scale band contains an unresolved dose or action. Original directions were retained without dropping that instruction.');
    bands.push({ key: c.key, condition: c.text, action: actions.join('&') });
  }
  if (!bands.some(b => /\dU\b/.test(b.action))) return fail('No numeric insulin doses were found. Original directions were retained.');
  if (impliedUnits) abnormalities.push({ id: 'sliding_scale_implied_units', tier: 'applied_correction', title: 'Scale Units Made Explicit',
    message: 'Bare numeric doses in the stated insulin sliding scale were formatted with U. Compare every dose with the original order.', trigger: raw });
  const grouped = new Map<string, Band>();
  for (const b of bands) {
    const old = grouped.get(b.condition);
    const oldDose = old?.action.match(/\d+(?:\.\d+)?U\b/)?.[0];
    const newDose = b.action.match(/\d+(?:\.\d+)?U\b/)?.[0];
    if (oldDose && newDose && oldDose !== newDose) return fail('One scale condition has conflicting doses. Original directions were retained.');
    if (old) old.action = [...new Set([...old.action.split('&'), ...b.action.split('&')])].join('&');
    else grouped.set(b.condition, { ...b });
  }
  const ordered = [...grouped.values()].sort((a, b) => a.key - b.key);
  const doseIntervals = ordered.filter(b => /\dU\b/.test(b.action)).map(b => {
    const numbers = b.condition.match(/\d+(?:\.\d+)?/g)!.map(Number);
    if (numbers.length === 2) return { lower: numbers[0], upper: numbers[1] };
    if (b.condition.startsWith('<')) return { lower: -Infinity, upper: numbers[0] - (b.condition.startsWith('<=') ? 0 : 1) };
    return { lower: numbers[0] + (b.condition.startsWith('>') ? 1 : 0), upper: Infinity };
  }).sort((a, b) => a.lower - b.lower);
  for (let i = 1; i < doseIntervals.length; i++) {
    const previous = doseIntervals[i - 1], next = doseIntervals[i];
    if (next.lower !== previous.upper + 1) abnormalities.push({
      id: next.lower <= previous.upper ? 'sliding_scale_overlap' : 'sliding_scale_gap',
      tier: 'uncorrected_gap', title: 'Scale Boundaries Require Review',
      message: next.lower <= previous.upper ? 'Prescribed dose bands overlap. No boundary or dose was changed.'
        : `No dose band covers ${previous.upper + 1}${next.lower > previous.upper + 2 ? `–${next.lower - 1}` : ''}. The source boundaries were retained.`,
      trigger: raw,
    });
  }
  return { bands: ordered.map(b => `${b.condition}=${b.action}`).join(';'), schedule, route, abnormalities, incomplete: false };
}
