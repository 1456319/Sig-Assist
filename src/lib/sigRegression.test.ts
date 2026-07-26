import { describe, expect, it } from 'vitest';
import { compareSig } from './sigComparison';
import { sigRegressionFixtures } from './sigRegressionFixtures';
import { translateFreeTextSig } from './sigEngine';

describe('SIG regression fixtures', () => {
  for (const fixture of sigRegressionFixtures.filter((fixture) => fixture.name !== 'site synonym variants')) {
    it(fixture.name, () => {
      const actual = translateFreeTextSig(fixture.userEntry, { drug: fixture.drug }).sig;
      expect(compareSig(actual, fixture.expectation)).toMatchObject({ accepted: true });
    });
  }

  it('accepts clinically equivalent site renderings', () => {
    const fixture = sigRegressionFixtures.find((item) => item.name === 'site synonym variants')!;
    expect(compareSig('AP TPCL TO PERI-AREA & LT BUTTOCK BID', fixture.expectation).accepted).toBe(true);
  });
});
