import type { OrderSource } from './orderQueue';

/** One search box can narrow saved orders or supply the Iguana text filter. */
export function matchesOrderQuery(order: OrderSource, query: string): boolean {
  const text = query.trim().toLowerCase();
  return !text || [order.pon, order.facility, order.patientRef, order.drug].some(value => value.toLowerCase().includes(text));
}
