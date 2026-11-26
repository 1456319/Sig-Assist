import type { SigDatasetInput } from './sigDataset';

export interface WorkflowFrame {
  id: number; sessionId: string; kind: string; observedAt: string;
  pon?: string | null; view?: string; fields?: Record<string, string>; changed?: string[]; sigMode?: string | null;
}
export interface WorkflowUpdates {
  ok: boolean; active: boolean; sessionId?: string; status: string; eventSource: string;
  cursor: number; gaps: number; dropped: number; frames: WorkflowFrame[];
}
let state = { active: false, status: 'STOPPED', eventSource: '', gaps: 0, frames: 0, error: '' };
const listeners = new Set<() => void>();
export const workflowObservationState = () => state;
export const subscribeWorkflowObservation = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function publishWorkflowObservation(update: Partial<typeof state>) { state = { ...state, ...update }; for (const listener of listeners) listener(); }
export async function readWorkflowUpdates(after: number, sessionId?: string, signal?: AbortSignal): Promise<WorkflowUpdates> {
  const response = await fetch('/connector/pilot/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ after, sessionId }), signal });
  if (!response.ok) throw new Error('Automatic recording connection unavailable. Local connector files continue independently of this page.');
  const data = await response.json();
  if (!data || data.ok !== true || typeof data.active !== 'boolean' || !Array.isArray(data.frames) || data.frames.length > 500 || !Number.isSafeInteger(data.cursor) || data.cursor < 0 || !Number.isSafeInteger(data.gaps) || data.gaps < 0) throw new Error('Automatic recording returned an unsupported response. Restart the connector from this build.');
  return data;
}

/** Observations retain their role. Neither PON equality nor button events certify a save. */
export function workflowFrameSamples(frame: WorkflowFrame): SigDatasetInput[] {
  if (!['order_visible', 'order_changed', 'view_changed', 'fields_changed'].includes(frame.kind) || !frame.fields || !Number.isSafeInteger(frame.id) || frame.id < 1 || typeof frame.sessionId !== 'string' || !Number.isFinite(Date.parse(frame.observedAt))) return [];
  const fields = frame.fields;
  const sigs = ['order_sig', 'message_sig', 'draft_sig', 'linked_sig', 'default_sig', 'structured_sig'];
  const metadata = Object.fromEntries(Object.entries(fields).filter(([role, value]) => ['quantity', 'days_supply', 'start_date', 'delivery_date', 'delivery_id', 'batch', 'drug', 'package_type', 'admin_times'].includes(role) && typeof value === 'string' && value.length <= 4000));
  return sigs.filter(role => typeof fields[role] === 'string' && fields[role].trim() && fields[role].length <= 4000 && (frame.kind !== 'fields_changed' || !frame.changed || frame.changed.includes(role))).map(role => ({
    orderKey: `observer:${frame.sessionId}:${frame.pon || 'unpaired'}`, partId: `${frame.id}:${role}`, revision: 1,
    drug: metadata.drug || '', rawSig: role === 'draft_sig' && fields.message_sig?.trim() ? fields.message_sig : fields[role],
    ...(role === 'draft_sig' ? { finalSig: fields[role] } : {}),
    stage: 'framework_observed', captureKind: 'framework_sig_observation', origin: 'framework', sourceMatch: 'unpaired',
    observation: { sessionId: frame.sessionId, frame: frame.id, role, view: frame.view || 'unknown', observedAt: frame.observedAt, ...(frame.sigMode ? { sigMode: frame.sigMode } : {}), fields: metadata },
  }));
}
