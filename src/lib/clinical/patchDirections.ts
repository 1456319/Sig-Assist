import { normalizeNumericDirections } from './numericDirections';
import { AbnormalityFinding } from './types';

/** Separate application from removal before ordinary frequency/duration parsing.
 * Defaults below are the reported lidocaine workflow, never other patch products.
 * Unrecognized removal instructions remain intact for review.
 */
export function resolvePatchDirections(drug: string, rawProse: string): {
  prose: string; suffix?: string; abnormalities: AbnormalityFinding[]; requiresManualTranslation?: boolean;
} {
  const abnormalities: AbnormalityFinding[] = [];
  if (!/\bLIDOCAINE\b/i.test(drug) || !/\bPATCH(?:ES)?\b/i.test(drug)) return { prose: rawProse, abnormalities };
  let prose = normalizeNumericDirections(rawProse);
  const cycle = prose.match(/\bLEAVE (?:THE )?PATCH(?:ES)? ON (\d+) HOURS? AND (?:THEN )?OFF (\d+) HOURS?(?: BEFORE APPLYING NEW PATCHES)?[.;]?\s*(?:AND REMOVE PER SCHEDULE)?[.;]?$/);
  const morning = prose.match(/\b(APPLY\s+)?IN (?:THE )?(?:AM|MORNING),?\s*(?:AND )?REMOVE (?:AT|IN(?: THE)?) (HS|BEDTIME|PM|EVENING)[.;]?$/);
  let suffix = 'AND REMOVE PER SCHEDULE 12ON';
  if (cycle) {
    if (Number(cycle[1]) <= 0 || Number(cycle[2]) <= 0) {
      abnormalities.push({ id: 'invalid_patch_cycle', tier: 'potential_error', title: 'Invalid Patch Wear Interval',
        message: 'The stated on/off interval is not positive. Original directions were retained for review.', trigger: cycle[0] });
      return { prose: rawProse, abnormalities, requiresManualTranslation: true };
    }
    prose = prose.slice(0, cycle.index).trim();
    if (cycle[1] !== '12' || cycle[2] !== '12') {
      suffix = `AND REMOVE PER SCHEDULE (${cycle[1]} HOURS ON, ${cycle[2]} HOURS OFF)`;
      abnormalities.push({ id: 'lidocaine_explicit_cycle', tier: 'potential_error', title: 'Lidocaine Wear Schedule Requires Review',
        message: 'The explicit on/off interval was retained. Verify the product and wear schedule with the pharmacist.', trigger: cycle[0] });
    }
  } else if (morning) {
    prose = prose.slice(0, morning.index).trim();
    // Interpret BID only where the source also supplies distinct application/removal events.
    prose = prose.replace(/\b(?:2 TIMES (?:A|PER|EACH) DAY|TWICE DAILY|BID|ONE TIME A DAY|1 TIME A DAY|DAILY|QD|Q12H?|EVERY 12 HOURS)\b/, 'IN THE MORNING');
    if (!/\b(?:IN THE MORNING|QAM)\b/.test(prose)) prose += ' IN THE MORNING';
    const removal = /^(?:PM|EVENING)$/.test(morning[2]) ? 'QPM' : 'QHS';
    suffix = `AND REMOVE ${removal} PER SCHEDULE 12ON`;
    abnormalities.push({ id: 'lidocaine_application_removal', tier: 'applied_correction', title: 'Patch Application and Removal Separated',
      message: 'Morning application and the stated removal time were treated as separate events under the reported site convention. Verify that actual administration times meet the added 12-hour on/off schedule.',
      correction: `Apply QAM; remove ${removal}; site 12ON instruction added`, trigger: rawProse });
  } else {
    prose = prose.replace(/\s+AND REMOVE PER SCHEDULE[.;]?$/, '');
    abnormalities.push({ id: 'lidocaine_default_cycle', tier: 'applied_correction', title: 'Lidocaine Removal Schedule Added',
      message: 'The reported site default of 12 hours on and 12 hours off was added. Verify the selected patch and prescribed schedule before copying.', correction: suffix, trigger: rawProse });
  }
  if (/\b(?:REMOVE|LEAVE|OFF|ON FOR|AFTER|BEFORE)\b/.test(prose)) {
    abnormalities.push({ id: 'unrecognized_patch_schedule', tier: 'uncorrected_gap', title: 'Patch Removal Requires Review',
      message: 'The complete application and removal instructions were retained because their relationship could not be translated.', trigger: rawProse });
    return { prose: rawProse, abnormalities: abnormalities.filter(a => a.id !== 'lidocaine_default_cycle'), requiresManualTranslation: true };
  }
  if (/\b(?:Q12H?|EVERY 12 HOURS)\b/.test(prose) && (!cycle || (cycle[1] === '12' && cycle[2] === '12'))) {
    prose = prose.replace(/\b(?:Q12H?|EVERY 12 HOURS)\b/, 'DAILY');
    abnormalities.push({ id: 'lidocaine_q12_application_removal', tier: 'applied_correction', title: 'Lidocaine Q12 Schedule Interpreted',
      message: 'The reported site convention treats Q12 as application followed by removal, producing once-daily application. Verify this interpretation against the original order.', correction: 'Q12H → QD with 12ON', trigger: rawProse });
  }
  // Other multiple-application schedules must not become daily by assumption.
  if (/\b(?:BID|TID|QID|[2-9] TIMES|TWICE|Q(?!24H)\d+H|EVERY (?!24 HOURS)\d+ HOURS)\b/.test(prose)
      || (morning && /\b(?:QPM|QHS|AT BEDTIME|IN THE EVENING)\b/.test(prose))) {
    abnormalities.push({ id: 'conflicting_patch_schedule', tier: 'potential_error', title: 'Patch Application Frequency Requires Review',
      message: 'The application frequency conflicts with the patch removal workflow. Original directions were retained.', trigger: rawProse });
    return { prose: rawProse, abnormalities: abnormalities.filter(a => a.id !== 'lidocaine_default_cycle'), requiresManualTranslation: true };
  }
  return { prose: prose.replace(/[.;]+$/, '').trim(), suffix, abnormalities };
}
