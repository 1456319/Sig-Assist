import { describe, it, expect } from 'vitest';
import { applyTechRules } from './parser';
import { TechRule } from './types';

describe('applyTechRules', () => {
  const baseRule: TechRule = {
    id: '1',
    name: 'Test Rule',
    target_type: 'contains',
    match_values: ['test'],
    action_type: 'replace',
    output_value: 'replacement',
    priority: 10,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('ignores disabled rules', () => {
    const rules: TechRule[] = [
      { ...baseRule, enabled: false }
    ];
    const { output, applied } = applyTechRules('this is a test', rules);
    expect(output).toBe('this is a test');
    expect(applied).toHaveLength(0);
  });

  it('applies rules in priority order (lower first)', () => {
    const rules: TechRule[] = [
      {
        ...baseRule,
        id: '2',
        priority: 20, // Executed second
        match_values: ['second'],
        action_type: 'replace',
        output_value: 'third'
      },
      {
        ...baseRule,
        id: '1',
        priority: 10, // Executed first
        match_values: ['first'],
        action_type: 'replace',
        output_value: 'second'
      }
    ];

    const { output, applied } = applyTechRules('this is first', rules);

    // "first" -> "second", then "second" -> "third"
    expect(output).toBe('this is third');
    expect(applied).toHaveLength(2);
    expect(applied[0]).toContain('Rule #10');
    expect(applied[1]).toContain('Rule #20');
  });

  describe('match target types', () => {
    it('matches contains', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'contains', match_values: ['apple'] }
      ];
      expect(applyTechRules('an apple a day', rules).output).toBe('an replacement a day');
      expect(applyTechRules('banana', rules).output).toBe('banana');
    });

    it('matches starts_with', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'starts_with', match_values: ['apple'] }
      ];
      expect(applyTechRules('apple pie', rules).output).toBe('replacement pie');
      expect(applyTechRules('an apple', rules).output).toBe('an apple');
    });

    it('matches ends_with', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'ends_with', match_values: ['pie'] }
      ];
      expect(applyTechRules('apple pie', rules).output).toBe('apple replacement');
      expect(applyTechRules('pie crust', rules).output).toBe('pie crust');
    });

    it('matches exact', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'exact', match_values: ['apple pie'] }
      ];
      expect(applyTechRules('apple pie', rules).output).toBe('replacement');
      expect(applyTechRules('an apple pie', rules).output).toBe('an apple pie');
      expect(applyTechRules('apple pies', rules).output).toBe('apple pies');
    });

    it('matches regex', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'regex', match_values: ['\\b(apple|banana)\\b'] }
      ];
      expect(applyTechRules('eat an apple now', rules).output).toBe('eat an replacement now');
      expect(applyTechRules('eat a banana now', rules).output).toBe('eat a replacement now');
      expect(applyTechRules('eat an applesauce now', rules).output).toBe('eat an applesauce now');
    });

    it('handles invalid regex gracefully', () => {
      const rules: TechRule[] = [
        { ...baseRule, target_type: 'regex', match_values: ['['] }
      ];
      // Should not throw, should just not match
      expect(() => applyTechRules('test', rules)).not.toThrow();
      expect(applyTechRules('test', rules).output).toBe('test');
    });
  });

  describe('action types', () => {
    it('handles replace action', () => {
      const rules: TechRule[] = [
        { ...baseRule, action_type: 'replace', match_values: ['foo'], output_value: 'bar' }
      ];
      expect(applyTechRules('foo foo', rules).output).toBe('bar bar');
      expect(applyTechRules('FOO foo', rules).output).toBe('bar bar'); // Case insensitive replacement
    });

    it('handles append action', () => {
      const rules: TechRule[] = [
        { ...baseRule, action_type: 'append', match_values: ['foo'], output_value: 'bar' }
      ];
      expect(applyTechRules('foo', rules).output).toBe('foo bar');
    });

    it('handles prepend action', () => {
      const rules: TechRule[] = [
        { ...baseRule, action_type: 'prepend', match_values: ['foo'], output_value: 'bar' }
      ];
      expect(applyTechRules('foo', rules).output).toBe('bar foo');
    });
  });

  it('normalizes spaces in replace action', () => {
    const rules: TechRule[] = [
      { ...baseRule, action_type: 'replace', match_values: ['removeme'], output_value: '' }
    ];
    // Original: "word removeme word" -> naive replace: "word  word" -> space normalized: "word word"
    expect(applyTechRules('word removeme word', rules).output).toBe('word word');
  });

  it('handles multiple matching rules in a chain', () => {
    const rules: TechRule[] = [
      { ...baseRule, id: '1', priority: 1, match_values: ['a'], output_value: 'b' },
      { ...baseRule, id: '2', priority: 2, match_values: ['b'], output_value: 'c' },
      { ...baseRule, id: '3', priority: 3, match_values: ['c'], output_value: 'd' }
    ];
    // 'a' gets replaced to 'b', then 'b' to 'c', then 'c' to 'd'
    const { output, applied } = applyTechRules('a', rules);
    expect(output).toBe('d');
    expect(applied).toHaveLength(3);
  });
});
