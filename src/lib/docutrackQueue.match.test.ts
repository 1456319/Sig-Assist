import { describe, expect, it } from 'vitest';
import { edcMatch, type EdcDocument } from './docutrackQueue';

const doc = (facility: string, pon = 'TEST-PON-001'): EdcDocument => ({
  pon, facility, resident: 'SYNTHETIC RESIDENT',
  documentNumber: '123456', numberSource: 'grid', route: 'Process',
});
const order = (facility: string, pon = 'TEST-PON-001') => ({
  pon, facility, patientRef: 'TEST-PATIENT',
});

describe('E-DC identity matching', () => {
  it('does not assert a unique match without a known facility', () => {
    expect(edcMatch([doc('TESTA')], { pon: 'TEST-PON-001' }, [order('TESTA')])?.unique).toBe(false);
    expect(edcMatch([doc('')], order('TESTA'), [order('TESTA')])?.unique).toBe(false);
    expect(edcMatch([doc('TESTA')], order(''), [order('TESTA')])?.unique).toBe(false);
  });
  it('uses the same exact PON and facility on both sources', () => {
    const match = edcMatch([doc('TESTA')], order('testa'), [order('TESTA')]);
    expect(match?.unique).toBe(true);
    expect(match?.candidates).toHaveLength(1);
  });
  it('does not confuse matching PONs from different facilities', () => {
    const match = edcMatch([doc('TESTA'), doc('TESTB')], order('TESTA'), [order('TESTA')]);
    expect(match?.unique).toBe(true);
    expect(match?.candidates[0].facility).toBe('TESTA');
  });
  it('stays ambiguous when there are two candidates in the same facility', () => {
    expect(edcMatch([doc('TESTA'), doc('TESTA')], order('TESTA'), [order('TESTA')])?.unique).toBe(false);
  });
  it('stays ambiguous if the same facility has two known queue orders', () => {
    expect(edcMatch([doc('TESTA')], order('TESTA'), [order('TESTA'), order('TESTA')])?.unique).toBe(false);
  });
  it('does not match PON substrings or strip colon suffixes', () => {
    expect(edcMatch([doc('TESTA', '12345:AAA')], order('TESTA', '12345'), [order('TESTA', '12345')])).toBeUndefined();
    expect(edcMatch([doc('TESTA', '000123:AAA')], order('TESTA', '000123:AAA'), [order('TESTA', '000123:AAA')])?.unique).toBe(true);
  });
});
