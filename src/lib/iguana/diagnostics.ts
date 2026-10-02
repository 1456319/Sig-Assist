import { traceLogger } from '../diagnostics/traceLogger';
import type { DiagnosticEvent, DiagnosticSink } from './types';

/** Separate bounded intake history: a busy poll must not hide clinical traces. */
export class ConnectorDiagnostics {
  events: DiagnosticEvent[] = [];
  dropped = 0;
  counts: Record<string, number> = {};
  private seq = 0;
  private listeners = new Set<() => void>();
  constructor(private capacity = 3000) {}
  emit: DiagnosticSink = (level, stage, message, details = {}) => {
    const event = { seq: ++this.seq, timestamp: new Date().toISOString(), level, stage, message, details };
    this.events.push(event);
    this.counts[stage] = (this.counts[stage] ?? 0) + 1;
    if (this.events.length > this.capacity) { this.events.shift(); this.dropped++; }
    // Only summaries go into the shared logger; the full export stays here.
    if (level !== 'debug') traceLogger.log('intake', level.toUpperCase() as 'INFO' | 'WARN' | 'ERROR', 'IguanaConnector', message, { stage });
    this.listeners.forEach(listener => listener());
  };
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  export(context: Record<string, unknown>) {
    return {
      format: 'sig-assist-iguana-diagnostics', schemaVersion: 1,
      exportedAt: new Date().toISOString(), redacted: false,
      ...context, droppedEvents: this.dropped, stageCounts: this.counts, events: this.events,
    };
  }
}
