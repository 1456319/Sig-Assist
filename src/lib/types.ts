export interface SigDictionaryEntry {
  id: string;
  sig_code: string;
  translation: string;
  status: 'ACTIVE' | 'OBSOLETE';
  redirect_codes: string[];
  is_high_risk: boolean;
  high_risk_warning: string;
  created_at: string;
  updated_at: string;
}

export type SigDictionaryInsert = Omit<SigDictionaryEntry, 'id' | 'created_at' | 'updated_at'>;

export interface TechRule {
  id: string;
  name: string;
  target_type: 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'exact';
  match_values: string[];
  action_type: 'replace' | 'append' | 'prepend';
  output_value: string;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type TechRuleInsert = Omit<TechRule, 'id' | 'created_at' | 'updated_at'>;

export interface SigExpansion {
  id: string;
  output_phrase: string;
  aliases: string[];
  match_type: 'token' | 'phrase';
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type SigExpansionInsert = Omit<SigExpansion, 'id' | 'created_at' | 'updated_at'>;

// Parser types

export type InputMode = 'hl7' | 'freetext';

export interface Hl7ExtractionResult {
  extracted: string;
  segment: string;
  fieldIndex: number;
  warning?: string;
}

export interface TraceStep {
  step: number;
  label: string;
  input: string;
  output: string;
  warnings: string[];
  rulesApplied: string[];
}

export interface ResolvedToken {
  token: string;
  translation: string;
  isHighRisk: boolean;
  highRiskWarning: string;
  wasRedirected: boolean;
  redirectSource?: string;
  unresolved: boolean;
}

export interface ParseResult {
  inputMode: InputMode;
  rawInput: string;
  hl7Extraction?: Hl7ExtractionResult;
  steps: TraceStep[];
  resolvedTokens: ResolvedToken[];
  finalSig: string;
  hasHighRisk: boolean;
  hasUnresolved: boolean;
}
