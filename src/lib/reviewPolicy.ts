export interface SigExclusion {
  kind: 'code' | 'sig';
  value: string;
}

export function finalSig(text: string): string {
  return text.trim().toUpperCase();
}

const comparable = (text: string) => finalSig(text).replace(/\s+/g, ' ');

export function excludedMatches(text: string, exclusions: SigExclusion[]): SigExclusion[] {
  const sig = comparable(text);
  return exclusions.filter(({ kind, value }) => {
    const normalized = comparable(value);
    if (!normalized) return false;
    if (kind === 'sig') return normalized === sig;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Z0-9/])${escaped}($|[^A-Z0-9/])`).test(sig);
  });
}

// Approval is tied to the complete source context, current draft and preferences.
// Changing any of them invalidates approval, even if the rendered SIG is unchanged.
export function reviewStamp(source: string, draft: string, exclusions: SigExclusion[], policyRevision = 0): string {
  return JSON.stringify([source, finalSig(draft), exclusions, policyRevision]);
}

export function copyBlockReason(source: string, draft: string, exclusions: SigExclusion[], approved?: string, unavailable = false, policyRevision = 0): string | undefined {
  if (unavailable) return 'This order is cancelled, its source is changing, or its message profile is unverified.';
  if (!finalSig(draft)) return 'Enter a final SIG before reviewing.';
  if (excludedMatches(draft, exclusions).length) return 'The final SIG matches a session exclusion. Edit it or undo the exclusion.';
  if (approved !== reviewStamp(source, draft, exclusions, policyRevision)) return 'Review the current order, directions, warnings and final SIG before copying.';
}
