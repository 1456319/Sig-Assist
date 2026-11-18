import { describe, expect, it } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { translateFreeTextSig } from '../src/lib/sigEngine';

const clinical = (drugName: string, rawProse: string) => translateClinicalSig({ id: 'synthetic-then-prn', pon: 'SYNTHETIC', drugName, rawProse, sourceFormat: 'manual_text' });

describe('a routine course followed by an as-needed phase', () => {
  it('keeps the first course routine and the later PRN phase in source order', () => {
    const result = clinical('Synthetic tablet', 'Take 1 tablet by mouth twice daily, for 10 days then as needed for pain.');
    expect(result.primarySig).toBe('1T PO BID X10D. THEN AS NEEDED FOR PAIN.');
    expect(result.abnormalities.some(a => a.id === 'retained_supplemental_instructions')).toBe(true);
  });

  it('does not turn a topical routine course into PRN from its first day', () => {
    const result = clinical('NYSTATIN CREAM', 'Apply to groin topically two times a day for 10 days, then as needed for redness.');
    expect(result.primarySig).toBe('AP TPCL TO GROIN BID X10D. THEN AS NEEDED FOR REDNESS.');
    expect(result.abnormalities.some(a => a.id === 'retained_supplemental_instructions')).toBe(true);
  });

  it('preserves the phase transition in the classic entry point', () => {
    expect(translateFreeTextSig('Take 1 tablet by mouth twice daily for 10 days then PRN for pain.', { drug: 'Synthetic tablet' }).sig)
      .toBe('1T PO BID X10D. THEN PRN FOR PAIN');
  });

  it('leaves an ordinary PRN schedule unchanged', () => {
    expect(clinical('Synthetic tablet', 'Take 1 tablet by mouth twice daily as needed for pain for 10 days.').primarySig)
      .toBe('1T PO BID PRN FPAIN X10D');
  });
});
