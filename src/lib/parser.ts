import type {
  SigDictionaryEntry,
  TechRule,
  SigExpansion,
  InputMode,
  Hl7ExtractionResult,
  TraceStep,
  ResolvedToken,
  ParseResult,
} from './types';
import { translateFreeTextSig } from './sigEngine';


// ── HL7 Field Extraction ──────────────────────────────────────────────────────

const HL7_DIRECTIONS_FIELDS: Array<{ segment: string; fieldIndex: number }> = [
  { segment: 'RXO', fieldIndex: 6 },
  { segment: 'RXE', fieldIndex: 7 },
  { segment: 'ORC', fieldIndex: 7 },
];

export function extractHl7DirectionsField(raw: string): Hl7ExtractionResult {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  for (const { segment, fieldIndex } of HL7_DIRECTIONS_FIELDS) {
    const segLine = lines.find((l) => l.startsWith(segment + '|'));
    if (!segLine) continue;

    const fields = segLine.split('|');
    const value = fields[fieldIndex] ?? '';
    const cleaned = value.trim();

    if (cleaned.length > 0) {
      return { extracted: cleaned, segment, fieldIndex };
    }
  }

  return {
    extracted: raw.trim(),
    segment: 'UNKNOWN',
    fieldIndex: 0,
    warning:
      'No recognized pharmacy directions segment (RXO-6, RXE-7, ORC-7) found. Falling back to raw input.',
  };
}

// ── Text Normalization ────────────────────────────────────────────────────────

const WORD_TO_NUMBER: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  once: '1', twice: '2', thrice: '3',
  half: '0.5',
};

export function normalizeText(text: string): string {
  let result = text.toLowerCase();

  for (const [word, digit] of Object.entries(WORD_TO_NUMBER)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
  }

  result = result.replace(/\s{2,}/g, ' ').trim();
  result = result.replace(/[\\^~&]/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return result;
}

// ── Regex Helper ──────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Phrase Expansion ──────────────────────────────────────────────────────────

export function applyExpansions(
  text: string,
  expansions: SigExpansion[]
): { output: string; applied: string[] } {
  const active = expansions
    .filter((e) => e.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (active.length === 0) return { output: text, applied: [] };

  let current = text;
  const applied: string[] = [];

  for (const exp of active) {
    const upperOut = exp.output_phrase.toUpperCase();

    for (const alias of exp.aliases) {
      const upperAlias = alias.toUpperCase();
      const escaped = escapeRegex(upperAlias);

      const re =
        exp.match_type === 'phrase'
          ? new RegExp(escaped, 'gi')
          : new RegExp(`(?<![A-Z0-9/])${escaped}(?![A-Z0-9/])`, 'gi');

      const next = current.replace(re, upperOut);
      if (next !== current) {
        applied.push(`"${upperAlias}" (${exp.match_type}) → "${upperOut}"`);
        current = next;
      }
    }
  }

  return { output: current, applied };
}

// ── Tech Rule Application ─────────────────────────────────────────────────────

function matchesRule(text: string, rule: TechRule): boolean {
  const lower = text.toLowerCase();
  return rule.match_values.some((pattern) => {
    const p = pattern.toLowerCase();
    switch (rule.target_type) {
      case 'contains':    return lower.includes(p);
      case 'starts_with': return lower.startsWith(p);
      case 'ends_with':   return lower.endsWith(p);
      case 'exact':       return lower === p;
      case 'regex':
        try { return new RegExp(pattern, 'i').test(text); } catch { return false; }
    }
  });
}

function applyRuleTransform(text: string, rule: TechRule): string {
  if (!matchesRule(text, rule)) return text;

  switch (rule.action_type) {
    case 'replace': {
      let result = text;
      for (const pattern of rule.match_values) {
        if (rule.target_type === 'regex') {
          try { result = result.replace(new RegExp(pattern, 'gi'), rule.output_value); }
          catch { /* invalid regex — skip */ }
        } else {
          result = result.replace(new RegExp(escapeRegex(pattern), 'gi'), rule.output_value);
        }
      }
      return result.replace(/\s{2,}/g, ' ').trim();
    }
    case 'append':  return `${text} ${rule.output_value}`.trim();
    case 'prepend': return `${rule.output_value} ${text}`.trim();
  }
}

export function applyTechRules(
  text: string,
  rules: TechRule[]
): { output: string; applied: string[] } {
  const enabled = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  let current = text;
  const applied: string[] = [];

  for (const rule of enabled) {
    if (matchesRule(current, rule)) {
      const transformed = applyRuleTransform(current, rule);
      if (transformed !== current) {
        applied.push(`Rule #${rule.priority}: "${rule.name}" — "${current}" → "${transformed}"`);
        current = transformed;
      }
    }
  }

  return { output: current, applied };
}

// ── Obsolete Redirect Application ────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0);
}

export function applyObsoleteRedirects(
  text: string,
  dictionary: SigDictionaryEntry[]
): { output: string; warnings: string[] } {
  const obsoleteMap = new Map<string, string[]>();
  for (const entry of dictionary) {
    if (entry.status === 'OBSOLETE' && entry.redirect_codes.length > 0) {
      obsoleteMap.set(entry.sig_code.toUpperCase(), entry.redirect_codes.map((c) => c.toUpperCase()));
    }
  }

  const tokens = tokenize(text);
  const warnings: string[] = [];
  const resultTokens: string[] = [];

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (obsoleteMap.has(upper)) {
      const redirects = obsoleteMap.get(upper)!;
      warnings.push(`OBSOLETE code "${upper}" → substituted: ${redirects.join(', ')}`);
      resultTokens.push(...redirects);
    } else {
      resultTokens.push(token);
    }
  }

  return { output: resultTokens.join(' '), warnings };
}

