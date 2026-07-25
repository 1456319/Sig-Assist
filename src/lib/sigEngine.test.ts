import { describe, expect, it } from 'vitest';
import { translateFreeTextSig } from './sigEngine';

describe('structured SIG engine', () => {
  it('calculates a volume from a concentration', () => {
    expect(translateFreeTextSig('Inject 1.8 mg subcutaneously one time a day for type 2 diabetes', { drug: 'LIRAGLUTIDE INJ 18MG/3ML' }).sig).toBe('INJ 0.3ML (1.8MG) SQ QD FDM2');
  });
  it('keeps PRN indication before duration', () => {
    expect(translateFreeTextSig('Give 10 ml by mouth every 6 hours as needed for cough for 14 Days', { drug: 'GUAIASORB DM S/F LQ 100-10/5ML' }).sig).toBe('ADM 10ML PO Q6H PRN FCOU X14D');
  });
  it('sorts scales and blocks coverage gaps', () => {
    const result = translateFreeTextSig('Inject as per sliding scale: if 181 - 250 = 2 units; 251 - 300 = 4 units; 351 - 400 = 8 units > 400 = 10 units, subcutaneously before meals for DM', { drug: 'NOVOLOG INJ 100U/ML' });
    expect(result.sig).toContain('CBS AC SS 181-250=2U;251-300=4U;351-400=8U;>400=10U');
    expect(result.order.issues).toContainEqual(expect.objectContaining({ code: 'sliding-scale-gap', severity: 'blocking' }));
  });
  it('strips cut dates but reports them', () => {
    const result = translateFreeTextSig('Give 1 tablet by mouth every 12 hours for cellulitis until 07/30/2026 20:59', { drug: 'CEPHALEXIN TAB 500MG' });
    expect(result.sig).toBe('1T PO Q12H FCEL');
    expect(result.order.issues).toContainEqual(expect.objectContaining({ code: 'cut-date' }));
  });
});
