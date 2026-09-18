import { describe, expect, it } from 'vitest';
import { calculateDoseAndVolume } from '../src/lib/clinical/doseCalculator';

describe('doseCalculator', () => {
  it('formats standard whole tablets without parentheticals', () => {
    const res = calculateDoseAndVolume('PROTONIX 40MG TABLET', 'Give 1 tablet by mouth one time a day');
    expect(res.doseToken).toBe('1T');
    expect(res.routeToken).toBe('PO');
  });

  it('formats single-ingredient half tablet with parenthetical target dose', () => {
    const res = calculateDoseAndVolume('LEVOTHYROXINE TAB 25MCG', 'Give 0.5 tablet by mouth one time a day');
    expect(res.doseToken).toBe('1/2T (12.5MCG)');
    expect(res.routeToken).toBe('PO');
  });

  it('formats multiple capsules with target dose', () => {
    const res = calculateDoseAndVolume('TAMSULOSIN CAP 0.4MG', 'Give 2 capsule by mouth at bedtime');
    expect(res.doseToken).toBe('2C (0.8MG)');
    expect(res.routeToken).toBe('PO');
  });

  it('formats injectables with volume preceding target dose', () => {
    const res = calculateDoseAndVolume('TRULICITY INJ 4.5MG/0.5ML', 'Inject 4.5 mg subcutaneously in the evening');
    expect(res.doseToken).toBe('INJ 0.5ML (4.5MG)');
    expect(res.routeToken).toBe('SQ');
  });

  it('formats liquid oral administration with dose calculation', () => {
    const res = calculateDoseAndVolume('SENNA SYR 8.8MG/5ML', 'Give 10 ml by mouth at bedtime');
    expect(res.doseToken).toBe('ADM 10ML (17.6MG)');
    expect(res.routeToken).toBe('PO');
  });

  it('converts inhaler dry powder capsule prose into puff (1P) with Applied Correction', () => {
    const res = calculateDoseAndVolume('ADVAIR DISKUS 250/50', 'Take 1 capsule by mouth twice daily');
    expect(res.doseToken).toBe('1P');
    expect(res.abnormalities.some(a => a.tier === 'applied_correction' && a.title.includes('Inhaler'))).toBe(true);
  });

  it('detects APAP and applies 3GM or 3GME warning', () => {
    const standard = calculateDoseAndVolume('OXYCODONE-APAP 5-325', 'Give 1 tablet PO Q6H PRN');
    expect(standard.isApap).toBe(true);
    expect(standard.apapLimitToken).toBe('3GM');

    const maxExceed = calculateDoseAndVolume('ACETAMINOPHEN TAB 325MG', 'Give 2 tablet PO Q4H do not exceed 3g per day');
    expect(maxExceed.apapLimitToken).toBe('3GME');
  });

  it('handles Diclofenac Gel 1% upper vs lower body and emits AP4GM without space', () => {
    const upper = calculateDoseAndVolume('DICLOFENAC GEL 1%', 'Apply to shoulder topically four times a day');
    expect(upper.doseToken).toBe('AP 2GM');
    expect(upper.routeToken).toBe('TPCL');

    const lower = calculateDoseAndVolume('DICLOFENAC GEL 1%', 'Apply to legs topically one time a day');
    expect(lower.doseToken).toBe('AP4GM');
  });

  it('maps morphine concentrate 20mg/ml 0.5ml to bracketed [ROX10MG]', () => {
    const res = calculateDoseAndVolume('MORPHINE CONC 20MG/ML', 'Give 0.5 milliliter by mouth every 6 hours');
    expect(res.doseToken).toBe('[ROX10MG]');
    expect(res.routeToken).toBe('PO');
  });
});
