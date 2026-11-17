import { describe, expect, it } from 'vitest';
import { parseSigOrder } from '../src/lib/sigEngine';

describe('classic dose numeric boundaries', () => {
  const drug = 'Synthetic tablet 10 MG';
  it('preserves fractional and decimal tablet quantities', () => {
    for (const quantity of ['1/2', '0.5']) {
      expect(parseSigOrder(`Take ${quantity} tablet by mouth daily`, { drug }).dose?.quantity).toBe(0.5);
    }
  });
  it('does not interpret a fraction with a zero denominator as its denominator', () => {
    expect(parseSigOrder('Take 1/0 tablet by mouth daily', { drug }).dose).toBeUndefined();
    expect(parseSigOrder('Take 0/0 tablet by mouth daily', { drug }).dose).toBeUndefined();
  });
  it('does not retry a long invalid numeric run at every digit', () => {
    const start = performance.now();
    expect(parseSigOrder(`${'9'.repeat(16000)} unknown`, { drug }).dose).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(250);
    expect(parseSigOrder(`${'9'.repeat(16000)} tablets`, { drug }).dose).toBeUndefined();
  });
});
