import { normalizeNumericDirections } from './numericDirections';
import type { ParsedSlidingScale } from './slidingScale';
import type { AbnormalityFinding } from './types';
import { hasNumericScaleFollowup, numericScaleFollowups, scaleConditionPattern as markers, scaleCoverageFindings } from './slidingScaleSyntax';

const schedulePattern = /\b(?:BEFORE\s+(?:EACH\s+)?MEALS?(?:\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME)?|WITH\s+(?:EACH\s+)?MEALS?(?:\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME)?|AFTER\s+MEALS?(?:\s+AND\s+(?:AT\s+)?BEDTIME)?|(?:AT\s+)?BEDTIME|(?:[1-4]|ONE|TWO|THREE|FOUR)\s+TIMES?\s+(?:(?:A|PER|EACH)\s+DAY|DAILY)|TWICE DAILY|DAILY|EVERY\s+\d+\s+HOURS?|Q\d+H|ACHS|AC\/HS|WMHS|PCHS|AC|QD|BID|TID|QID|QAM|QPM|QHS)\b/g;
const scheduleText = (text: string) => [...text.matchAll(schedulePattern)].map(match => match[0]).join(' ');
const diagnosisPattern = /\b(?:FDM[12]?|(?:FOR\s+)?(?:(?:TYPE [12] )?DIABETES(?: MELLITUS)?(?: TYPE [12])?|DM(?:[12]|\s+(?:II|I))?))\b/g;
const coursePattern = /\b(?:FOR\s+(?:UP\s+TO\s+)?|X\s*)\d+(?:\.\d+|\s*[-/]\s*\d+)?\s*(?:DAYS?|D\b|WEEKS?|WKS?|WK\b|MONTHS?|MOS?|HOURS?|HRS?|HR\b|H\b)\b/g;
const clean = (text: string) => text.replace(/^[\s,;:=.&]+|[\s,;:=.&]+$/g, '').trim();

function rescueScope(action: string) {
  const timing = [...action.matchAll(schedulePattern)].pop();
  if (timing) {
    const before = action.slice(0, timing.index);
    if (/\bFOR\s*$/.test(before) && !clean(action.slice(timing.index + timing[0].length))) {
      return { action: clean(before.replace(/\bFOR\s*$/, '')), schedule: timing[0] };
    }
  }
  return { action: clean(action), schedule: '' };
}

export function hasMultipleFixedSchedules(text: string): boolean {
  const timings = [...text.matchAll(schedulePattern)];
  if (timings.length < 2) return false;
  const [count, timing] = timings.map(match => match[0]);
  return timings.length !== 2 || !(/^(?:4|FOUR) TIMES/.test(count) && /^(?:BEFORE|WITH|AFTER) .*BEDTIME$/.test(timing));
}

export function trailingScaleDose(text: string) {
  return [...text.matchAll(/\b(AND|ALSO|PLUS)\s+(?:GIVE|INJECT|ADMINISTER)\s+\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/g)]
    .find(match => {
      const prefix = text.slice(0, match.index);
      if (/\.\s*$/.test(prefix)) return true;
      const lastSchedule = [...prefix.matchAll(schedulePattern)].pop();
      return lastSchedule && /^[\s,;.]*(?:DM(?:[12]|\s+(?:II|I))?\b[\s,;.]*)?$/.test(prefix.slice(lastSchedule.index + lastSchedule[0].length));
    });
}

/** Anything beyond the recognized fixed dose/schedule must remain visible. */
export function fixedScaleDoseRemainder(source: string, hold?: string): string {
  let rest = normalizeNumericDirections(source);
  if (hold) rest = rest.replace(hold, '');
  return clean(rest.replace(/\b(?:INJ|INJECT|GIVE|ADMINISTER)?\s*\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/, '')
    .replace(schedulePattern, '').replace(/\b(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?|PLUS|FDM[12]?)\b/g, '')
    .replace(/[()]/g, '').replace(/\s+/g, ' '));
}

