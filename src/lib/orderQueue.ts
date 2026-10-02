import { finalSig } from './reviewPolicy';
import { clinicalMetadataStamp, type IguanaOrderMetadata } from './iguana/types';

export interface OrderSource {
  facility: string;
  patientRef: string;
  pon: string;
  drug: string;
  directions: string;
  defaultSig?: string;
  iguana?: IguanaOrderMetadata;
}

export interface QueueOrder extends OrderSource {
  id: string;
  revision: number;
  previousSources: OrderSource[];
  draft: string;
  approved?: string;
  copied?: string;
  cancelled: boolean;
  intakeHold?: string;
  subOrderDrafts?: Record<string, string>;
  subOrderApprovals?: Record<string, string>;
  subOrderCopied?: Record<string, string>;
}

export function orderKey(source: OrderSource): string {
  // Facility/resident/PON are explicit source identifiers, never matched by name.
  return JSON.stringify([source.facility.trim(), source.patientRef.trim(), source.pon.trim()]);
}

export function sourceStamp(order: QueueOrder): string {
  return JSON.stringify([order.id, order.revision, order.drug, order.directions, order.defaultSig ?? '', clinicalMetadataStamp(order.iguana)]);
}

export function saveOrder(orders: QueueOrder[], source: OrderSource, suggestion: string, reviseId?: string): QueueOrder[] {
  if (![source.facility, source.patientRef, source.pon, source.directions].every(v => v.trim())) {
    throw new Error('Facility, patient reference, PON and original directions are required.');
  }
  const cleanSource: OrderSource = {
    facility: source.facility.trim(),
    patientRef: source.patientRef.trim(),
    pon: source.pon.trim(),
    drug: source.drug.trim(),
    directions: source.directions.trim(),
    defaultSig: source.defaultSig?.trim() || undefined,
    iguana: source.iguana,
  };
  const id = orderKey(cleanSource);
  const existing = orders.find(order => order.id === id);
  if (reviseId && (!existing || existing.id !== reviseId)) throw new Error('The selected order no longer matches.');
  if (existing) {
    if (existing.cancelled) throw new Error('Cancelled orders cannot be revised. Add a new order with its new PON.');
    if (!existing.intakeHold && existing.drug === cleanSource.drug && existing.directions === cleanSource.directions && existing.defaultSig === cleanSource.defaultSig && clinicalMetadataStamp(existing.iguana) === clinicalMetadataStamp(cleanSource.iguana)) return orders;
    if (reviseId !== id) throw new Error('This order already exists. Select it and use Revise source.');
    const previous: OrderSource = {
      facility: existing.facility,
      patientRef: existing.patientRef,
      pon: existing.pon,
      drug: existing.drug,
      directions: existing.directions,
      defaultSig: existing.defaultSig,
      iguana: existing.iguana,
    };
    return orders.map(order => order.id === id ? {
      ...cleanSource, id, revision: order.revision + 1, previousSources: [...order.previousSources, previous],
      draft: finalSig(suggestion), cancelled: false,
    } : order);
  }
  return [...orders, { ...cleanSource, id, revision: 1, previousSources: [], draft: finalSig(suggestion), cancelled: false }];
}

export function editDraft(order: QueueOrder, draft: string): QueueOrder {
  return { ...order, draft: draft.toUpperCase(), approved: undefined, copied: undefined };
}

export function cancelOrder(order: QueueOrder): QueueOrder {
  return { ...order, cancelled: true, approved: undefined, copied: undefined };
}
