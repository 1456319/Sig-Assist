import { normalizeNumericDirections } from './numericDirections';
import { splitSupplementalDirections } from './instructionClauses';
import type { AbnormalityFinding } from './types';
import { parseProseSlidingScale, trailingScaleDose } from './slidingScaleProse';
import { hasNumericScaleFollowup, numericScaleFollowups, scaleConditionPattern as conditionPattern, scaleCoverageFindings } from './slidingScaleSyntax';

interface Band { key: number; condition: string; action: string }
export interface ParsedSlidingScale {
  bands: string;
  schedule: string;
  route: string;
  abnormalities: AbnormalityFinding[];
  incomplete: boolean;
  baseInstruction?: string;
  independentFixedDose?: boolean;
  retainedInstructions?: string;
  retainedSource?: string;
}

// Conditions and actions are parsed separately. A matched range is not evidence
// that its complete dose, notification or later threshold has been captured.
const recipient = '(?:NP\\s*\\/\\s*PA|PA\\s*\\/\\s*NP|MD|NP|PA|PROVIDER|PRESCRIBER|PHYSICIAN)';
const comparison = '(?:[<>]=?|GREATER THAN(?: OR EQUALS?(?: TO)?)?|LESS THAN(?: OR EQUALS?(?: TO)?)?)';
const threshold = `(?:${comparison})\\s*\\d+(?:\\.\\d+)?`;
const glucose = '(?:(?:BS|BG|CBS|BLOOD (?:SUGAR|GLUCOSE))\\s*)?';
const conditionList = `${glucose}${threshold}(?:\\s+(?:OR|AND)\\s+${glucose}${threshold})*`;

