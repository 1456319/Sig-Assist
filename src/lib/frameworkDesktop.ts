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
  warnings?: string[];
  fields?: Partial<Record<'sig' | 'times', { label: string; currentValue: string }>>;
  diagnostics?: unknown;
  verified?: boolean;
  uncertain?: boolean;
  next?: FrameworkDetection;
}

export async function frameworkDesktop(action: 'detect' | 'inspect' | 'target' | 'send', body: Record<string, unknown> = {}): Promise<FrameworkDetection> {
  if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Launch Start-Iguana-Connector.bat in the same Windows/Citrix session as Framework.');
  const response = await fetch(`/connector/desktop/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65000),
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'This connector is older than the page. Close it and start the connector from the new ZIP.' : `Desktop connector returned HTTP ${response.status}.`);
  return response.json();
}

export function downloadDesktopDiagnostics(diagnostics: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'sig-assist-desktop-diagnostics', buildId: __SIG_ASSIST_BUILD__, exportedAt: new Date().toISOString(), evidence: diagnostics }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `sig-assist-desktop-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
