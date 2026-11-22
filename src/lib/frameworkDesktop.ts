import { recordPilotEvent } from './pilotDiagnostics';

export const rxEntryFields = [
  ['quantity', 'Quantity'], ['daysSupply', 'Days Supply'], ['startDate', 'Start Date'], ['deliveryDate', 'Delivery Date'],
] as const;
export type RxEntryField = typeof rxEntryFields[number][0];

export interface FrameworkDetection {
  ok: boolean;
  error?: string;
  token?: string;
  expiresAt?: number;
  pon?: string;
  pons?: string[];
  instances?: number;
  openErxWindows?: number;
  viewportStatus?: string;
  entryWindow?: { title: string; pid: number };
  scanMode?: string;
  windowSelectionRequired?: boolean;
  warnings?: string[];
  fields?: Partial<Record<'sig' | 'times' | RxEntryField, { label: string; currentValue: string }>>;
  diagnostics?: unknown;
  draftReady?: boolean;
  completed?: RxEntryField[];
  verified?: boolean;
  uncertain?: boolean;
  next?: FrameworkDetection;
}

export async function frameworkDesktop(action: 'detect' | 'inspect' | 'target' | 'send' | 'entry-fields' | 'fill', body: Record<string, unknown> = {}): Promise<FrameworkDetection> {
  if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Launch Start-Iguana-Connector.bat in the same Windows/Citrix session as Framework.');
  const started = performance.now();
  try {
    const response = await fetch(`/connector/desktop/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65000),
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'This connector is older than the page. Close it and start the connector from the new ZIP.' : `Desktop connector returned HTTP ${response.status}.`);
    const result: FrameworkDetection = await response.json();
    recordPilotEvent('desktop.response', { operation: action, outcome: result.ok ? 'ok' : 'failed', durationMs: performance.now() - started, uncertain: result.uncertain, verified: result.verified });
    return result;
  } catch (error) {
    recordPilotEvent('desktop.response', { operation: action, outcome: 'failed', durationMs: performance.now() - started });
    throw error;
  }
}

export function downloadDesktopDiagnostics(diagnostics: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'sig-assist-desktop-diagnostics', buildId: __SIG_ASSIST_BUILD__, appVersion: __SIG_ASSIST_VERSION__, exportedAt: new Date().toISOString(), evidence: diagnostics }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `sig-assist-desktop-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