function normalizeScale(raw: string): string {
  return normalizeNumericDirections(raw).replace(/\bSLIDING[\s-]+SCALE\b/g, 'SLIDING SCALE').replace(/[–—−]/g, '-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/([<>])\s*(?:OR\s*)?=/g, '$1=')
    .replace(/\b(\d+(?:\.\d+)?)\s+(?:OR GREATER|AND (?:ABOVE|HIGHER)|OR MORE)\b/g, '>=$1')
    // "400 or less than 60" contains two opposite thresholds. Do not turn 400 into <=400.
    .replace(/\b(\d+(?:\.\d+)?)\s+(?:OR LESS(?!\s+THAN\b)|AND (?:BELOW|LOWER))\b/g, '<=$1')
    // Only a label immediately following a glucose condition is removable.
    // A purported dose of "2 mg/dL" must still fail the dose-unit check.
    .replace(new RegExp('(' + conditionPattern.source + ')\\s*MG\\s*\\/\\s*DL\\b', 'g'), '$1');
}

/** Shared routing guard: never let a condition's dose become a fixed insulin dose. */
export function looksLikeSlidingScale(raw: string, drugName = ''): boolean {
  const upper = normalizeScale(raw);
  if (/\b(?:(?:SLIDING|CORRECTION)\s+SCALE|PER\s+(?:THE\s+)?SCALE)\b/.test(upper)) return true;
  const insulin = /\b(?:INSULIN|LISPRO|ASPART|GLULISINE|HUMALOG|HUMULIN|NOVOLOG|NOVOLIN|APIDRA|ADMELOG|FIASP|LYUMJEV)\b/i.test(drugName) || /\bINSULIN\b/.test(upper);
  const markers = [...upper.matchAll(conditionPattern)];
  if (!insulin || markers.length < 2) return false;
  const dose = /^[\s,:=]*(?:(?:GIVE|ADMINISTER|INJECT)\s+)?\d+(?:\.\d+)?(?:\s*(?:UNITS?|U|UNIS|UNITES)\b)?(?=$|[\s,;:.&])/;
  return markers.some((marker, index) => dose.test(upper.slice(marker.index! + marker[0].length, markers[index + 1]?.index)));
}

function condition(value: string): { key: number; text: string } {
  const numbers = value.match(/\d+(?:\.\d+)?/g)!.map(Number);
  if (numbers.length === 2) return { key: numbers[0], text: `${numbers[0]}-${numbers[1]}` };
  const low = /^(?:<|LESS)/.test(value);
  const inclusive = /[=+]|EQUAL/.test(value);
  return { key: low ? -1e9 + numbers[0] : numbers[0] + 0.01,
    text: low ? `${inclusive ? '<=' : '<'}${numbers[0]}` : inclusive ? `${numbers[0]}+` : `>${numbers[0]}` };
}

function parseLegacySlidingScale(raw: string): ParsedSlidingScale {
  const abnormalities: AbnormalityFinding[] = [];
  let upper = normalizeScale(raw);
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
  const retainAction = (text: string) => {
    abnormalities.push({ id: 'sliding_scale_unparsed_action', tier: 'uncorrected_gap', title: 'Scale Action Retained for Review',
      message: `The recognized scale bands were translated. This additional instruction was retained verbatim for technician review: ${text}`,
      trigger: text });
    return text;
  };
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

  // Unknown recipients do not make recognized insulin doses ambiguous. Keep
  // the source notification alongside each of its conditions and flag it.
  const unknownNotifications = [
    new RegExp(`\\b(NOTIFY|NOTIFIED|CALL)\\s+([^;:,.=<>]+?)\\s+(?:IF|FOR)\\s+(${conditionList})`, 'g'),
    new RegExp(`(${conditionList})\\s+(NOTIFY|NOTIFIED|CALL)\\s+([^;:,.=<>]+?)(?=[,;.]|$|\\s+(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|BEFORE|AFTER|AT BEDTIME)\\b)`, 'g'),
  ];
  unknownNotifications.forEach((pattern, index) => {
    upper = upper.replace(pattern, (_whole, first: string, second: string, third: string) => {
      const conditions = index ? first : third;
      const action = retainAction(index ? `${second} ${third.trim()}` : `${first} ${second.trim()}`);
      for (const match of conditions.matchAll(new RegExp(threshold, 'g'))) {
        const c = condition(match[0]); bands.push({ key: c.key, condition: c.text, action });
      }
      return ' ';
    });
  });

  const first = [...upper.matchAll(conditionPattern)][0];
  if (!first) return fail('No complete numeric sliding scale was found. Original directions were retained.');
  let header = upper.slice(0, first.index);
  let baseInstruction: string | undefined;
  if (/\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/.test(header)) {
    const additive = header.match(/^(.*?)\bPLUS\s+(?:(?:THE\s+)?(?:SLIDING|CORRECTION)\s+SCALE)\b(.*)$/);
    if (!additive) return fail('A fixed dose precedes the scale without an explicit additive instruction. Retain both instructions for technician review.');
    const simpleBase = additive[1].match(/^\s*(?:INJECT|GIVE|ADMINISTER)\s+(\d+(?:\.\d+)?)\s*(?:UNITS?|U)\s*$/);
    // A separately scheduled basal dose is kept as its own source clause;
    // never assign the correction scale's schedule to that dose.
    baseInstruction = simpleBase ? `INJ ${Number(simpleBase[1])}U PLUS` : `${additive[1].trim().replace(/[.;]+$/, '')}. PLUS`;
    if (!simpleBase) retainAction(additive[1].trim());
    header = additive[2];
  }
  const after = upper.slice(first.index);
  // Route/schedule start the common tail. They must not be read from a dose or
  // a notification. Meal timing is optional: QHS/TID/QID/Q6H are valid too.
  const tailStart = after.search(/\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|INTRAMUSCULAR(?:LY)?|IM|BEFORE\s+(?:EACH\s+)?(?:MEALS?|BREAKFAST|LUNCH|DINNER|SUPPER)|AFTER\s+(?:EACH\s+)?(?:MEALS?|BREAKFAST|LUNCH|DINNER|SUPPER)|(?:AT\s+)?BEDTIME|(?:[1-4]|ONE|TWO|THREE|FOUR)\s+TIMES?\s+(?:A|PER|EACH)\s+DAY|TWICE DAILY|DAILY|EVERY\s+\d+\s+HOURS?|Q\d+H|ACHS|AC|QD|BID|TID|QID|QAM|QPM|QHS)\b/);
  const body = tailStart < 0 ? after : after.slice(0, tailStart);
  const tail = tailStart < 0 ? '' : after.slice(tailStart);
  if ([...tail.matchAll(conditionPattern)].length) return fail('An additional scale condition follows the schedule. Original directions were retained.');
  // Separate a qualified action before combining the tail with the header's
  // common schedule. Otherwise "AT BEDTIME GIVE HALF..." becomes an extra
  // bedtime frequency and only GIVE HALF survives, losing its dose scope.
  const tailClauses = splitSupplementalDirections(tail, { allowScaleActions: true });
  const retainedInstructions = tailClauses.supplemental ? retainAction(tailClauses.supplemental) : undefined;
  const prefixSchedule = header.replace(/\b(?:(?:SLIDING|CORRECTION)\s+SCALE|SCALE|INJECT|GIVE|ADMINISTER|AS|PER|THE|IF|FOR BS|FOR BG)\b/g, '').replace(/[:;,]/g, ' ').trim();
  const common = `${prefixSchedule} ${tailClauses.primary}`;
  const route = /\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC)\b/.test(common) ? 'SQ'
    : /\b(?:INTRAMUSCULAR(?:LY)?|IM)\b/.test(common) ? 'IM' : '';
  const schedule = common.replace(/\b(?:SUBCUTANEOUS(?:LY)?|SQ|SUBQ|SC|INTRAMUSCULAR(?:LY)?|IM)\b/g, '')
    .replace(/^[\s,;.]+|[\s,;.]+$/g, '').trim();
  const markers = [...body.matchAll(conditionPattern)];
  let impliedUnits = false;
  let carried = '';
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const c = condition(marker[0]);
    const range = c.text.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (range && Number(range[1]) > Number(range[2])) return fail('A scale range is reversed. Original directions were retained.');
    let action = body.slice(marker.index! + marker[0].length, markers[i + 1]?.index ?? body.length)
      .replace(/^[\s,;:=.]+|[\s,;:.]+$/g, '').trim();
    // "HOLD IF BS <70": the action precedes its own condition. It belongs to
    // the next band, never to the preceding band's dose.
    if (carried) { action = `${carried} ${action}`.trim(); carried = ''; }
    const leading = action.match(/(?:^|[.;,]\s*)((?:HOLD(?:\s+INSULIN)?|(?:NOTIFY|CALL)\s+[A-Z/]+)\s+(?:IF|FOR|WHEN)(?:\s+(?:BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE))?(?:\s+IS)?)$/);
    if (leading && i + 1 < markers.length) { carried = leading[1]; action = action.slice(0, leading.index).replace(/[\s,;:.]+$/, '').trim(); }
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
    action = action.replace(/\bRECHECK\s+(?:(?:BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE)\s+)?IN\s+\d+(?:\.\d+)?\s+(?:HOURS?|MINUTES?)\b/g, value => {
      actions.push(value); return '';
    });
    const rest = action.replace(/\b(?:AND|FOR|IF|BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE)\b/g, '').replace(/[\s,;:.&]/g, '');
    if (!actions.length || /[\d^<>=+]/.test(rest)) return fail('A scale band contains an unresolved dose or action. Original directions were retained without dropping that instruction.');
    if (rest) {
      const retained = action.replace(/^[\s,;:.&]+|[\s,;:.&]+$/g, '').replace(/^(?:AND|FOR)\s+/, '').trim();
      // Unknown dosing language is not a notification. Do not let a recognized
      // CALL/HOLD action hide an absent or ambiguous insulin dose.
      if (/\b(?:UNITS?|DOSES?|GIVE|ADMINISTER|INJECT|UNSPECIFIED|UNCLEAR)\b/.test(retained)
        || (!dose && !/^(?:NOTIFY|NOTIFIED|CALL)\b/.test(retained))) {
        return fail('A scale band contains an unresolved dose. Original directions were retained without dropping that instruction.');
      }
      actions.push(retainAction(retained));
    }
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
  abnormalities.push(...scaleCoverageFindings(ordered.filter(b => /^\d+(?:\.\d+)?U\b/.test(b.action)).map(b => b.condition), raw));
  return { bands: ordered.map(b => `${b.condition}=${b.action}`).join(';'), schedule, route, abnormalities, incomplete: false, baseInstruction, retainedInstructions };
}


