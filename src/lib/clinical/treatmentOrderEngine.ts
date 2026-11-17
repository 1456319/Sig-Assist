import { AbnormalityFinding } from './types';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import { calculateDoseAndVolume } from './doseCalculator';
import { splitSupplementalDirections } from './instructionClauses';

export interface TreatmentSplitPart {
  readonly label: string;
  readonly sig: string;
  readonly abnormalities: AbnormalityFinding[];
}

export interface TreatmentOrderEvaluation {
  readonly isTreatment: boolean;
  readonly isSplit: boolean;
  readonly singleSig?: string;
  readonly splitParts: readonly TreatmentSplitPart[];
  readonly abnormalities: AbnormalityFinding[];
}


interface TreatmentModifiers {
  body: string;
  frequency: string;
  prn: boolean;
  separatePrn: boolean;
  prnReason: string;
  duration: string;
  qualifier: string;
  abnormalities: AbnormalityFinding[];
}
interface TreatmentAction extends TreatmentModifiers {
  kind: 'cleanse' | 'dry' | 'apply' | 'dress' | 'leave' | 'followup' | 'unknown';
  site?: string;
}
const ACTION_START = /\b(?:CLEANSE|PAT\s+DRY|APPLY|COVER|DRESS|WRAP|LEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)|NOTIFY|CALL|RECHECK|HOLD|DO\s+NOT|REMOVE|MEASURE|MASSAGE)\b/g;
const DAY = '(?:MON(?:DAY)?|TUE(?:S(?:DAY)?)?|WED(?:NESDAY)?|THU(?:R(?:S(?:DAY)?)?)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)S?';
const WEEKDAYS = `(?:EVERY|ON)\\s+${DAY}(?:\\s*(?:,|/|AND|&|TO|THROUGH|-)?\\s*(?:(?:EVERY|ON)\\s+)?${DAY})*`;
const SCHEDULE = new RegExp(`\\b(?:${WEEKDAYS}|(?:EVERY|EACH)\\s+(?:(?:DAY|EVENING|NIGHT)(?:\\s+AND\\s+(?:DAY|EVENING|NIGHT))?\\s+)?SHIFT|Q[/-]?SHIFT|EVERY\\s+(?:(?:OTHER|TWO|THREE|\\d+)\\s+DAYS?|(?:\\d+|TWO|THREE)\\s+HOURS?|DAY|MORNING|EVENING)|(?:FOUR|THREE|TWO|[234])\\s+TIMES\\s+(?:(?:A|PER|EACH)\\s+DAY|DAILY)|TWICE\\s+(?:A\\s+DAY|DAILY)|ONCE\\s+(?:A\\s+)?(?:DAY|WEEK)|TWICE\\s+(?:A\\s+)?WEEK|IN\\s+THE\\s+(?:MORNING|EVENING)|AT\\s+BEDTIME|DAILY|WEEKLY|Q\\d+H|Q3D|QOD|QWEEK|BIW|QS|QD|BID|TID|QID|QAM|QPM|QHS)\\b`, 'g');
function emptyModifiers(): Omit<TreatmentModifiers, 'body'> {
  return { frequency: '', prn: false, separatePrn: false, prnReason: '', duration: '', qualifier: '', abnormalities: [] };
}
function normalizeSite(site: string): string {
  return site.replace(/^THE\s+/, '').replace(/\bBILATERAL\b|\bB\/L\b/g, 'BIL').replace(/\bLEFT\b/g, 'LT').replace(/\bRIGHT\b/g, 'RT')
    .replace(/\s+AND\s+/g, '/').replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();
}
function productCore(drug: string): string {
  return drug.replace(/\b(?:TOPICAL|PASTE|OINTMENT|CREAM|LOTION|GEL|SOLUTION|BARRIER|SPRAY)\b/g, '')
    .replace(/\d+(?:\.\d+)?\s*%.*$/, '').replace(/\s+/g, ' ').trim();
}
function parseModifiers(source: string): TreatmentModifiers {
  const result: TreatmentModifiers = { ...emptyModifiers(), body: source };
  // Follow-up times are instructions in their own right, never treatment frequency/course.
  if (/^(?:NOTIFY|CALL|RECHECK|HOLD|DO NOT|REMOVE|MEASURE|MASSAGE)\b/.test(source)) return result;
  let body = source;
  const prn = body.match(/\b(?:(AND|&)\s+)?(?:AS\s+NEEDED|PRN)\b(?:\s+FOR\s+([^.;]+))?/);
  if (prn) {
    result.prn = true;
    result.separatePrn = Boolean(prn[1]);
    result.prnReason = prn[2] ? `FOR ${prn[2].trim()}` : '';
    body = body.slice(0, prn.index) + body.slice(prn.index! + prn[0].length);
  }
  body = body.replace(/\b(?:FOR\s+(?:UP\s+TO\s+)?|X\s*)\d+(?:\.\d+|\s*[-/]\s*\d+)?\s*(?:DAYS?|D\b|WEEKS?|WKS?|MONTHS?|MOS?|HOURS?|HRS?|H\b)\b/g, match => {
    const duration = resolveFrequencyAndSchedule(`DAILY ${match}`);
    result.abnormalities.push(...duration.abnormalities);
    result.duration = [result.duration, duration.durationToken || match].filter(Boolean).join(' ');
    return '';
  });
  let firstSchedule = -1;
  body = body.replace(SCHEDULE, (match: string, offset: number) => {
    if (firstSchedule < 0) firstSchedule = offset;
    const normalized = match.replace(/^Q[/-]?SHIFT$/, 'EVERY SHIFT').replace(/THREE DAYS/, '3 DAYS').replace(/TWO DAYS/, '2 DAYS')
      .replace(/FOUR TIMES DAILY/, 'FOUR TIMES A DAY').replace(/THREE TIMES DAILY/, 'THREE TIMES A DAY');
    const special: Record<string, string> = { 'EVERY 3 DAYS': 'Q3D', Q3D: 'Q3D', 'EVERY OTHER DAY': 'QOD', QOD: 'QOD', 'TWICE A WEEK': 'BIW', BIW: 'BIW', WEEKLY: 'QWEEK', 'ONCE A WEEK': 'QWEEK', QWEEK: 'QWEEK', QS: 'QS' };
    const frequency = special[normalized] || resolveFrequencyAndSchedule(normalized).frequencyToken;
    result.frequency = [result.frequency, frequency || match].filter(Boolean).join(' ');
    return '';
  });
  // Text following a schedule is a source qualifier, not part of a product/site.
  if (firstSchedule >= 0 && firstSchedule < body.length) {
    result.qualifier = body.slice(firstSchedule).trim().replace(/^[,.;:\s]+|[,.;:\s]+$/g, '');
    body = body.slice(0, firstSchedule);
  } else {
    const indication = body.match(/\s+FOR\s+(.+)$/);
    if (indication) { result.qualifier = `FOR ${indication[1]}`; body = body.slice(0, indication.index); }
  }
  if (result.qualifier && !/^FOR\b/.test(result.qualifier)) result.abnormalities.push({
    id: 'treatment_untranslated_clause', tier: 'uncorrected_gap', title: 'Treatment Qualifier Retained for Review',
    message: 'This source qualifier was retained beside the translated procedure. Verify its wording before copying.', trigger: result.qualifier,
  });
  result.body = body.replace(/\s+/g, ' ').replace(/[,. ;:]+$/, '').replace(/\s+(?:AND|THEN)$/, '').trim();
  return result;
}

