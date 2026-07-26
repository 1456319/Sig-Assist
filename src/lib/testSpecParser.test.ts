import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSigTestSpec } from './testSpecParser';

describe('TESTS.txt migration inventory', () => {
  const source = readFileSync(resolve(process.cwd(), 'TESTS.txt'), 'utf8');
  const cases = parseSigTestSpec(source);

  it('imports the supplied non-treatment regression cases', () => {
    expect(cases.filter((item) => !item.treatment).length).toBeGreaterThanOrEqual(36);
  });

  it('retains a drug, user entry, and expected output for each runnable case', () => {
    for (const item of cases.filter((caseItem) => !caseItem.treatment)) {
      expect(item.drug, `case ${item.id}`).not.toBe('');
      expect(item.userEntry, `case ${item.id}`).not.toBe('');
      expect(item.expected, `case ${item.id}`).not.toHaveLength(0);
    }
  });
});