export function parseSlidingScale(raw: string): ParsedSlidingScale {
  const source = raw.toUpperCase();
  const canonicalize = (part: string) => part
    .replace(/\bCALLD\s*\/\s*NP\b/g, 'CALL MD')
    .replace(/\bCALL(?=MD\b)/g, 'CALL ')
    .replace(/\b(?:CALL|NOTIFY|NOTIFIED)\s+(?:MD|NP|PA)(?:\s*(?:\/|AND)\s*(?:MD|NP|PA))+/g, 'CALL MD')
    .replace(/\b(?:CALL|NOTIFY|NOTIFIED)\s+((?!(?:IF|FOR|WHEN|IN|AFTER)\b)[^;:,.=<>]+?)(?=\s+(?:IF|FOR|WHEN|AND|AT|IN|AFTER)\b|[;:,.=<>]|$)/g, 'CALL MD')
    .replace(/\bCALL MD\s+FOR (?:FURTHER (?:ORDERS|INSTRUCTIONS)|INSTRUCTIONS)\b/g, 'CALL MD');
  const followups = numericScaleFollowups(source);
  let cursor = 0;
  const canonical = followups.map(match => {
    const before = canonicalize(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    return before + match[0];
  }).join('') + canonicalize(source.slice(cursor));
  const legacy = parseLegacySlidingScale(canonical);
  const firstCondition = canonical.search(conditionPattern);
  const leadingHold = firstCondition >= 0 && /\bHOLD(?:\s+INSULIN)?\s+(?:IF|FOR|WHEN)[^.;]*$/.test(canonical.slice(0, firstCondition));
  const conditionalFollowup = /\bIF\s+(?:(?:THE\s+)?(?:READINGS?|BLOOD SUGAR|GLUCOSE)\s+)?(?:(?:IS|ARE)\s+)?STILL\s+(?:HIGH|ABNORMAL)\b/.test(canonical);
  const result = legacy.incomplete || leadingHold || conditionalFollowup || hasNumericScaleFollowup(canonical) || /\bGLUCAGON\b/.test(canonical) || trailingScaleDose(canonical)
    ? parseProseSlidingScale(canonical) : legacy;
  const findings = canonical !== source && !result.incomplete ? [{ id: 'site_scale_notification', tier: 'applied_correction' as const,
    title: 'Site Notification Wording Applied', message: 'Notification recipient/purpose variants use CALL MD under the technician-specified scale format.', trigger: raw }] : [];
  return { ...result, retainedSource: source, abnormalities: [...findings, ...result.abnormalities] };
}
