import { normalizeNumericDirections } from './numericDirections';
import type { ParsedSlidingScale } from './slidingScale';
import type { AbnormalityFinding } from './types';

const markers = /(?<![\d.])\b\d+(?:\.\d+)?\s*(?:-|TO)\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*\+|(?:[<>]=?|GREATER THAN(?: OR EQUALS?(?: TO)?)?|LESS THAN(?: OR EQUALS?(?: TO)?)?)\s*\d+(?:\.\d+)?/g;
const schedulePattern = /\b(?:BEFORE\s+(?:EACH\s+)?MEALS?(?:\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME)?|WITH\s+(?:EACH\s+)?MEALS?(?:\s+(?:AND|&)\s+(?:AT\s+)?BEDTIME)?|AFTER\s+MEALS?(?:\s+AND\s+(?:AT\s+)?BEDTIME)?|(?:AT\s+)?BEDTIME|(?:[1-4]|ONE|TWO|THREE|FOUR)\s+TIMES?\s+(?:(?:A|PER|EACH)\s+DAY|DAILY)|TWICE DAILY|DAILY|EVERY\s+\d+\s+HOURS?|Q\d+H|ACHS|AC\/HS|WMHS|PCHS|AC|QD|BID|TID|QID|QAM|QPM|QHS)\b/g;
const scheduleText = (text: string) => [...text.matchAll(schedulePattern)].map(match => match[0]).join(' ');
const clean = (text: string) => text.replace(/^[\s,;:=.&]+|[\s,;:=.&]+$/g, '').trim();

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
    .replace(/(\b\d+\s*-\s*\d+|[<>]=?\s*\d+|\b\d+\+)\s*MG\s*\/\s*DL\b/g, '$1');
  const abnormalities: AbnormalityFinding[] = [];
  const finding = (id: string, message: string, trigger?: string) => abnormalities.push({ id, tier: 'uncorrected_gap', title: 'Scale Instruction Retained for Review', message, trigger });
  let baseInstruction: string | undefined;
  const fail = (reason: string, schedule = ''): ParsedSlidingScale => ({ bands: '', schedule, route: '', baseInstruction,
    abnormalities: [...abnormalities, { id: 'incomplete_sliding_scale', tier: 'uncorrected_gap', title: 'Sliding Scale Requires Review', message: reason, trigger: source }], incomplete: true });

  // A fixed clause after the table is independent of any preceding glucose band.
  const trailingBase = [...text.matchAll(/\b(?:AND|PLUS)\s+(?:GIVE|INJECT|ADMINISTER)\s+\d+(?:\.\d+)?\s*(?:UNITS?|U)\b/g)]
    .find(match => /[.;]\s*$/.test(text.slice(0, match.index)));
  if (trailingBase) {
    baseInstruction = text.slice(trailingBase.index + trailingBase[0].match(/^(?:AND|PLUS)\s+/)![0].length).trim();
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
  const found = [...after.matchAll(markers)];
  const sections = found.map((marker, i) => after.slice(marker.index! + marker[0].length, found[i + 1]?.index));
  // A dose-specific schedule is not an ordinary common schedule. Retain its
  // entire wording until it can be represented without assigning it to all bands.
  if (sections.slice(0, -1).some(section => scheduleText(section) && !/\b(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b/.test(section))) {
    return fail('A glucose band has its own schedule. Its qualifier was retained without merging schedules.', scheduleText(header));
  }
  // The basal clause was removed from header above. Its route/schedule must
  // not leak back into the correction scale through the original full text.
  const scaleText = `${header} ${after}`;
  const routeSchedules = [...scaleText.matchAll(/\b(?:SQ|SUBQ|SC|SUBCUTANEOUS(?:LY)?)\b([^.;]*)/g)].map(m => scheduleText(m[1]));
  const schedule = [scheduleText(header), ...routeSchedules, scheduleText(sections[sections.length - 1] || '')].filter(Boolean).join(' ')
    || scheduleText(baseInstruction || '');
  const diagnosisSource = `${text} ${baseInstruction || ''}`;
  const diagnosis = diagnosisSource.match(/\bFDM[12]?\b/)?.[0] || (diagnosisSource.match(/\bFOR\s+((?:TYPE [12] )?DIABETES(?: MELLITUS)?(?: TYPE [12])?|DM[12]?)\b/)?.[1]);
  const shared = [schedule, diagnosis ? `FOR ${diagnosis.replace(/^FDM/, 'DM')}` : ''].filter(Boolean).join(' ');
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
    action = clean(`${currentCarry} ${action}`)
      .replace(/(?:[.;,]\s*)?\bIF(?:\s+(?:(?:THE\s+)?(?:READINGS?|BS|BG|BLOOD SUGAR|BLOOD GLUCOSE)(?:\s+(?:IS|ARE))?))?\s*$/, '')
      .replace(schedulePattern, '')
      .replace(/\b(?:FDM[12]?|FOR\s+(?:(?:TYPE [12] )?DIABETES(?: MELLITUS)?(?: TYPE [12])?|DM[12]?))\b/g, '')
      .replace(/\b(?:SQ|SC|SUBQ|SUBCUTANEOUS(?:LY)?)\b/g, '');
    const actions: string[] = [];
    const glucagon = /\bGLUCAGON\b/.test(action);
    if (glucagon) {
      action = action.replace(/\b(?:(?:GIVE|ADMINISTER|INJECT)\s+)?(?:\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?|MG)\s+(?:OF\s+)?)?GLUCAGON(?:\s+\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?|MG))?(?:\s+(?:IM|INTRAMUSCULAR(?:LY)?|INTO THE MUSCLE))?/g, '')
        .replace(/\b(?:FOR LOW BLOOD SUGAR|FOR HYPOGLYCEMIA|BY INTRAMUSCULAR INJECTION)\b/g, '');
      actions.push('1ML GLUCAGON IM');
      abnormalities.push({ id: 'site_glucagon_rescue', tier: 'applied_correction', title: 'Site Glucagon Rescue Format Applied',
        message: 'The supplied glucagon rescue clause uses the technician-specified 1ML GLUCAGON IM format. Compare the source rescue instruction.', trigger: sections[index] });
    }
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
    if (existing) existing.action = [...new Set([...existing.action.split('&'), ...actions])].join('&');
    else bands.push({ key: low ? -1e9 + values[0] : values[0], condition, action: [...new Set(actions)].join('&'), dose: doseValue });
  }
  if (!bands.some(band => band.dose !== undefined)) return fail('No numeric insulin correction dose was recognized.', shared);
  bands.sort((a, b) => a.key - b.key);
  const intervals = bands.filter(band => band.dose !== undefined).map(band => {
    const values = band.condition.match(/\d+(?:\.\d+)?/g)!.map(Number);
    return values.length === 2 ? [values[0], values[1]] : band.condition.startsWith('<') ? [-Infinity, values[0] - (band.condition.startsWith('<=') ? 0 : 1)] : [values[0] + (band.condition.startsWith('>') ? 1 : 0), Infinity];
  });
  for (let i = 1; i < intervals.length; i++) if (intervals[i][0] !== intervals[i - 1][1] + 1) finding(intervals[i][0] <= intervals[i - 1][1] ? 'sliding_scale_overlap' : 'sliding_scale_gap', 'Source scale boundaries were retained; no missing or overlapping dose was invented.');
  return { bands: bands.map(band => `${band.condition}=${band.action}`).join(';'), schedule: shared, route: 'SQ', baseInstruction, abnormalities, incomplete: false };
}
