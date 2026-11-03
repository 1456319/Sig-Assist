import { describe, it, expect } from 'vitest';
import { resolveIndicationToken } from './indicationEngine';

describe('resolveIndicationToken', () => {
  it('returns undefined for undefined or empty input', () => {
    expect(resolveIndicationToken()).toBeUndefined();
    expect(resolveIndicationToken('')).toBeUndefined();
    expect(resolveIndicationToken('   ')).toBeUndefined();
  });

  it('maps direct dictionary matches', () => {
    expect(resolveIndicationToken('GERD')).toBe('FGERD');
    expect(resolveIndicationToken('SUPPLEMENT')).toBe('FSU');
    expect(resolveIndicationToken('PAIN')).toBe('FPAIN');
  });

  it('handles case insensitivity and whitespace', () => {
    expect(resolveIndicationToken(' gerd ')).toBe('FGERD');
    expect(resolveIndicationToken('Type 2 Diabetes')).toBe('FDM2');
  });

  it('removes FOR and RELATED TO prefixes', () => {
    expect(resolveIndicationToken('FOR PAIN')).toBe('FPAIN');
    expect(resolveIndicationToken('FOR INDICATIONS OF PAIN')).toBe('FPAIN');
    expect(resolveIndicationToken('RELATED TO GERD')).toBe('FGERD');
  });

  it('removes diagnosis codes (ICD-10)', () => {
    expect(resolveIndicationToken('PAIN (ICD10 E11.9)')).toBe('FPAIN');
    expect(resolveIndicationToken('GERD (ICD-10-CM CODE K21.9)')).toBe('FGERD');
    expect(resolveIndicationToken('COUGH E11.9')).toBe('FCOU');
  });

  it('handles specific text replacements', () => {
    expect(resolveIndicationToken('PAIN FOR JOINT PAIN')).toBe('FOR JOINT PAIN');
    expect(resolveIndicationToken('HEART HEALTHY')).toBe('FOR HEART HEALTH');
  });

  it('maps compound matches and parses combinations', () => {
    expect(resolveIndicationToken('NAUSEA AND VOMITING')).toBe('FNV');
    expect(resolveIndicationToken('GERD AND PAIN')).toBe('FGERD AND FPAIN');
    expect(resolveIndicationToken('PAIN OR COUGH')).toBe('FPAIN OR FCOU');
  });

  it('provides a fallback FOR format if not found in map', () => {
    expect(resolveIndicationToken('HEADACHE')).toBe('FHA');
    expect(resolveIndicationToken('SORETHROAT')).toBe('FOR SORE THROAT');
  });

  it('handles multi-clause combinations properly', () => {
    expect(resolveIndicationToken('HEADACHE AND PAIN')).toBe('FHA AND FPAIN');
    expect(resolveIndicationToken('PAIN AND SORETHROAT')).toBe('FPAIN AND FOR SORE THROAT');
  });

  it('removes trailing punctuation', () => {
    expect(resolveIndicationToken('GERD.')).toBe('FGERD');
    expect(resolveIndicationToken('PAIN;')).toBe('FPAIN');
    expect(resolveIndicationToken('COUGH,')).toBe('FCOU');
  });

  it('returns exact match if the input matches a map value directly', () => {
    expect(resolveIndicationToken('FGERD')).toBe('FGERD');
    expect(resolveIndicationToken('FPAIN')).toBe('FPAIN');
  });
});
