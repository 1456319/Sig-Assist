import { SIG_CODE_REFERENCE } from './sigCodeReference';
import type { AbnormalityFinding } from './types';

export const SCALE_SIG_LIMIT = 199;
// Site meanings supplied by the technician; these two codes are absent from
// the bundled reference. This is an estimate, not a live Framework preview.
const siteExpansions: Record<string, string> = {
  CBS: 'CHECK BLOOD SUGAR',
  SS: 'AND INJECT SUBCUTANEOUSLY ACCORDING TO SLIDING SCALE',
};
export type ScaleConcession = 'spacing' | 'diagnosis' | 'literal_ss' | 'literal_cbs';
export interface ScaleSigBudget {
  parts: string[];
  rawLength: number;
  estimatedExpandedLength: number;
  limit: number;
  concessions: ScaleConcession[];
  overLimit: boolean;
}
export const isSlidingScaleSig = (sig: string) => /^(?:CBS|C\.B\.S\.)\s+.+?\s+(?:SS|S\.S\.)(?:\s|(?=[<>\d]))/i.test(sig.trim());

function replaceScaleCodes(text: string, replaceCode: (code: string) => string | undefined): string {
  return text.replace(/\S+/g, (token: string, offset: number) => {
    const exact = replaceCode(token);
    if (exact !== undefined) return exact;
    // Framework accepts one trailing punctuation mark followed by whitespace.
    // Internal punctuation never makes a new token, so U;150 stays literal.
    const punctuation = token.slice(-1);
    if (offset + token.length === text.length || !/\p{P}/u.test(punctuation)) return token;
    const replacement = replaceCode(token.slice(0, -1));
    return replacement === undefined ? token : replacement + punctuation;
  });
}

export function estimateScaleExpansion(sig: string): string {
  return replaceScaleCodes(sig.toUpperCase(), code => siteExpansions[code] ?? SIG_CODE_REFERENCE[code]);
}

export function compactScaleSpacing(sig: string): string {
  return sig.toUpperCase().replace(/\s+/g, ' ').trim()
    .replace(/\s*([;=&<>])\s*/g, '$1')
    .replace(/(\d)\s*-\s*(?=\d)/g, '$1-')
    .replace(/(\d)\s+(U|ML|H)\b/g, '$1$2')
    .replace(/\s+([).,;])/g, '$1').replace(/\(\s+/g, '(')
    .replace(/\.\s+(?=PLUS\d)/g, '.')
    // A code/scale delimiter is essential for SS to expand normally.
    .replace(/^((?:CBS|C\.B\.S\.)\s+.+?\s+(?:SS|S\.S\.))(?=[<>\d])/, '$1 ');
}

const diagnosisCodes = new Set(Object.entries(SIG_CODE_REFERENCE).filter(([, text]) => text.startsWith('FOR ')).map(([code]) => code));
function omitDiagnosis(sig: string): string {
  return replaceScaleCodes(sig, code => diagnosisCodes.has(code) ? '' : undefined)
    .replace(/\bFOR (?:(?:TYPE [12] )?DIABETES(?: MELLITUS)?(?: TYPE [12])?|DM[12]?)\b/g, '').replace(/\s+/g, ' ').trim();
}

/** Apply concessions to the whole entered group, not independently per card. */
export function fitSlidingScaleBudget(input: readonly string[], limit = SCALE_SIG_LIMIT): ScaleSigBudget {
  let parts = input.map(compactScaleSpacing);
  const concessions: ScaleConcession[] = parts.some((part, index) => part !== input[index]) ? ['spacing'] : [];
  const measure = () => {
    const rawLength = parts.filter(Boolean).join(' ').length;
    const estimatedExpandedLength = parts.filter(Boolean).map(estimateScaleExpansion).join(' ').length;
    return { rawLength, estimatedExpandedLength, overLimit: Math.max(rawLength, estimatedExpandedLength) > limit };
  };
  const stages: Array<[ScaleConcession, (sig: string) => string]> = [
    ['diagnosis', omitDiagnosis],
    ['literal_ss', sig => replaceScaleCodes(sig, code => code === 'SS' ? 'S.S.' : undefined)],
    ['literal_cbs', sig => replaceScaleCodes(sig, code => code === 'CBS' ? 'C.B.S.' : undefined)],
  ];
  for (const [step, transform] of stages) {
    if (!measure().overLimit) break;
    const next = parts.map(transform).map(compactScaleSpacing);
    if (next.some((part, index) => part !== parts[index])) concessions.push(step);
    parts = next;
  }
  return { parts, ...measure(), limit, concessions };
}

export function scaleBudgetFindings(budget: ScaleSigBudget): AbnormalityFinding[] {
  const descriptions: Record<ScaleConcession, string> = {
    spacing: 'unnecessary spacing removed', diagnosis: 'diagnosis omitted',
    literal_ss: 'SS changed to literal S.S.', literal_cbs: 'CBS changed to literal C.B.S.',
  };
  const applied = budget.concessions.map(step => descriptions[step]).join('; ');
  return [
    ...(applied ? [{ id: 'sliding_scale_concessions', tier: 'applied_correction' as const, title: 'Sliding-Scale Concessions Applied',
      message: `${applied}. Typed: ${budget.rawLength}; estimated expanded: ${budget.estimatedExpandedLength}/${budget.limit} characters across the entered SIG parts. Verify Framework Preview Sig.`, correction: applied }] : []),
    ...(budget.overLimit ? [{ id: 'sliding_scale_budget_exceeded', tier: 'uncorrected_gap' as const, title: 'Concessions Applied — SIG Still Exceeds 199 Characters',
      message: `Best effort is ${budget.estimatedExpandedLength} estimated expanded characters (${budget.rawLength} typed), shared across all SIG parts. Adjust the editable draft; doses and instructions were not truncated.` }] : []),
  ];
}
