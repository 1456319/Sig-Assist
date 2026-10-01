import { translateClinicalSig } from './clinical/clinicalEngine';
import { orderKey, saveOrder, type OrderSource, type QueueOrder } from './orderQueue';

// Synthetic directions only. These examples exercise the real translation path.
export const DEMO_ORDERS: OrderSource[] = [
  { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT-01', pon: 'DEMO-001', drug: 'EXAMPLE TAB 10MG', directions: 'Take 1 tablet by mouth twice daily for 7 days.' },
  { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT-02', pon: 'DEMO-002', drug: 'GABAPENTIN TAB 300MG', directions: 'Take 2 tablets by mouth every morning and 1 tablet at bedtime for pain.' },
  { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT-03', pon: 'DEMO-003', drug: 'PREDNISONE TAB 10MG', directions: 'Take 2 tablets daily for 5 days then take 1 tablet twice daily for 4 days then stop.' },
  { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT-04', pon: 'DEMO-004', drug: 'GUAIFENESIN ER TAB 600MG', directions: 'Give 1 tablet by mouth every 12 hours as needed for cough for 7 days.' },
  { facility: 'DEMO-FACILITY', patientRef: 'DEMO-RESIDENT-05', pon: 'DEMO-005', drug: 'METOPROLOL TAB 25MG', directions: 'Take 2 tablets by mouth twice daily\nHold if SBP < 100.' },
];

export function addDemoOrders(orders: QueueOrder[]): QueueOrder[] {
  return DEMO_ORDERS.reduce((current, source) => {
    const id = orderKey(source);
    // Reopening the demo preserves corrections, cancellations and approvals.
    if (current.some(order => order.id === id)) return current;
    const result = translateClinicalSig({ id, pon: source.pon, drugName: source.drug, rawProse: source.directions, sourceFormat: 'manual_text', traceId: `ORD_${id}_R1` });
    return saveOrder(current, source, result.primarySig);
  }, orders);
}
