/** Conservative verifier for regression tests and future review UI. */
export interface SigExpectation {
  acceptable: string[];
  requiredTokens?: string[];
  forbiddenTokens?: string[];
}

export interface SigComparison { accepted: boolean; reason: string; }

export function canonicalizeSig(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bAPPLY\b/g, 'AP')
    .replace(/\bTOPICALLY\b/g, 'TPCL')
    .replace(/\bBY MOUTH\b|\bORAL\b/g, 'PO')
    .replace(/\bSUBCUTANEOUSLY\b/g, 'SQ')
    .replace(/\bAND\b/g, '&')
    .replace(/\bWITH\b/g, 'W/')
    .replace(/[,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compareSig(actual: string, expectation: SigExpectation): SigComparison {
  const normalizedActual = canonicalizeSig(actual);
  if (expectation.acceptable.some((candidate) => canonicalizeSig(candidate) === normalizedActual)) {
    return { accepted: true, reason: 'Matches an accepted normalized rendering.' };
  }

  const tokens = new Set(normalizedActual.split(' '));
  const missing = (expectation.requiredTokens ?? []).filter((token) => !tokens.has(canonicalizeSig(token)));
  const presentForbidden = (expectation.forbiddenTokens ?? []).filter((token) => tokens.has(canonicalizeSig(token)));
  if (missing.length === 0 && presentForbidden.length === 0 && expectation.requiredTokens?.length) {
    return { accepted: true, reason: 'Contains all required semantic tokens and no prohibited tokens.' };
  }
  return { accepted: false, reason: `${missing.length ? `Missing: ${missing.join(', ')}. ` : ''}${presentForbidden.length ? `Prohibited: ${presentForbidden.join(', ')}.` : 'No accepted rendering matched.'}`.trim() };
}
