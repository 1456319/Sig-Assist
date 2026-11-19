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

export function estimateScaleExpansion(sig: string): string {
  return sig.toUpperCase().replace(/\b(?:C\.B\.S\.|S\.S\.)|\b[A-Z0-9]+(?:[/-][A-Z0-9]+)*\b/g,
    token => /^(?:C\.B\.S\.|S\.S\.)$/.test(token) ? token : siteExpansions[token] ?? SIG_CODE_REFERENCE[token] ?? token);
}

export function compactScaleSpacing(sig: string): string {
  return sig.toUpperCase().replace(/\s+/g, ' ').trim()
    .replace(/\s*([;=&<>])\s*/g, '$1')
    .replace(/(\d)\s*-\s*(?=\d)/g, '$1-')
    .replace(/(\d)\s+(U|ML|H)\b/g, '$1$2')
    .replace(/\s+([).,;])/g, '$1').replace(/\(\s+/g, '(')
    .replace(/\.\s+(?=PLUS\d)/g, '.')
    // A code/scale delimiter is essential for SS to expand normally.
    .replace(/\b(SS|S\.S\.)(?=[<>\d])/g, '$1 ');
}

const diagnosisCodes = new Set(Object.entries(SIG_CODE_REFERENCE).filter(([, text]) => text.startsWith('FOR ')).map(([code]) => code));
function omitDiagnosis(sig: string): string {
  return sig.replace(/\b[A-Z][A-Z0-9/]*\b/g, token => diagnosisCodes.has(token) ? '' : token)
    .replace(/\bFOR DIABETES(?: MELLITUS)?(?: TYPE [12])?\b/g, '').replace(/\s+/g, ' ').trim();
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
    ['literal_ss', sig => sig.replace(/\bSS\b/g, 'S.S.')],
    ['literal_cbs', sig => sig.replace(/\bCBS\b/g, 'C.B.S.')],
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
