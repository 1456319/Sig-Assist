import type { ParsedSigOrder } from './sigEngine';

export type TranslationDiagnosticKind = 'blocked' | 'unaccepted-output' | 'parser-warning';

export interface TranslationDiagnostic {
  id: string;
  occurredAt: string;
  kind: TranslationDiagnosticKind;
  source: 'manual' | 'iguana';
  drug: string;
  output: string;
  issueCodes: string[];
  redactedInput: string;
  // Never populate this unless a future encrypted, explicitly opted-in store exists.
  rawInput?: never;
}

export interface TranslationDiagnosticSink { record(event: TranslationDiagnostic): void; }

export function redactDirections(value: string): string {
  return value
    .replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, '[DATE]')
    .replace(/\b\d{3,}\b/g, '[NUMBER]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createTranslationDiagnostic(
  kind: TranslationDiagnosticKind,
  source: TranslationDiagnostic['source'],
  rawInput: string,
  drug: string,
  output: string,
  order: ParsedSigOrder,
): TranslationDiagnostic {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    kind,
    source,
    drug,
    output,
    issueCodes: order.issues.map((issue) => issue.code),
    redactedInput: redactDirections(rawInput),
  };
}

/** Session-only default sink. Persistent diagnostic storage must be encrypted. */
export class SessionDiagnosticSink implements TranslationDiagnosticSink {
  private events: TranslationDiagnostic[] = [];
  constructor(private readonly maxEvents = 200) {}
  record(event: TranslationDiagnostic): void { this.events = [...this.events, event].slice(-this.maxEvents); }
  list(): readonly TranslationDiagnostic[] { return this.events; }
  clear(): void { this.events = []; }
}
