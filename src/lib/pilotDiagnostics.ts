/** PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION: bounded, allowlisted metadata only.
 * Keep the feedback feature; review this recorder and retention before release.
 * Never add message text, PONs, SIG contents, hostnames or credentials here.
 */
const EVENTS_KEY = 'sig_assist_pilot_events_v1';
const COUNTS_KEY = 'sig_assist_pilot_counts_v1';
const CODES = ['screen.open', 'customization.count', 'dictionary.save', 'connector.request', 'connector.response', 'connector.failed', 'desktop.response', 'feedback.save'] as const;
export type PilotCode = typeof CODES[number];
const OUTCOMES = ['ok', 'failed', 'unavailable', 'unknown', 'changed', 'file_system', 'browser_cache'] as const;
const SCREENS = ['queue', 'workbench', 'dictionary', 'rules', 'expansions', 'settings'] as const;
const REASONS = ['AUTOMATIC_AUTH_UNAVAILABLE', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'TIMEOUT_OR_STOPPED', 'INVALID_LOG_EXPORT', 'IGUANA_HTTP_401', 'IGUANA_HTTP_403', 'BRIDGE_UNREACHABLE', 'UNCLASSIFIED'] as const;
const NUMBERS = ['durationMs', 'count', 'beforeCount', 'afterCount', 'httpStatus', 'port', 'headers', 'unreadable'] as const;
export interface PilotFields {
  reason?: typeof REASONS[number];
  outcome?: typeof OUTCOMES[number];
  screen?: typeof SCREENS[number];
  metric?: 'dictionary' | 'rules' | 'expansions';
  operation?: 'detect' | 'inspect' | 'target' | 'send' | 'docutrack';
  uncertain?: boolean;
  verified?: boolean;
  durationMs?: number;
  count?: number;
  beforeCount?: number;
  afterCount?: number;
  httpStatus?: number;
  port?: number;
  headers?: number;
  unreadable?: number;
}
export interface PilotEvent { at: string; code: PilotCode; fields: PilotFields }
let volatileEvents: PilotEvent[] = [];
const listeners = new Set<(event: PilotEvent) => void>();
export function subscribePilotEvents(listener: (event: PilotEvent) => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}

function safeFields(value: PilotFields): PilotFields {
  const fields: PilotFields = {};
  if (OUTCOMES.includes(value.outcome!)) fields.outcome = value.outcome;
  if (SCREENS.includes(value.screen!)) fields.screen = value.screen;
  if (REASONS.includes(value.reason!)) fields.reason = value.reason;
  if (['dictionary', 'rules', 'expansions'].includes(value.metric!)) fields.metric = value.metric;
  if (['detect', 'inspect', 'target', 'send', 'docutrack'].includes(value.operation!)) fields.operation = value.operation;
  for (const key of ['uncertain', 'verified'] as const) if (typeof value[key] === 'boolean') fields[key] = value[key];
  for (const key of NUMBERS) if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key]! >= 0) fields[key] = Math.round(value[key]!);
  return fields;
}

export function readPilotEvents(): PilotEvent[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    if (!Array.isArray(raw)) return volatileEvents;
    return raw.filter((e): e is PilotEvent => e && CODES.includes(e.code) && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)))
      .slice(-80).map(e => ({ at: new Date(e.at).toISOString(), code: e.code, fields: safeFields(e.fields || {}) }));
  } catch { return volatileEvents; }
}

export function recordPilotEvent(code: PilotCode, values: PilotFields = {}): void {
  if (!CODES.includes(code)) return;
  const events = [...readPilotEvents(), { at: new Date().toISOString(), code, fields: safeFields(values) }].slice(-80);
  volatileEvents = events;
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch { /* In-memory diagnostics remain available. */ }
  for (const listener of listeners) { try { listener(events[events.length - 1]); } catch { /* Diagnostics cannot interrupt work. */ } }
}

function arrayCount(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { state: 'absent' as const, count: 0 };
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? { state: 'readable' as const, count: data.length } : { state: 'invalid' as const, count: null };
  } catch { return { state: 'unavailable' as const, count: null }; }
}

export function observeCustomizationCounts() {
  const counts = {
    dictionary: arrayCount('sig_assist_local_sig_dictionary'),
    rules: arrayCount('sig_assist_local_tech_rules'),
    expansions: arrayCount('sig_assist_local_sig_expansions'),
  };
  let previous: Partial<Record<keyof typeof counts, number>> = {};
  try { previous = JSON.parse(localStorage.getItem(COUNTS_KEY) || '{}') || {}; } catch { /* First usable observation. */ }
  for (const metric of ['dictionary', 'rules', 'expansions'] as const) {
    const before = previous[metric], after = counts[metric].count;
    if (typeof before === 'number' && after !== null && before !== after) {
      recordPilotEvent('customization.count', { metric, beforeCount: before, afterCount: after, outcome: 'changed' });
    }
  }
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([, v]) => v.count !== null).map(([key, v]) => [key, v.count])))); } catch { /* Metadata must not block work. */ }
  return counts;
}

export function captureFeedbackDiagnostics(screen: typeof SCREENS[number], storageMode: 'file_system' | 'browser_cache') {
  return {
    format: 'sig-assist-feedback-diagnostics' as const, schemaVersion: 1 as const,
    marker: 'PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION' as const,
    capturedAt: new Date().toISOString(), screen, storageMode,
    pageProtocol: ['http:', 'https:', 'file:'].includes(location.protocol) ? location.protocol : 'other',
    pagePort: /^\d{1,5}$/.test(location.port) ? Number(location.port) : null,
    secureContext: window.isSecureContext === true,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    dictionarySource: import.meta.env.VITE_SUPABASE_URL ? 'shared-configured' : 'local',
    customizations: observeCustomizationCounts(), events: readPilotEvents(),
  };
}

export type FeedbackDiagnostics = ReturnType<typeof captureFeedbackDiagnostics>;

export function pilotReason(value: unknown): PilotFields['reason'] {
  return REASONS.includes(value as typeof REASONS[number]) ? value as typeof REASONS[number] : 'UNCLASSIFIED';
}
