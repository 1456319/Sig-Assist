import { SIG_CODE_REFERENCE } from './sigCodeReference';
import { AbnormalityFinding } from './types';
import { protectIndicationDurations } from './indicationEngine';

export function resolveDuration(upper: string): { token?: string; abnormalities: AbnormalityFinding[]; unsupported?: boolean } {
  upper = protectIndicationDurations(upper);
  const matches = [...upper.matchAll(/\b(?:FOR\s+(?:UP\s+TO\s+)?|X\s*)(\d+(?:\.\d+|\s*[-/]\s*\d+)?)\s*(DAYS?|D\b|WEEKS?|WKS?|WK\b|MONTHS?|MOS?|HOURS?|HRS?|HR\b|H\b)\b/g)];
  const abnormalities: AbnormalityFinding[] = [];
  const tokens = new Set<string>();
  const unmarked = [...upper.matchAll(/\b\d+(?:\.\d+|\s*[-/]\s*\d+)?\s*(?:DAYS?|WEEKS?|MONTHS?|HOURS?)\b/g)]
    .find(m => !matches.some(explicit => m.index! >= explicit.index! && m.index! < explicit.index! + explicit[0].length)
      && !/\b(?:EVERY|PER|EACH)\s*$/.test(upper.slice(0, m.index)));
  if (unmarked) {
    abnormalities.push({ id: 'unmarked_duration', tier: 'potential_error', title: 'Duration Requires Review',
      message: 'An interval was supplied without an explicit FOR or X course directive. Original directions were retained so its meaning can be verified.', trigger: unmarked[0] });
    return { abnormalities, unsupported: true };
  }
  for (const match of matches) {
    const amount = Number(match[1]);
    const unit = match[2].startsWith('D') ? 'D' : match[2].startsWith('W') ? 'WK' : match[2].startsWith('M') ? 'M' : 'H';
    const candidates = [`X${amount}${unit}`, ...(unit === 'WK' ? [`X${amount}W`] : [])];
    const token = candidates.find(c => SIG_CODE_REFERENCE[c]);
    if (!Number.isInteger(amount) || amount <= 0 || !token) {
      abnormalities.push({ id: 'unsupported_duration', tier: 'potential_error',
        title: unit === 'D' && !Number.isInteger(amount) ? 'Non-integer Day Supply' : 'Duration Requires Review',
        message: 'The complete duration could not be represented with a verified SIG code. Original directions were retained; verify the stop date before copying.', trigger: match[0] });
      return { abnormalities, unsupported: true };
    }
    tokens.add(token);
  }
  if (tokens.size > 1) {
    abnormalities.push({ id: 'conflicting_durations', tier: 'potential_error', title: 'Conflicting Durations',
      message: 'Different course durations were supplied. Original directions were retained for review.', trigger: upper });
    return { abnormalities, unsupported: true };
  }
  return { token: [...tokens][0], abnormalities };
}
