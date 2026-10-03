import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import { normalizeNumericDirections } from './numericDirections';

/** Merge only a complete, simple repeat with matching quantity, route and interval. */
export function mergeRepeatedSolidDirections(drugName: string, prose: string): { prose: string; merged: boolean } {
  const upper = normalizeNumericDirections(prose);
  const repeat = /\b(?:TAKE|GIVE)\s+\d+(?:\.\d+)?\s+(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/g;
  const actions = [...upper.matchAll(repeat)];
  if (actions.length !== 2 || actions[0].index !== 0) return { prose, merged: false };
  const primary = upper.slice(0, actions[1].index).trim().replace(/[.;]+$/, '');
  const tail = upper.slice(actions[1].index);
  const simple = /^(?:TAKE|GIVE)\s+\d+(?:\.\d+)?\s+(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\s+(?:BY MOUTH|ORALLY|PO)\s+(?:(?:PRN|AS NEEDED)\s+)?(?:DAILY|QD|EVERY \d+ HOURS?|Q\d+H)(?:\s+(?:PRN|AS NEEDED))?(?:\s+IN THE MORNING)?(?:\s+ON AN EMPTY STOMACH)?(?:\s+FOR UP TO \d+ DOSES)?[.;]?$/;
  if (!simple.test(tail)) return { prose, merged: false };
  const firstDose = calculateDoseAndVolume(drugName, primary);
  const nextDose = calculateDoseAndVolume(drugName, tail);
  const firstSchedule = resolveFrequencyAndSchedule(primary);
  const nextSchedule = resolveFrequencyAndSchedule(tail);
  const baseNext = nextSchedule.frequencyToken.replace(' ON AN EMPTY STOMACH', '');
  const addedMorning = firstSchedule.frequencyToken === 'QD' && baseNext === 'QAM' && /\b(?:DAILY|QD) IN THE MORNING\b/.test(tail);
  if (!firstDose.doseToken || firstDose.requiresManualTranslation || nextDose.requiresManualTranslation
      || firstDose.doseToken !== nextDose.doseToken || firstDose.routeToken !== nextDose.routeToken
      || firstSchedule.requiresManualTranslation || nextSchedule.requiresManualTranslation
      || firstSchedule.prnToken !== nextSchedule.prnToken
      || (firstSchedule.frequencyToken !== baseNext && !addedMorning)) return { prose, merged: false };
  const retained = [
    addedMorning ? 'IN THE MORNING' : '',
    /\bON AN EMPTY STOMACH\b/.test(tail) ? 'ON AN EMPTY STOMACH' : '',
    tail.match(/\bFOR UP TO \d+ DOSES\b/)?.[0] || '',
  ].filter(Boolean).join(' ');
  return { prose: `${primary} ${retained}`.trim(), merged: true };
}