/**
 * Recognizes wound care treatment orders (cleansing, pat dry, topical barrier/medication,
 * dressing, or leave open to air) and formats them into condensed, compliant SIGs.
 */
export function resolveTreatmentOrder(drugName: string, rawProse: string): TreatmentOrderEvaluation | undefined {
  const upperProse = rawProse.toUpperCase().replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();
  const upperDrug = drugName.toUpperCase().trim();

  // Exclude oral solid/liquid formulations and explicit oral administration instructions
  const isOralDosageForm =
    /\b(?:CAPSULE|CAP|TABLET|TAB|SUSPENSION|SYRUP|ELIXIR)\b/i.test(upperDrug) &&
    !/\b(?:TOPICAL|POWDER\s+FOR\s+TOPICAL)\b/i.test(upperDrug);
  const hasOralProse = /\b(?:BY\s+MOUTH|PO|SWALLOW|TAKE\s+\d+|TAKE\s+ONE|TAKE\s+TWO)\b/i.test(upperProse);

  if (isOralDosageForm || hasOralProse) {
    return undefined;
  }

  const explicit = rawProse.split(/\s+AND\s+(?=APPLY\s+TO\b)/i);
  if (explicit.length === 2 && /\b(?:AS NEEDED|PRN)\b/i.test(explicit[1])) {
    const routine = resolveTreatmentOrder(drugName, explicit[0]);
    if (routine?.isSplit && !/\b(?:CLEANSE|PAT DRY|COVER|WRAP|LEAVE)\b/i.test(explicit[1])) {
      const reason = explicit[1].match(/\b(?:AS NEEDED|PRN)\s+(FOR\s+[^.;]+)/i)?.[1].toUpperCase();
      const parts = routine.splitParts.map(part => ({ ...part,
        sig: part.label.includes('(PRN)') && reason && !part.sig.includes(reason.replace(/^FOR /, '')) ? `${part.sig} ${reason}` : part.sig,
      }));
      return { ...routine, splitParts: parts };
    }
    if (routine?.singleSig) {
      if (/\b(?:CLEANSE|PAT DRY|COVER|WRAP|LEAVE)\b/i.test(explicit[1])) {
        const review: AbnormalityFinding = { id: 'separate_prn_procedure', tier: 'uncorrected_gap', title: 'Separate PRN Procedure Requires Review',
          message: 'The second procedure was retained in full with its own schedule. Compare it with the routine procedure.', trigger: explicit[1] };
        return { isTreatment: true, isSplit: true, splitParts: [
          { label: 'Order 1 of 2 (Routine)', sig: routine.singleSig, abnormalities: routine.abnormalities },
          { label: 'Order 2 of 2 (PRN)', sig: explicit[1].toUpperCase().replace(/\s+/g, ' ').trim(), abnormalities: [review] },
        ], abnormalities: [...routine.abnormalities, review] };
      }
      const d = calculateDoseAndVolume(drugName, explicit[1]);
      const f = resolveFrequencyAndSchedule(explicit[1]);
      if (d.doseToken && !d.requiresManualTranslation && !f.requiresManualTranslation) {
        const supplemental = splitSupplementalDirections(explicit[1]).supplemental;
        const prn = [d.doseToken, d.routeToken, d.siteToken, f.frequencyToken, f.prnToken, f.indicationToken, f.durationToken, f.holdToken, f.stopToken].filter(Boolean).join(' ')
          + (supplemental ? `. ${supplemental.toUpperCase()}` : '');
        return { isTreatment: true, isSplit: true, splitParts: [
          { label: 'Order 1 of 2 (Routine)', sig: routine.singleSig, abnormalities: routine.abnormalities },
          { label: 'Order 2 of 2 (PRN)', sig: prn, abnormalities: [...d.abnormalities, ...f.abnormalities] },
        ], abnormalities: [...routine.abnormalities, ...d.abnormalities, ...f.abnormalities] };
      }
    }
  }

  const procedural = /\b(?:CLEANSE|PAT\s+DRY|LEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)|(?:COVER|WRAP|DRESS)\s+(?:WITH|W\/))\b/.test(upperProse);
  const topicalWound = /\bAPPLY\b/.test(upperProse) && /\b(?:WOUND|MASD|SACRUM|ULCER|PRESSURE\s+(?:INJURY|SORE))\b/.test(upperProse);
  if (!procedural && !topicalWound) return undefined;

  const abnormalities: AbnormalityFinding[] = [];
  const actions: TreatmentAction[] = [];
  const starts = [...upperProse.matchAll(ACTION_START)];
  if (!starts.length) return undefined;
  const prefix = upperProse.slice(0, starts[0].index).replace(/^WOUND DRESSING\s*:\s*/, '').trim();
  if (prefix) {
    actions.push({ body: prefix, kind: 'unknown', ...emptyModifiers() });
    retainUnknown(prefix);
  }
  for (let i = 0; i < starts.length; i++) {
    const source = upperProse.slice(starts[i].index, starts[i + 1]?.index ?? upperProse.length)
      .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').replace(/\s+(?:AND|THEN)$/, '').trim();
    const modifiers = parseModifiers(source);
    abnormalities.push(...modifiers.abnormalities);
    const body = modifiers.body;
    let rendered = body;
    let site = '';
    let kind: TreatmentAction['kind'] = 'unknown';
    if (/^CLEANSE\b/.test(body)) {
      kind = 'cleanse';
      const cleanse = body.match(/^CLEANSE\s+(.*?)\s*(?:WITH\b|W\/)\s*(.+)$/);
      if (cleanse) {
        site = normalizeSite(cleanse[1].replace(/^(?:THE\s+)?(?:WOUND|SITE|SKIN)\s+(?:ON|AT|IN|OF|TO)\s+(?:THE\s+)?/, ''));
        rendered = `CLEANSE W/${cleanse[2].replace(/^VASHE\b/, 'WOUND CLEANSER').replace(/^SOAP\s*&\s*WATER\b/, 'SOAP AND WATER')}`;
      } else retainUnknown(source);
    } else if (/^PAT\s+DRY\b/.test(body)) {
      kind = 'dry';
    } else if (/^APPLY\b/.test(body)) {
      kind = 'apply';
      const header = body.match(/^APPLY\s+(?:TOPICALLY\s+)?TO\s+(?:THE\s+)?(.+?)(?:\s+(?:TOPICALLY|TPCL))?$/);
      if (header) {
        site = normalizeSite(header[1]);
        rendered = `APPLY ${productCore(upperDrug)}`;
      } else {
        // Preserve application amounts, thickness, adverbs, and local application sites.
        rendered = body.replace(/\bTOPICALLY\b/g, 'TPCL');
        if (/^APPLY\s+(?:OINTMENT|CREAM|PASTE|LOTION|GEL)$/.test(body)) rendered = `APPLY ${productCore(upperDrug)}`;
      }
    } else if (/^(?:COVER|DRESS|WRAP)\b/.test(body)) {
      kind = 'dress';
      rendered = body.replace(/^(COVER|DRESS|WRAP)\s+(?:WITH\b|W\/)\s*/, '$1 W/');
    } else if (/^LEAVE\s+(?:OPEN\s+TO\s+AIR|OTA)\b/.test(body)) {
      kind = 'leave';
      rendered = body.replace(/^LEAVE OTA\b/, 'LEAVE OPEN TO AIR');
    } else if (/^(?:NOTIFY|CALL|RECHECK|HOLD|DO NOT)\b/.test(body)) {
      kind = 'followup';
    } else retainUnknown(source);
    actions.push({ ...modifiers, body: rendered, site, kind });
  }

  // An EHR application header supplies site/schedule metadata when the source
  // subsequently specifies the actual application. Other source actions keep their order.
  const header = actions[0];
  const hasApplication = actions.slice(1).some(a => a.kind === 'apply');
  if (header?.kind === 'apply' && header.site && hasApplication) header.body = '';
  // A cleansing clause may repeat the header's site without its final WOUND label.
  for (const action of actions) {
    if (header?.site && action.site && `${action.site} WOUND` === header.site) action.site = header.site;
  }
  const sites = [...new Set(actions.map(a => a.site).filter((s): s is string => Boolean(s)))];
  const commonSite = sites.length === 1 ? sites[0] : '';
  const procedure = actions.filter(a => a.kind !== 'followup');
  const frequencies = [...new Set(procedure.map(a => a.frequency).filter(Boolean))];
  const hasPrn = procedure.some(a => a.prn);
  const lastProcedure = procedure[procedure.length - 1];
  const globalSchedule = frequencies.length <= 1 && procedure.every(a => !a.frequency || a === header || a === lastProcedure);
  const routineFrequency = globalSchedule ? frequencies[0] || '' : '';
  const globalPrn = globalSchedule && hasPrn;
  // A constrained PRN schedule (BID PRN) is one order. Only an explicit AND PRN
  // describes both a routine and a separate as-needed application.
  const split = Boolean(routineFrequency && globalPrn && procedure.some(a => a.separatePrn));
  if (!frequencies.length && !hasPrn) abnormalities.push({
    id: 'treatment_frequency_missing', tier: 'uncorrected_gap', title: 'Treatment Frequency Not Stated',
    message: 'No treatment frequency was stated. No scheduled interval was added.', trigger: rawProse,
  });

  function render(mode: 'routine' | 'prn' | 'single'): string {
    const parts: string[] = [];
    const globalTails: string[] = [];
    let previousKind: TreatmentAction['kind'] | undefined;
    for (const action of actions) {
      const ownSite = action.site && action.site !== commonSite ? `TO ${action.site}:` : '';
      let body = action.body;
      if (body && (action.kind === 'apply' || action.kind === 'leave') && (previousKind === 'cleanse' || previousKind === 'dry')) body = `THEN ${body}`;
      if (body) {
        const schedule = globalSchedule && action.kind !== 'followup' ? '' : [action.frequency, action.prn ? 'PRN' : ''].filter(Boolean).join(' ');
        const localTail = globalSchedule && action.kind !== 'followup' ? '' : [action.duration, action.qualifier, action.prnReason].filter(Boolean).join(' ');
        parts.push(`${ownSite}${body}${schedule ? ` ${schedule}` : ''}${localTail ? ` ${localTail}` : ''}`);
        previousKind = action.kind;
      }
      if (globalSchedule && action.kind !== 'followup') {
        for (const tail of [action.duration, action.qualifier, mode !== 'routine' ? action.prnReason : '']) if (tail && !globalTails.includes(tail)) globalTails.push(tail);
      }
    }
    const followupIndex = actions.findIndex(a => a.kind === 'followup');
    // A shared terminal schedule belongs before follow-up actions, preserving the
    // notification/recheck as its own clause rather than using its timing as dosing frequency.
    const schedule = mode === 'prn' ? 'PRN' : [routineFrequency, mode === 'single' && globalPrn ? 'PRN' : ''].filter(Boolean).join(' ');
    const tail = globalSchedule ? [schedule, ...globalTails].filter(Boolean).join(' ') : '';
    const renderedParts = parts.slice();
    if (tail) {
      const at = followupIndex < 0 ? renderedParts.length - 1 : actions.slice(0, followupIndex).filter(a => a.body).length - 1;
      if (at >= 0) renderedParts[at] += ` ${tail}`;
    }
    let full = `${commonSite ? `TO ${commonSite}:` : ''}${renderedParts.join(',')}`;
    if (full.length > 199) full = full.replace(/\bSOAP AND WATER\b/g, 'SOAP&WATER').replace(/\bNORMAL SALINE\b/g, 'NS')
      .replace(/\bWOUND CLEANSER\b/g, 'WOUND CLNSR').replace(/\bAND\b/g, '&').replace(/\bLEAVE OPEN TO AIR\b/g, 'LEAVE OTA').replace(/\bTHEN APPLY\b/g, 'APPLY');
    if (full.length > 199) full = full.replace(/\bWITH\b/g, 'W/').replace(/\bPRESSURE INJURY\b/g, 'PI').replace(/\bPRESSURE ULCER\b/g, 'PU')
      .replace(/\bSURROUNDING\b/g, 'SURR').replace(/\bEXTREMITIES\b/g, 'EXTS').replace(/\bEXTREMITY\b/g, 'EXT');
    if (full.length > 199) abnormalities.push({ id: 'treatment_order_length_exceeded', tier: 'potential_error', title: 'Treatment Sig Exceeds 199 Characters',
      message: `The formatted treatment order is ${full.length} characters long and exceeds FrameworkLTC's 199-character limit. Manual technician condensation required.`, trigger: full });
    return full;
  }
  if (split) {
    const splitParts = [{ label: 'Order 1 of 2 (Routine)', sig: render('routine'), abnormalities: [] }, { label: 'Order 2 of 2 (PRN)', sig: render('prn'), abnormalities: [] }];
    return { isTreatment: true, isSplit: true, splitParts, abnormalities };
  }
  return { isTreatment: true, isSplit: false, singleSig: render('single'), splitParts: [], abnormalities };

  function retainUnknown(text: string): void {
    abnormalities.push({ id: 'treatment_untranslated_clause', tier: 'uncorrected_gap', title: 'Treatment Clause Retained for Review',
      message: 'This source clause was retained beside the translated procedure. Verify its wording before copying.', trigger: text });
  }
}
