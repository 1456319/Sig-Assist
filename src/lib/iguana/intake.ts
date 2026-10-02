import { cancelOrder, orderKey, saveOrder, type OrderSource, type QueueOrder } from '../orderQueue';
import { clinicalMetadataStamp, type DiagnosticSink, type ScriptEvent } from './types';

export interface IntakeSummary { added: number; revised: number; duplicates: number; cancelled: number; ignored: number; quarantined: number }

export function ingestScriptEvents(
  original: QueueOrder[], events: ScriptEvent[], suggest: (source: OrderSource) => string, emit: DiagnosticSink,
): { orders: QueueOrder[]; summary: IntakeSummary } {
  let orders = original;
  const summary: IntakeSummary = { added: 0, revised: 0, duplicates: 0, cancelled: 0, ignored: 0, quarantined: 0 };
  const batchIds = new Map<string, string>();
  const eventStamp = (event: ScriptEvent) => JSON.stringify([event.kind.toLowerCase(), event.facility, event.patientRef, event.pon, event.drug, event.directions, clinicalMetadataStamp(event.metadata)]);
  const conflicts = new Set<string>();
  for (const event of events) {
    if (!event.messageId || !event.sender) continue;
    const key = JSON.stringify([event.sender, event.messageId]);
    const previous = batchIds.get(key);
    if (previous && previous !== eventStamp(event)) conflicts.add(key);
    batchIds.set(key, eventStamp(event));
  }
  batchIds.clear();
  function hold(event: ScriptEvent, reason: string) {
    orders = orders.map(order => order.iguana?.sender === event.sender && (order.iguana.messageIds.includes(event.messageId) || event.facility === order.facility && event.patientRef === order.patientRef && event.pon === order.pon)
      ? { ...order, intakeHold: reason, approved: undefined, copied: undefined, subOrderApprovals: undefined, subOrderCopied: undefined } : order);
  }
  // Message chronology, not time of viewing a log in the HAR.
  const sorted = events.map((event, index) => ({ event, index })).sort((a, b) => {
    const ta = Date.parse(a.event.sentTime ?? ''); const tb = Date.parse(b.event.sentTime ?? '');
    return Number.isFinite(ta) && Number.isFinite(tb) ? ta - tb || a.index - b.index : a.index - b.index;
  });
  for (const { event } of sorted) {
    const kind = event.kind.toLowerCase();
    const identity = JSON.stringify([event.sender, event.messageId]);
    const details = { kind: event.kind, messageId: event.messageId, pon: event.pon, facility: event.facility, patientRef: event.patientRef, logId: event.log.logId };
    if (conflicts.has(identity)) {
      summary.quarantined++; hold(event, 'Conflicting content for one SCRIPT MessageID. Investigate source, then use Revise source to resolve.');
      emit('error', 'intake.conflict', 'All conflicting representations of this MessageID were quarantined', details); continue;
    }
    if (kind !== 'newrx' && kind !== 'cancelrx') {
      summary.ignored++;
      emit('info', 'intake.status', 'Status/unsupported transaction recorded without creating an order', { ...details, relatesToMessageId: event.relatesToMessageId });
      continue;
    }
    const missing = ['messageId', 'sender'].filter(field => !event[field as 'messageId' | 'sender']);
    if (kind === 'newrx') missing.push(...(['facility', 'patientRef', 'pon', 'drug', 'directions'] as const).filter(field => !event[field]?.trim()));
    if (missing.length) {
      summary.quarantined++;
      emit('error', 'intake.quarantine', 'Required identity/source fields missing; no guessed defaults inserted', { ...details, missing, warnings: event.warnings });
      continue;
    }
    const stamp = eventStamp(event);
    const prior = batchIds.get(identity);
    if (prior) {
      if (prior === stamp) { summary.duplicates++; emit('debug', 'intake.duplicate', 'Duplicate SCRIPT MessageID in this batch', details); }
      else { summary.quarantined++; emit('error', 'intake.conflict', 'Same SCRIPT MessageID carries different content; inspect both logs', details); }
      continue;
    }
    batchIds.set(identity, stamp);
    if (kind === 'cancelrx') {
      const matches = orders.filter(order => {
        const bySource = event.facility && event.patientRef && event.pon && order.id === orderKey({ facility: event.facility, patientRef: event.patientRef, pon: event.pon, drug: '', directions: '' });
        const byMessage = event.relatesToMessageId && order.iguana?.sender === event.sender && order.iguana.messageIds.includes(event.relatesToMessageId);
        return bySource || byMessage;
      });
      if (matches.length !== 1) {
        summary.quarantined++;
        emit('error', 'intake.cancel.unmatched', 'Cancellation cannot be uniquely matched; manual investigation required', { ...details, relatesToMessageId: event.relatesToMessageId, candidates: matches.length });
        continue;
      }
      const match = matches[0];
      if (match.cancelled) { summary.duplicates++; continue; }
      orders = orders.map(order => order.id === match.id ? cancelOrder(order) : order);
      summary.cancelled++;
      emit('warn', 'intake.cancelled', 'Matched cancellation blocks review/copy in the local queue', details);
      continue;
    }
    const source: OrderSource = {
      facility: event.facility!, patientRef: event.patientRef!, pon: event.pon!, drug: event.drug!, directions: event.directions!, iguana: event.metadata,
    };
    const id = orderKey(source);
    const existing = orders.find(order => order.id === id);
    if (existing && (existing.iguana?.sender !== event.sender || !existing.iguana)) {
      summary.quarantined++;
      emit('error', 'intake.identity.conflict', 'Incoming identity collides with a manual order or another sender', details);
      continue;
    }
    const sameSource = existing && existing.drug === source.drug && existing.directions === source.directions && clinicalMetadataStamp(existing.iguana) === clinicalMetadataStamp(source.iguana);
    const seenId = existing?.iguana?.messageIds.includes(event.messageId);
    if (seenId && !sameSource) {
      const historical = existing!.previousSources.some(source => source.iguana?.sender === event.sender && source.iguana.messageIds.includes(event.messageId)
        && source.drug === event.drug && source.directions === event.directions && clinicalMetadataStamp(source.iguana) === clinicalMetadataStamp(event.metadata));
      if (historical) { summary.duplicates++; emit('debug', 'intake.historical.duplicate', 'Historical source replay matched its saved revision; current source retained', details); continue; }
      hold(event, 'Previously imported SCRIPT MessageID changed content. Investigate source, then use Revise source to resolve.');
      summary.quarantined++; emit('error', 'intake.conflict', 'Previously imported SCRIPT MessageID has changed content', details); continue;
    }
    if (existing?.cancelled) {
      summary.ignored++; emit('warn', 'intake.cancelled.replay', 'Replay does not reopen a cancelled order', details); continue;
    }
    if (existing && !sameSource) {
      const incomingTime = Date.parse(event.sentTime ?? ''); const previousTime = Date.parse(existing.iguana?.sentTime ?? '');
      if (!Number.isFinite(incomingTime) || !Number.isFinite(previousTime) || incomingTime <= previousTime) {
        if (!Number.isFinite(incomingTime) || !Number.isFinite(previousTime) || incomingTime === previousTime) hold(event, 'Source revision has ambiguous timestamps. Investigate source, then use Revise source to resolve.');
        summary.quarantined++; emit('warn', 'intake.revision.unordered', 'Changed source is older, equal-time, or has no usable timestamp; existing review retained for investigation', details); continue;
      }
    }
    try {
      const metadata = { ...event.metadata, messageIds: [...new Set([...(existing?.iguana?.messageIds ?? []), event.messageId])] };
      if (sameSource) {
        // A newer identical prescription advances provenance without invalidating review.
        const newer = Date.parse(event.sentTime ?? '') > Date.parse(existing!.iguana?.sentTime ?? '');
        if (!seenId || newer) orders = orders.map(order => order.id === id ? { ...order, iguana: newer ? metadata : { ...order.iguana!, messageIds: metadata.messageIds } } : order);
        summary.duplicates++;
        emit('debug', 'intake.duplicate', 'Order source already imported; technician review preserved', details);
        continue;
      }
      orders = saveOrder(orders, { ...source, iguana: metadata }, suggest(source), existing?.id);
      if (existing) summary.revised++; else summary.added++;
      emit('info', existing ? 'intake.revised' : 'intake.added', existing ? 'Source changed; draft regenerated and approval cleared' : 'Order added for technician review', { ...details, orderId: id, rawDirections: source.directions, metadata });
    } catch (error) {
      summary.quarantined++; emit('error', 'intake.queue.failed', 'Unable to generate/store queue order', { ...details, error: String(error) });
    }
  }
  emit('info', 'intake.summary', 'Batch intake complete', { ...summary, queueSize: orders.length });
  return { orders, summary };
}
