import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchAllSigEntries,
  upsertSigEntry,
  deleteSigEntry,
  bulkImportSigEntries,
} from '../src/lib/sigDictionaryService';
import {
  fetchAllTechRules,
  upsertTechRule,
  deleteTechRule,
  reorderTechRules,
  toggleTechRule,
} from '../src/lib/techRulesService';
import {
  fetchAllExpansions,
  upsertExpansion,
  deleteExpansion,
  toggleExpansion,
  reorderExpansions,
} from '../src/lib/sigExpansionService';

describe('Offline Services Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('sigDictionaryService (offline)', () => {
    it('saves, retrieves, updates, and deletes dictionary entries locally', async () => {
      expect(await fetchAllSigEntries()).toEqual([]);

      await upsertSigEntry({
        sig_code: 'bid',
        translation: 'Twice daily',
        status: 'ACTIVE',
        redirect_codes: [],
        is_high_risk: false,
        high_risk_warning: '',
      });

      const entries = await fetchAllSigEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].sig_code).toBe('BID');
      expect(entries[0].translation).toBe('Twice daily');

      // Update existing entry
      await upsertSigEntry({
        sig_code: 'BID',
        translation: 'Take twice every day',
        status: 'ACTIVE',
        redirect_codes: ['2X/DAY'],
        is_high_risk: true,
        high_risk_warning: 'Check schedule',
      });

      const updated = await fetchAllSigEntries();
      expect(updated).toHaveLength(1);
      expect(updated[0].translation).toBe('Take twice every day');
      expect(updated[0].is_high_risk).toBe(true);

      // Delete entry
      await deleteSigEntry(updated[0].id);
      expect(await fetchAllSigEntries()).toHaveLength(0);
    });

    it('bulk imports multiple entries locally', async () => {
      const count = await bulkImportSigEntries([
        {
          sig_code: 'qam',
          translation: 'Every morning',
          status: 'ACTIVE',
          redirect_codes: [],
          is_high_risk: false,
          high_risk_warning: '',
        },
        {
          sig_code: 'qpm',
          translation: 'Every evening',
          status: 'ACTIVE',
          redirect_codes: [],
          is_high_risk: false,
          high_risk_warning: '',
        },
      ]);
      expect(count).toBe(2);

      const entries = await fetchAllSigEntries();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.sig_code)).toEqual(['QAM', 'QPM']);
    });
  });

  describe('techRulesService (offline)', () => {
    it('creates, updates, toggles, reorders, and deletes tech rules locally', async () => {
      expect(await fetchAllTechRules()).toEqual([]);

      await upsertTechRule({
        name: 'Replace PO with ORAL',
        target_type: 'exact',
        match_values: ['PO'],
        action_type: 'replace',
        output_value: 'ORAL',
        priority: 1,
        enabled: true,
      });

      await upsertTechRule({
        name: 'Append With Water',
        target_type: 'ends_with',
        match_values: ['QD'],
        action_type: 'append',
        output_value: 'WITH WATER',
        priority: 2,
        enabled: true,
      });

      let rules = await fetchAllTechRules();
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('Replace PO with ORAL');
      expect(rules[1].name).toBe('Append With Water');

      // Toggle rule enabled state
      await toggleTechRule(rules[0].id, false);
      rules = await fetchAllTechRules();
      expect(rules[0].enabled).toBe(false);

      // Reorder rules
      await reorderTechRules([rules[1].id, rules[0].id]);
      rules = await fetchAllTechRules();
      expect(rules[0].name).toBe('Append With Water');
      expect(rules[1].name).toBe('Replace PO with ORAL');

      // Delete rule
      await deleteTechRule(rules[0].id);
      rules = await fetchAllTechRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('Replace PO with ORAL');
    });
  });

  describe('sigExpansionService (offline)', () => {
    it('creates, updates, toggles, reorders, and deletes phrase expansions locally', async () => {
      expect(await fetchAllExpansions()).toEqual([]);

      await upsertExpansion({
        output_phrase: 'for generalized anxiety disorder',
        aliases: ['gad', 'fgad', 'gen anx dis'],
        match_type: 'phrase',
        enabled: true,
        priority: 1,
      });

      let expansions = await fetchAllExpansions();
      expect(expansions).toHaveLength(1);
      expect(expansions[0].output_phrase).toBe('FOR GENERALIZED ANXIETY DISORDER');
      expect(expansions[0].aliases).toEqual(['GAD', 'FGAD', 'GEN ANX DIS']);

      // Toggle expansion
      await toggleExpansion(expansions[0].id, false);
      expansions = await fetchAllExpansions();
      expect(expansions[0].enabled).toBe(false);

      // Add second expansion and reorder
      await upsertExpansion({
        output_phrase: 'for major depressive disorder',
        aliases: ['mdd', 'fmdd'],
        match_type: 'phrase',
        enabled: true,
        priority: 2,
      });

      expansions = await fetchAllExpansions();
      expect(expansions).toHaveLength(2);

      await reorderExpansions([expansions[1].id, expansions[0].id]);
      expansions = await fetchAllExpansions();
      expect(expansions[0].output_phrase).toBe('FOR MAJOR DEPRESSIVE DISORDER');

      // Delete expansion
      await deleteExpansion(expansions[0].id);
      expansions = await fetchAllExpansions();
      expect(expansions).toHaveLength(1);
      expect(expansions[0].output_phrase).toBe('FOR GENERALIZED ANXIETY DISORDER');
    });
  });
});