/** Second grammar for prose tables and distributed low-glucose/base clauses. */
export function parseProseSlidingScale(source: string): ParsedSlidingScale {
  let text = normalizeNumericDirections(source).replace(/[–—−]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/\b(\d+)\s+(?:OR GREATER|AND ABOVE|OR MORE)\b/g, '>=$1')
    .replace(/\b(\d+)\s+(?:OR LESS(?!\s+THAN)|AND BELOW)\b/g, '<=$1')
    .replace(new RegExp('(' + markers.source + ')\\s*MG\\s*\\/\\s*DL\\b', 'g'), '$1');
  const abnormalities: AbnormalityFinding[] = [];
  const finding = (id: string, message: string, trigger?: string) => abnormalities.push({ id, tier: 'uncorrected_gap', title: 'Scale Instruction Retained for Review', message, trigger });
  let baseInstruction: string | undefined;
  const fail = (reason: string, schedule = ''): ParsedSlidingScale => ({ bands: '', schedule, route: '', baseInstruction,
    abnormalities: [...abnormalities, { id: 'incomplete_sliding_scale', tier: 'uncorrected_gap', title: 'Sliding Scale Requires Review', message: reason, trigger: source }], incomplete: true });

  // A fixed clause after the table is independent of any preceding glucose band.
  const trailingBase = trailingScaleDose(text);
  if (trailingBase) {
    const conjunction = trailingBase[0].match(/^(?:AND|ALSO|PLUS)\s+/)![0];
    baseInstruction = text.slice(trailingBase.index + conjunction.length).trim();
    text = text.slice(0, trailingBase.index).trim();
  }
  const firstMarker = [...text.matchAll(markers)][0];
  if (!firstMarker) return fail('No complete numeric scale was found.');
  let header = text.slice(0, firstMarker.index);
  const headerAction = header.match(/\b(HOLD(?:\s+INSULIN)?\s+(?:IF|FOR|WHEN)(?:\s+(?:BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE))?(?:\s+IS)?)\s*$/);
  if (headerAction) header = header.slice(0, headerAction.index);
  const startingBase = header.match(/^(.*?)\b(?:PLUS|AND|ALSO)\s+(?:INJECT\s+)?(?:AS\s+PER\s+|PER\s+|THE\s+)?(?:SLIDING|CORRECTION)\s+SCALE\b(.*)$/);
  if (/\b\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/.test(header)) {
    if (!startingBase || baseInstruction) return fail('The fixed dose and correction scale need separate review.');
    baseInstruction = startingBase[1].trim(); header = startingBase[2];
  }
  const after = text.slice(firstMarker.index);
  if (/[.;]\s*(?:AT BEDTIME|WITH MEALS|BEFORE MEALS|QHS|ACHS|WMHS)\s*:/.test(after)) return fail('Separate scale schedules were retained without merging their bands.');
  const followups = numericScaleFollowups(after);
  const found = [...after.matchAll(markers)].filter(marker => !followups.some(followup =>
    marker.index >= followup.index && marker.index < followup.index + followup[0].length));
  const sections = found.map((marker, i) => after.slice(marker.index! + marker[0].length, found[i + 1]?.index));
  // A dose-specific schedule is not an ordinary common schedule. Retain its
  // entire wording until it can be represented without assigning it to all bands.
  if (sections.slice(0, -1).some(section => scheduleText(section) && !/\bGLUCAGON\b/.test(section)
      && !/,\s*(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b/.test(section))) {
    return fail('A glucose band has its own schedule. Its qualifier was retained without merging schedules.', scheduleText(header));
  }
  // The basal clause was removed from header above. Its route/schedule must
  // not leak back into the correction scale through the original full text.
  const routeSchedules = sections.slice(0, -1).map(section => section.match(/,\s*(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b(.*)/)?.[1] || '')
    .map(scheduleText);
  const tail = sections[sections.length - 1] || '';
  const tailTiming = /\bGLUCAGON\b/.test(tail) ? rescueScope(tail.replace(diagnosisPattern, '')).schedule : scheduleText(tail);
  const schedules = [...new Set([scheduleText(header), ...routeSchedules, tailTiming].filter(Boolean))];
  if (schedules.length > 1) return fail('More than one correction-scale schedule was found. Their source scopes were retained.');
  const schedule = schedules[0] || '';
  const diagnosisSource = `${text} ${baseInstruction || ''}`;
  const diagnosis = diagnosisSource.match(diagnosisPattern)?.[0]?.replace(/^FOR\s+/, '').replace(/^DM II$/, 'DM2').replace(/^DM I$/, 'DM1');
  const courses = [...header.matchAll(coursePattern)].map(match => match[0]);
  const shared = [schedule, ...courses, diagnosis ? `FOR ${diagnosis.replace(/^FDM/, 'DM')}` : ''].filter(Boolean).join(' ');
  const outsideFollowups = followups.reduceRight((rest, match) => rest.slice(0, match.index) + rest.slice(match.index + match[0].length), after);
  if (hasNumericScaleFollowup(outsideFollowups)) return fail('A repeat-reading threshold has an unresolved action. Its source scope was retained.', shared);
  // SS/CBS account for the ordinary preamble, not for extra source qualifiers.
  // Course wording goes through the existing duration resolver; other wording
  // remains visible instead of disappearing when the numeric table parses.
  const headerQualifier = clean(header
    .replace(/\bIF(?:\s+(?:(?:THE\s+)?(?:READING|BS|BG|BLOOD SUGAR|BLOOD GLUCOSE)(?:\s+IS)?))?\s*$/, '')
    .replace(schedulePattern, '').replace(coursePattern, '')
    .replace(diagnosisPattern, '')
    .replace(/\b(?:CBS|CHECK\s+(?:THE\s+)?BLOOD\s+(?:SUGAR|GLUCOSE)|(?:SLIDING|CORRECTION)\s+SCALE|ACCORDING TO|AS PER)\b/g, '')
    .replace(/\b(?:(?:INJECT|GIVE|ADMINISTER)(?:\s+INSULIN)?|AND|AS|PER|THE|SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b/g, '')
    .replace(/\s+/g, ' '));
  if (headerQualifier) finding('sliding_scale_unparsed_action', 'A header qualifier remains beside the translated scale for technician review.', headerQualifier);
  const bands: Array<{ key: number; condition: string; action: string; dose?: number }> = [];
  let carried = headerAction?.[1] || '';

  for (let index = 0; index < found.length; index++) {
    const marker = found[index][0];
    const values = marker.match(/\d+(?:\.\d+)?/g)!.map(Number);
    if (values.length === 2 && values[0] > values[1]) return fail('A source scale range is reversed.', shared);
    const low = /^(?:<|LESS)/.test(marker), inclusive = /[=+]|EQUAL/.test(marker);
    const condition = values.length === 2 ? `${values[0]}-${values[1]}` : low ? `${inclusive ? '<=' : '<'}${values[0]}` : `${inclusive ? '' : '>'}${values[0]}${inclusive ? '+' : ''}`;
    let action = clean(sections[index]);
    const nextPrefix = action.match(/(?:^|[.;,]\s*|\bAND\s+)((?:HOLD(?:\s+INSULIN)?|CALL MD)\s+(?:IF|FOR|WHEN)(?:\s+(?:BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE))?(?:\s+IS)?)$/);
    const currentCarry = carried; carried = '';
    if (nextPrefix && index + 1 < found.length) { carried = nextPrefix[1]; action = clean(action.slice(0, nextPrefix.index)); }
    const followup = numericScaleFollowups(action)[0];
    if (followup) {
      if (!/\bRECHECK\b/.test(action.slice(0, followup.index)) || numericScaleFollowups(action).length > 1) {
        return fail('A repeat-reading threshold could not be linked to its recheck.', shared);
      }
      action = clean(action.slice(0, followup.index) + ' ' + action.slice(followup.index + followup[0].length));
    }
    const rescue = /\bGLUCAGON\b/.test(action);
    action = clean(`${currentCarry} ${action}`)
      .replace(/(?:[.;,]\s*)?\bIF(?:\s+(?:(?:THE\s+)?(?:READINGS?|BS|BG|BLOOD SUGAR|BLOOD GLUCOSE)(?:\s+(?:IS|ARE))?))?\s*$/, '')
      .replace(diagnosisPattern, '');
    if (rescue) {
      // Keep a rescue dose, route and AND/OR together. Only an explicit trailing
      // FOR + common schedule is outside the rescue action.
      action = rescueScope(action).action;
      if (followup) return fail('A repeat-reading threshold is attached to a rescue clause and needs review.', shared);
      if (!/\b\d+(?:\.\d+)?\s*(?:MG|ML|MILLILITERS?)\b/.test(action)
        || !/\b(?:IM|INTRAMUSCULAR(?:LY)?|INTO THE MUSCLE)\b/.test(action)) {
        finding('sliding_scale_rescue_review', 'The glucagon rescue dose or route needs pharmacist clarification. Source wording was retained.', action);
      }
      if (bands.some(band => band.condition === condition)) return fail('Repeated rescue conditions need review.', shared);
      bands.push({ key: low ? -1e9 + values[0] : values[0], condition, action });
      continue;
    }
    action = action.replace(schedulePattern, '').replace(/\b(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b/g, '');
    const actions: string[] = [];
    if (/\b\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?|MG)\b/.test(action)) {
      return fail('A scale dose is stated as mass or volume. It was not relabeled as insulin units.', shared);
    }
    action = clean(action)
      .replace(/^CALL MD\s+AND\s+((?:GIVE|ADMINISTER|INJECT)\s+\d+(?:\.\d+)?\s*(?:UNITS?|U)\b)/, '$1 AND CALL MD')
      .replace(/^(?:THEN\s+)?(?:(?:GIVE|ADMINISTER|INJECT)\s+)?/, '');
    const dose = action.match(/^(\d+(?:\.\d+)?)(?:\s*(UNITS?|U|UNIS|UNITES)\b)?(?=$|[\s,;.&])/);
    let doseValue: number | undefined;
    if (dose) {
      doseValue = Number(dose[1]); actions.unshift(`${doseValue}U`); action = action.slice(dose[0].length);
      if (!dose[2]) abnormalities.push({ id: 'sliding_scale_implied_units', tier: 'applied_correction', title: 'Scale Units Made Explicit', message: 'Bare insulin scale doses were formatted with U.', trigger: marker });
      if (/UNIS|UNITES/.test(dose[2] || '')) abnormalities.push({ id: 'insulin_unit_typo', tier: 'applied_correction', title: 'Insulin Unit Typo Normalized', message: 'The dose-unit spelling was normalized to U.', trigger: dose[0] });
      if (!dose[2]) action = action.replace(/^\s*(?:GIVE|ADMINISTER|INJECT)\s+(\d+(?:\.\d+)?)\s+UNITS?\b/, (raw, number: string) => Number(number) === doseValue ? '' : raw);
    }
    action = action.replace(/\b(?:(?:FOLLOW|INITIATE|START|BEGIN|BEING|PERFORM|PER)\s+(?:THE\s+)?)?HYPOGLYCEMI[AC]\s+PROTOCOL\b/g, () => { actions.push('HYPOGLYCEMIC PROTOCOL'); return ''; });
    action = action.replace(/\bRECHECK\s+(?:(?:BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE)\s+)?(?:IN\s*|AFTER\s+)?(\d+(?:\.\d+)?)\s*(HOURS?|HRS?|H|MINUTES?|MINS?)\b/g,
      (_m, count: string, units: string) => { actions.push(`RECHECK ${count}${units.startsWith('H') ? 'H' : 'MIN'}`); return ''; });
    if (followup) {
      if (!actions.some(step => step.startsWith('RECHECK '))) return fail('The recheck interval requires review.', shared);
      actions.push(followup[0].trim());
    }
    action = action.replace(/\bIF\s+(?:(?:THE\s+)?(?:READINGS?|BLOOD SUGAR|GLUCOSE)\s+)?(?:(?:IS|ARE|REMAIN)\s+)?STILL\s+(HIGH|ABNORMAL)\s*,?\s*CALL MD\b/g,
      (_m, state: string) => { actions.push(`CALL MD IF STILL ${state}`); return ''; });
    action = action.replace(/\bCALL MD\b/g, () => { actions.push('CALL MD'); return ''; });
    action = action.replace(/\bHOLD(?:\s+INSULIN)?\b/g, () => { actions.push('HOLD'); return ''; });
    action = action.replace(/\bRECORD (?:THE )?CRITICAL RESULT\b/g, () => { actions.push('RECORD CRITICAL RESULT'); return ''; });
    if (doseValue === 0) action = action.replace(/\bNO (?:ADDITIONAL )?INSULIN(?: NEEDED| REQUIRED)?\b/g, '');
    action = action.replace(/\bIN ADDITION TO (?:THE )?SCHEDULED INSULIN\b/g, '')
      .replace(/\bGIVE (?:THE )?SLIDING SCALE\b|\bBASED ON BLOOD SUGAR RESULTS\b/g, '');
    const rest = clean(action.replace(/\b(?:AND|THEN|IF|FOR|BS|BG|CBS|BLOOD SUGAR|BLOOD GLUCOSE)\b/g, '').replace(/[&]/g, ' '));
    if (!actions.length || /[\d^<>=+]|\b(?:UNITS?|DOSE|GIVE|ADMINISTER|INJECT|UNSPECIFIED|UNCLEAR)\b/.test(rest)) return fail(`Unresolved action at ${condition}: ${rest || sections[index]}. Source wording was retained.`, shared);
    if (rest) { actions.push(rest); finding('sliding_scale_unparsed_action', 'Additional source wording remains beside its own scale condition.', rest); }
    const existing = bands.find(band => band.condition === condition);
    if (existing && existing.dose !== undefined && doseValue !== undefined && existing.dose !== doseValue) return fail('One scale condition has conflicting doses.', shared);
    if (existing) {
      existing.dose ??= doseValue;
      existing.action = [...new Set([...existing.action.split('&'), ...actions])].join('&');
    }
    else bands.push({ key: low ? -1e9 + values[0] : values[0], condition, action: [...new Set(actions)].join('&'), dose: doseValue });
  }
  if (!bands.some(band => band.dose !== undefined)) return fail('No numeric insulin correction dose was recognized.', shared);
  bands.sort((a, b) => a.key - b.key);
  abnormalities.push(...scaleCoverageFindings(bands.filter(band => band.dose !== undefined).map(band => band.condition), source));
  return { bands: bands.map(band => `${band.condition}=${band.action}`).join(';'), schedule: shared, route: 'SQ', baseInstruction,
    independentFixedDose: !!trailingBase && trailingBase[1] !== 'PLUS',
    retainedInstructions: headerQualifier || undefined, abnormalities, incomplete: false };
}
