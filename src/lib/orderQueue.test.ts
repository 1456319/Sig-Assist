import { describe, expect, it } from 'vitest';
import { cancelOrder, editDraft, orderKey, saveOrder, sourceStamp, type OrderSource, type QueueOrder } from './orderQueue';

describe('orderKey', () => {
  it('combines facility, patient reference, and PON', () => {
    const source: OrderSource = {
      facility: 'Fac A',
      patientRef: '123',
      pon: '456',
      drug: 'Drug',
      directions: 'Take 1',
    };
    expect(orderKey(source)).toBe(JSON.stringify(['Fac A', '123', '456']));
  });

  it('trims whitespace', () => {
    const source: OrderSource = {
      facility: '  Fac A  ',
      patientRef: ' 123 ',
      pon: '  456',
      drug: 'Drug',
      directions: 'Take 1',
    };
    expect(orderKey(source)).toBe(JSON.stringify(['Fac A', '123', '456']));
  });

});

describe('saveOrder', () => {
  const baseSource: OrderSource = {
    facility: 'Fac A',
    patientRef: '123',
    pon: '456',
    drug: 'Drug A',
    directions: 'Take 1',
  };

  describe('validation', () => {
    it('throws if facility, patient reference, PON, or original directions are empty', () => {
      const orders: QueueOrder[] = [];

      expect(() => saveOrder(orders, { ...baseSource, facility: '   ' }, 'draft'))
        .toThrow('Facility, patient reference, PON and original directions are required.');

      expect(() => saveOrder(orders, { ...baseSource, patientRef: '' }, 'draft'))
        .toThrow('Facility, patient reference, PON and original directions are required.');

      expect(() => saveOrder(orders, { ...baseSource, pon: ' \t ' }, 'draft'))
        .toThrow('Facility, patient reference, PON and original directions are required.');

      expect(() => saveOrder(orders, { ...baseSource, directions: '' }, 'draft'))
        .toThrow('Facility, patient reference, PON and original directions are required.');
    });
  });

  describe('revision logic', () => {
    it('increments revision and sets previousSources when revised correctly', () => {
      const initialOrder = saveOrder([], baseSource, 'draft 1')[0];

      const revisedSource = { ...baseSource, directions: 'Take 2' };
      const result = saveOrder([initialOrder], revisedSource, 'draft 2', initialOrder.id);

      expect(result).toHaveLength(1);
      const revisedOrder = result[0];

      expect(revisedOrder.revision).toBe(2);
      expect(revisedOrder.directions).toBe('Take 2');
      expect(revisedOrder.draft).toBe('DRAFT 2');
      expect(revisedOrder.previousSources).toHaveLength(1);

      const prev = revisedOrder.previousSources[0];
      expect(prev.directions).toBe('Take 1');
    });

    it('returns the exact same array if no significant changes were made and not on intakeHold', () => {
      const initialOrder = saveOrder([], baseSource, 'draft 1')[0];
      const orders = [initialOrder];

      const result = saveOrder(orders, baseSource, 'some new draft', initialOrder.id);

      expect(result).toBe(orders);
    });

    it('throws if trying to revise a cancelled order', () => {
      const initialOrder = saveOrder([], baseSource, 'draft 1')[0];
      initialOrder.cancelled = true;

      expect(() => saveOrder([initialOrder], { ...baseSource, directions: 'new dir' }, 'draft', initialOrder.id))
        .toThrow('Cancelled orders cannot be revised. Add a new order with its new PON.');
    });

    it('throws if reviseId is provided but no matching order exists', () => {
      const orders: QueueOrder[] = [];
      expect(() => saveOrder(orders, baseSource, 'draft', 'non-existent-id'))
        .toThrow('The selected order no longer matches.');
    });

    it('throws if reviseId is provided but differs from the actual matched order id', () => {
      const initialOrder = saveOrder([], baseSource, 'draft 1')[0];

      expect(() => saveOrder([initialOrder], baseSource, 'draft', 'wrong-id'))
        .toThrow('The selected order no longer matches.');
    });

    it('throws if an order exists but reviseId is NOT provided (duplicate)', () => {
      const initialOrder = saveOrder([], baseSource, 'draft 1')[0];

      expect(() => saveOrder([initialOrder], { ...baseSource, directions: 'changed dir' }, 'draft'))
        .toThrow('This order already exists. Select it and use Revise source.');
    });
  });

  describe('new order creation', () => {
    it('creates a new order in the queue with revision 1, empty previousSources, and mapped draft', () => {
      const orders: QueueOrder[] = [];
      const source: OrderSource = {
        facility: '  Fac A ',
        patientRef: ' 123 ',
        pon: ' 456 ',
        drug: ' Drug A ',
        directions: ' Take 1 ',
      };
      const result = saveOrder(orders, source, ' tk 1 po qd ');

      expect(result).toHaveLength(1);
      const newOrder = result[0];

      expect(newOrder.facility).toBe('Fac A');
      expect(newOrder.patientRef).toBe('123');
      expect(newOrder.pon).toBe('456');
      expect(newOrder.drug).toBe('Drug A');
      expect(newOrder.directions).toBe('Take 1');
      expect(newOrder.id).toBe(orderKey(newOrder));
      expect(newOrder.revision).toBe(1);
      expect(newOrder.previousSources).toEqual([]);
      expect(newOrder.draft).toBe('TK 1 PO QD');
      expect(newOrder.cancelled).toBe(false);
    });
  });
});

describe('editDraft', () => {
  it('updates the draft to uppercase and clears approved/copied status', () => {
    const order: QueueOrder = {
      id: 'test-id',
      revision: 1,
      facility: 'Fac',
      patientRef: '123',
      pon: '456',
      drug: 'Drug',
      directions: 'Take 1',
      draft: 'old draft',
      approved: 'approved-stamp',
      copied: 'copied-stamp',
      cancelled: false,
      previousSources: [],
    };

    const edited = editDraft(order, 'new draft');
    expect(edited.draft).toBe('NEW DRAFT');
    expect(edited.approved).toBeUndefined();
    expect(edited.copied).toBeUndefined();
    expect(edited.cancelled).toBe(false);
  });
});

describe('cancelOrder', () => {
  it('sets cancelled to true and clears approved/copied status', () => {
    const order: QueueOrder = {
      id: 'test-id',
      revision: 1,
      facility: 'Fac',
      patientRef: '123',
      pon: '456',
      drug: 'Drug',
      directions: 'Take 1',
      draft: 'DRAFT',
      approved: 'approved-stamp',
      copied: 'copied-stamp',
      cancelled: false,
      previousSources: [],
    };

    const cancelled = cancelOrder(order);
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.approved).toBeUndefined();
    expect(cancelled.copied).toBeUndefined();
    expect(cancelled.draft).toBe('DRAFT');
  });
});

describe('sourceStamp', () => {
  it('combines id, revision, drug, directions, defaultSig, and iguana metadata', () => {
    const order: QueueOrder = {
      id: 'test-id',
      revision: 2,
      facility: 'Fac A',
      patientRef: '123',
      pon: '456',
      drug: 'Drug A',
      directions: 'Take 1',
      defaultSig: 'TK 1',
      draft: 'TK 1',
      cancelled: false,
      previousSources: [],
    };
    expect(sourceStamp(order)).toBe(JSON.stringify(['test-id', 2, 'Drug A', 'Take 1', 'TK 1', '']));
  });
});
