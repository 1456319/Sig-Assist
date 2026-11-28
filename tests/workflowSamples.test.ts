import { expect, it } from 'vitest';
import { workflowFrameSamples, type WorkflowFrame } from '../src/lib/workflowObservation';
import { fitSlidingScaleBudget } from '../src/lib/clinical/slidingScaleBudget';

const frame: WorkflowFrame = { id: 12, sessionId: 'synthetic-session', kind: 'order_visible', observedAt: '2026-11-26T12:00:00Z',
  pon: 'SYNTHETIC:12', view: 'directions', fields: { message_sig: 'Take one tablet daily', draft_sig: '1T PO QD', linked_sig: 'OLD LINKED SIG', quantity: '30', password: 'DO NOT RETAIN' } };
it('preserves SIG roles and local metadata without promoting observed PONs or drafts to verified examples', () => {
  const samples = workflowFrameSamples(frame);
  expect(samples).toHaveLength(3);
  expect(samples.map(row => row.observation?.role)).toEqual(['message_sig', 'draft_sig', 'linked_sig']);
  expect(samples[1]).toMatchObject({ rawSig: 'Take one tablet daily', finalSig: '1T PO QD', stage: 'framework_observed', sourceMatch: 'unpaired', observation: { fields: { quantity: '30' } } });
  expect(samples[2]).not.toHaveProperty('finalSig');
  expect(JSON.stringify(samples)).not.toContain('DO NOT RETAIN');
  expect(samples.every(row => row.acceptable === undefined)).toBe(true);
  expect(workflowFrameSamples({ ...frame, kind: 'button_invoked' })).toHaveLength(0);
});
it('records changed SIGs only and retains observations without readable PONs as unpaired', () => {
  expect(workflowFrameSamples({ ...frame, kind: 'fields_changed', changed: ['quantity'] })).toHaveLength(0);
  const samples = workflowFrameSamples({ ...frame, pon: null, kind: 'fields_changed', changed: ['draft_sig'] });
  expect(samples).toHaveLength(1); expect(samples[0].sourceMatch).toBe('unpaired');
  expect(workflowFrameSamples(frame)[1].partId).not.toBe(workflowFrameSamples({ ...frame, id: 13 })[1].partId);
});
it('groups only the roles in a single no-PON frame and keeps exact frame replay stable', () => {
  const unpaired = { ...frame, pon: null };
  const roles = workflowFrameSamples(unpaired);
  const next = workflowFrameSamples({ ...unpaired, id: frame.id + 1 });
  expect(roles).toHaveLength(3);
  expect(new Set(roles.map(sample => sample.orderKey)).size).toBe(1);
  expect(next[0].orderKey).not.toBe(roles[0].orderKey);
  expect(workflowFrameSamples(unpaired)).toEqual(roles);
  expect(roles.every(sample => sample.sourceMatch === 'unpaired' && sample.acceptable === undefined)).toBe(true);
  expect(workflowFrameSamples(frame)[0].orderKey).toBe('observer:synthetic-session:SYNTHETIC:12');
  expect(workflowFrameSamples({ ...frame, pon: 'unpaired' })[0].orderKey).not.toBe(roles[0].orderKey);
  expect(workflowFrameSamples({ ...unpaired, kind: 'observation_unavailable' })).toEqual([]);
});

it('counts the MSI-confirmed three-character ordinary-preview delimiter in the shared sliding-scale budget', () => {
  const exact = fitSlidingScaleBudget(['X'.repeat(195), 'Y']);
  expect(exact.rawLength).toBe(199); expect(exact.estimatedExpandedLength).toBe(199); expect(exact.overLimit).toBe(false);
  const over = fitSlidingScaleBudget(['X'.repeat(196), 'Y']);
  expect(over.rawLength).toBe(200); expect(over.overLimit).toBe(true);
  expect(over.parts).toEqual(['X'.repeat(196), 'Y']);
});
