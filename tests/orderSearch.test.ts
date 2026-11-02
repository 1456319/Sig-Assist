import { expect, test, describe } from 'vitest';
import { matchesOrderQuery } from '../src/lib/orderSearch';
import type { OrderSource } from '../src/lib/orderQueue';

describe('matchesOrderQuery', () => {
  const sampleOrder: OrderSource = {
    pon: 'PON12345',
    facility: 'Mercy Hospital',
    patientRef: 'PAT-987',
    drug: 'Aspirin 81mg',
    directions: 'Take 1 tablet daily',
  };

  test('matches empty query', () => {
    expect(matchesOrderQuery(sampleOrder, '')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '   ')).toBe(true);
  });

  test('matches exact field values (case insensitive)', () => {
    expect(matchesOrderQuery(sampleOrder, 'pon12345')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'MERCY HOSPITAL')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'pat-987')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Aspirin 81mg')).toBe(true);
  });

  test('matches partial substrings', () => {
    expect(matchesOrderQuery(sampleOrder, '1234')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, 'Mercy')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '987')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, '81mg')).toBe(true);
  });

  test('matches with leading/trailing spaces in query', () => {
    expect(matchesOrderQuery(sampleOrder, '  PON12345  ')).toBe(true);
    expect(matchesOrderQuery(sampleOrder, ' mercy  ')).toBe(true);
  });

  test('does not match non-existent values', () => {
    expect(matchesOrderQuery(sampleOrder, 'Tylenol')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'PON999')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'General Hospital')).toBe(false);
  });

  test('does not match on unsearched fields like directions', () => {
    expect(matchesOrderQuery(sampleOrder, 'tablet')).toBe(false);
    expect(matchesOrderQuery(sampleOrder, 'Take 1')).toBe(false);
  });
});
