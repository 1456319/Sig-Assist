import { SIG_CODE_REFERENCE } from './sigCodeReference';
import type { SigExclusionPreference } from './types';

// Site-reported restrictions, not a claim of a complete vendor blacklist.
// Keep separate from the root dictionary: a listed code can still be rejected
// by the site's packaging workflow. Original source/report text is never edited.
export const REJECTED_OUTPUT_CODES = {
  INH: { replacement: 'BY INHALATION', reason: 'Reported as rejected; inhaler and nebulizer routes are resolved separately.' },
  FNA: { replacement: 'FNAU', reason: 'Reported obsolete. Use FNV for combined nausea/vomiting.' },
  FVOM: { replacement: 'FOR VOMITING', reason: 'Reported obsolete. Spell out vomiting alone; use FNV for the combined indication.' },
  Q23H: { replacement: 'EVERY 2 TO 3 HOURS', reason: 'The root list expands this as 2–3 hours, not 23 hours. A prescribed 23-hour interval is written out.' },
  PNA: { replacement: 'PNEUMONIA', reason: 'Reported packaging trigger. Use FPNE for the unqualified indication or spell out pneumonia.' },
} as const;

const normalized = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
function tokenPattern(code: string, hard = false): RegExp {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chars = hard ? 'A-Z0-9' : 'A-Z0-9/';
  return new RegExp(`(^|[^${chars}])${escaped}(?=$|[^${chars}])`, 'g');
}
export function rejectedOutputMatches(sig: string): string[] {
  return Object.keys(REJECTED_OUTPUT_CODES).filter(code => tokenPattern(code, true).test(normalized(sig)));
}

export function applyOutputCodePolicy(sig: string, exclusions: readonly SigExclusionPreference[] = []): {
  sig: string; changes: string[]; unresolved: string[];
} {
  let output = normalized(sig);
  const changes = new Set<string>();
  const unresolved = new Set<string>();
  output = output.replace(/\bFNA\s+(?:AND|OR)\s+FVOM\b/g, () => {
    changes.add('FNA/FVOM → FNV (site packaging convention)'); return 'FNV';
  });
  const rules = [
    ...Object.entries(REJECTED_OUTPUT_CODES).map(([code, rule]) => ({ code, replacement: rule.replacement as string, hard: true })),
    ...exclusions.filter(e => e.kind === 'code' && normalized(e.value) && !(normalized(e.value) in REJECTED_OUTPUT_CODES))
      .map(e => ({ code: normalized(e.value), replacement: normalized(e.replacement || SIG_CODE_REFERENCE[normalized(e.value)] || ''), hard: false })),
  ];
  // A replacement can itself be excluded. Iterate boundedly and suppress an
  // unresolved/cyclic suggestion instead of deleting a clinical instruction.
  for (let pass = 0; pass <= rules.length; pass++) {
    let changed = false;
    for (const rule of rules) {
      const pattern = tokenPattern(rule.code, rule.hard);
      output = output.replace(pattern, (match, boundary: string) => {
        if (!rule.replacement || tokenPattern(rule.code, rule.hard).test(rule.replacement)) {
          unresolved.add(rule.code); return match;
        }
        changed = true; changes.add(`${rule.code} → ${rule.replacement}`);
        return boundary + rule.replacement;
      });
    }
    if (!changed) break;
  }
  for (const rule of rules) if (tokenPattern(rule.code, rule.hard).test(output)) unresolved.add(rule.code);
  if (exclusions.some(e => e.kind === 'sig' && [normalized(sig), output].includes(normalized(e.value)))) unresolved.add('excluded complete SIG');
  return { sig: unresolved.size ? '' : output, changes: [...changes], unresolved: [...unresolved] };
}
