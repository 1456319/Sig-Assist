import { SIG_CODE_REFERENCE, EQUIVALENT_SIG_CODES } from './sigCodeReference';
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

const tokenPatternCache = new Map<string, string>();
function tokenPattern(code: string, hard = false): RegExp {
  const key = `${hard ? 'H' : 'S'}:${code}`;
  let cachedStr = tokenPatternCache.get(key);
  if (!cachedStr) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const chars = hard ? 'A-Z0-9' : 'A-Z0-9/';
    cachedStr = `(^|[^${chars}])${escaped}(?=$|[^${chars}])`;
    tokenPatternCache.set(key, cachedStr);
  }
  return new RegExp(cachedStr, 'g');
}
export function rejectedOutputMatches(sig: string): string[] {
  return Object.keys(REJECTED_OUTPUT_CODES).filter(code => tokenPattern(code, true).test(normalized(sig)));
}

const PRECOMPUTED_REJECTED_RULES = Object.entries(REJECTED_OUTPUT_CODES).map(([code, rule]) => ({ code, replacement: rule.replacement as string, hard: true }));

export function applyOutputCodePolicy(sig: string, exclusions: readonly SigExclusionPreference[] = []): {
  sig: string; changes: string[]; unresolved: string[];
} {
  let output = normalized(sig);
  const changes = new Set<string>();
  const unresolved = new Set<string>();
  output = output.replace(/\bFNA\s+(?:AND|OR)\s+FVOM\b/g, () => {
    changes.add('FNA/FVOM → FNV (site packaging convention)'); return 'FNV';
  });

  const excludedCodes = new Set(
    exclusions.filter(e => e.kind === 'code').map(e => normalized(e.value))
  );
  const excludedSigs = new Set(
    exclusions.filter(e => e.kind === 'sig').map(e => normalized(e.value))
  );

  const rules: { code: string; replacement: string; hard: boolean }[] = [
    ...PRECOMPUTED_REJECTED_RULES,
  ];

  for (const e of exclusions) {
    if (e.kind !== 'code') continue;
    const code = normalized(e.value);
    if (!code || code in REJECTED_OUTPUT_CODES) continue;

    if (e.replacement) {
      rules.push({ code, replacement: normalized(e.replacement), hard: false });
    } else {
      // Find candidate equivalent codes
      const equivalents = EQUIVALENT_SIG_CODES[code] || [code];
      const nextCode = equivalents.find(
        c => c !== code && !excludedCodes.has(c) && !(c in REJECTED_OUTPUT_CODES)
      );

      if (nextCode) {
        rules.push({ code, replacement: nextCode, hard: false });
      } else {
        // If all codes are blacklisted, fallback to verbatim expansion
        const verbatim = SIG_CODE_REFERENCE[code] || '';
        rules.push({ code, replacement: verbatim, hard: false });
      }
    }
  }

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

  // 2. Handle excluded complete SIGs (e.g. technician selected "Never use this SIG")
  if (excludedSigs.has(output) || excludedSigs.has(normalized(sig))) {
    let alternateFound = false;

    // Phase 1: Try alternate duplicate codes first
    for (const [code, equivalents] of Object.entries(EQUIVALENT_SIG_CODES)) {
      if (tokenPattern(code).test(output)) {
        for (const alt of equivalents) {
          if (alt === code || excludedCodes.has(alt) || alt in REJECTED_OUTPUT_CODES) continue;
          const candidateSig = output.replace(tokenPattern(code), `$1${alt}`);
          if (!excludedSigs.has(candidateSig)) {
            changes.add(`${code} → ${alt} (alternate equivalent code for excluded SIG)`);
            output = candidateSig;
            alternateFound = true;
            break;
          }
        }
        if (alternateFound) break;
      }
    }

    // Phase 2: If no alternate duplicate code works, try verbatim fallback
    if (!alternateFound) {
      for (const [code] of Object.entries(EQUIVALENT_SIG_CODES)) {
        if (tokenPattern(code).test(output)) {
          const verbatim = SIG_CODE_REFERENCE[code];
          if (verbatim) {
            const candidateSig = output.replace(tokenPattern(code), `$1${verbatim}`);
            if (!excludedSigs.has(candidateSig)) {
              changes.add(`${code} → ${verbatim} (verbatim fallback, all codes blacklisted)`);
              output = candidateSig;
              alternateFound = true;
              break;
            }
          }
        }
      }
    }

    if (!alternateFound && (excludedSigs.has(output) || excludedSigs.has(normalized(sig)))) {
      unresolved.add('excluded complete SIG');
    }
  }

  for (const rule of rules) if (tokenPattern(rule.code, rule.hard).test(output)) unresolved.add(rule.code);
  return { sig: unresolved.size ? '' : output, changes: [...changes], unresolved: [...unresolved] };
}