// ── SIG Code Translation ──────────────────────────────────────────────────────

export function translateCodes(
  text: string,
  dictionary: SigDictionaryEntry[]
): { resolvedTokens: ResolvedToken[]; finalSig: string } {
  const activeMap = new Map<string, SigDictionaryEntry>();
  for (const entry of dictionary) {
    if (entry.status === 'ACTIVE') activeMap.set(entry.sig_code.toUpperCase(), entry);
  }

  const tokens = tokenize(text);
  const resolvedTokens: ResolvedToken[] = tokens.map((token) => {
    const upper = token.toUpperCase();
    const entry = activeMap.get(upper);
    if (entry) {
      return {
        token,
        translation: entry.translation.toUpperCase(),
        isHighRisk: entry.is_high_risk,
        highRiskWarning: entry.high_risk_warning,
        wasRedirected: false,
        unresolved: false,
      };
    }
    return {
      token,
      translation: upper,
      isHighRisk: false,
      highRiskWarning: '',
      wasRedirected: false,
      unresolved: true,
    };
  });

  const finalSig = resolvedTokens.map((t) => t.translation).join(' ').toUpperCase();
  return { resolvedTokens, finalSig };
}

// ── Main Parser Orchestrator ──────────────────────────────────────────────────

export function runParser(
  rawInput: string,
  inputMode: InputMode,
  dictionary: SigDictionaryEntry[],
  techRules: TechRule[],
  expansions: SigExpansion[] = [],
  drugName: string = '',
  defaultSig: string = ''
): ParseResult {
  const steps: TraceStep[] = [];
  let workingText = rawInput.trim();
  let hl7Extraction: Hl7ExtractionResult | undefined;

  if (inputMode === 'freetext') {
    const { order, sig } = translateFreeTextSig(rawInput, { drug: drugName, defaultSig });
    const warnings = order.issues.map(i => `${i.severity.toUpperCase()}: ${i.message}`);
    
    steps.push({
      step: 1,
      label: 'sigEngine Algorithmic Translation',
      input: rawInput,
      output: sig,
      warnings,
      rulesApplied: ['Parsed using new sigEngine rules']
    });

    const hasHighRisk = order.issues.some(i => i.severity === 'blocking');
    const highRiskMsg = order.issues.find(i => i.severity === 'blocking')?.message || '';

    const resolvedTokens = sig.split(' ').map(t => ({
      token: t,
      translation: t,
      isHighRisk: hasHighRisk,
      highRiskWarning: highRiskMsg,
      wasRedirected: false,
      unresolved: false
    }));

    return {
      inputMode,
      rawInput,
      steps,
      resolvedTokens,
      finalSig: sig,
      hasHighRisk,
      hasUnresolved: false,
      sigEngineOrder: order,
    };
  }

  // Step 1 — HL7 Extraction or Raw Input
  if (inputMode === 'hl7') {
    hl7Extraction = extractHl7DirectionsField(rawInput);
    workingText = hl7Extraction.extracted;
    steps.push({
      step: 1,
      label: 'HL7 Field Extraction',
      input: rawInput,
      output: workingText,
      warnings: hl7Extraction.warning ? [hl7Extraction.warning] : [],
      rulesApplied: hl7Extraction.warning
        ? []
        : [`Extracted from segment ${hl7Extraction.segment}, field ${hl7Extraction.fieldIndex}`],
    });
  } else {
    steps.push({
      step: 1,
      label: 'Raw Input',
      input: rawInput,
      output: workingText,
      warnings: [],
      rulesApplied: ['Free-text mode — using raw input directly'],
    });
  }

  // Normalization folds into step 1 trace
  const afterNormalize = normalizeText(workingText);
  if (afterNormalize !== workingText) {
    steps[0].rulesApplied.push(`Normalized: numbers-to-digits, whitespace cleaned → "${afterNormalize}"`);
    steps[0].output = afterNormalize;
  }
  workingText = afterNormalize;

  // Step 2 — Phrase Expansions
  const before2 = workingText;
  const { output: after2, applied: expansionsApplied } = applyExpansions(workingText, expansions);
  workingText = after2;
  steps.push({
    step: 2,
    label: 'Phrase Expansions',
    input: before2,
    output: workingText,
    warnings: [],
    rulesApplied: expansionsApplied.length > 0 ? expansionsApplied : ['No phrase expansions matched'],
  });

  // Step 3 — Tech Rules
  const before3 = workingText;
  const { output: after3, applied: rulesApplied } = applyTechRules(workingText, techRules);
  workingText = after3;
  steps.push({
    step: 3,
    label: 'Tech Rules',
    input: before3,
    output: workingText,
    warnings: [],
    rulesApplied: rulesApplied.length > 0 ? rulesApplied : ['No tech rules matched'],
  });

  // Step 4 — Obsolete Redirects
  const before4 = workingText;
  const { output: after4, warnings: redirectWarnings } = applyObsoleteRedirects(workingText, dictionary);
  workingText = after4;
  steps.push({
    step: 4,
    label: 'Obsolete Redirects',
    input: before4,
    output: workingText,
    warnings: redirectWarnings,
    rulesApplied: redirectWarnings.length > 0 ? redirectWarnings : ['No obsolete codes detected'],
  });

  // Step 5 — Code Translation
  const { resolvedTokens, finalSig } = translateCodes(workingText, dictionary);
  const unresolvedTokens = resolvedTokens.filter((t) => t.unresolved).map((t) => t.token);
  const highRiskTokens = resolvedTokens.filter((t) => t.isHighRisk).map((t) => t.token);

  steps.push({
    step: 5,
    label: 'Code Translation',
    input: workingText,
    output: finalSig,
    warnings: [
      ...unresolvedTokens.map((t) => `Unresolved token "${t}" — passed through as literal`),
      ...highRiskTokens.map((t) => `HIGH RISK flag on token "${t}"`),
    ],
    rulesApplied: resolvedTokens
      .filter((t) => !t.unresolved)
      .map((t) => `"${t.token.toUpperCase()}" → "${t.translation}"`),
  });

  return {
    inputMode,
    rawInput,
    hl7Extraction,
    steps,
    resolvedTokens,
    finalSig,
    hasHighRisk: resolvedTokens.some((t) => t.isHighRisk),
    hasUnresolved: resolvedTokens.some((t) => t.unresolved),
  };
}
