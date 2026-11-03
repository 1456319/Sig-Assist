import { describe, it, expect } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { applyOutputCodePolicy } from '../src/lib/clinical/outputCodePolicy';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';

describe('Issue #39: SIG Codes like "PC", Meal Timing, Duplicates & Fallbacks', () => {
  describe('Meal and Timing SIG Code Resolution', () => {
    it('translates three times a day after meals to PC', () => {
      const res = resolveFrequencyAndSchedule('Take 1 tablet by mouth three times a day after meals for pain');
      expect(res.frequencyToken).toBe('PC');

      const inbound = {
        id: 'pc_1',
        pon: 'pc_1',
        drugName: 'Ibuprofen 600 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth three times a day after meals for pain',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO PC FPAIN');
    });

    it('translates standalone after meals to PC', () => {
      const inbound = {
        id: 'pc_2',
        pon: 'pc_2',
        drugName: 'Ibuprofen 600 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth after meals for pain',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO PC FPAIN');
    });

    it('translates after each meal to PC', () => {
      const inbound = {
        id: 'pc_3',
        pon: 'pc_3',
        drugName: 'Ibuprofen 600 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth after each meal for pain',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO PC FPAIN');
    });

    it('translates four times a day after meals and at bedtime to PCHS', () => {
      const res = resolveFrequencyAndSchedule('Take 1 tablet by mouth 4 times a day after meals and at bedtime for pain');
      expect(res.frequencyToken).toBe('PCHS');

      const inbound = {
        id: 'pchs_1',
        pon: 'pchs_1',
        drugName: 'Ibuprofen 600 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth four times a day after meals and at bedtime for pain',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO PCHS FPAIN');
    });

    it('translates before meals and at bedtime to ACHS', () => {
      const inbound = {
        id: 'achs_1',
        pon: 'achs_1',
        drugName: 'Ibuprofen 600 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth four times a day before meals and at bedtime for pain',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO ACHS FPAIN');
    });

    it('translates with meals and at bedtime to WMHS', () => {
      const inbound = {
        id: 'wmhs_1',
        pon: 'wmhs_1',
        drugName: 'Metformin HCl 500 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth four times a day with meals and at bedtime for DM2',
        sourceFormat: 'manual_text' as const,
      };
      expect(translateClinicalSig(inbound).primarySig).toBe('1T PO WMHS FDM2');
    });

    it('translates daily/BID/TID with meals to WMQD, WMBID, WMTID', () => {
      const qd = translateClinicalSig({
        id: 'wm_qd',
        pon: 'wm_qd',
        drugName: 'Metformin HCl 500 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth once a day with meals for DM2',
        sourceFormat: 'manual_text',
      });
      expect(qd.primarySig).toBe('1T PO WMQD FDM2');

      const bid = translateClinicalSig({
        id: 'wm_bid',
        pon: 'wm_bid',
        drugName: 'Metformin HCl 500 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth twice a day with meals for DM2',
        sourceFormat: 'manual_text',
      });
      expect(bid.primarySig).toBe('1T PO WMBID FDM2');

      const tid = translateClinicalSig({
        id: 'wm_tid',
        pon: 'wm_tid',
        drugName: 'Metformin HCl 500 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth three times a day with meals for DM2',
        sourceFormat: 'manual_text',
      });
      expect(tid.primarySig).toBe('1T PO WMTID FDM2');
    });
  });

  describe('Duplicate SIG Code Fallback Logic', () => {
    it('defaults to the first valid matching SIG code', () => {
      const inbound = {
        id: 'dup_default',
        pon: 'dup_default',
        drugName: 'Metformin HCl 500 mg Oral Tablet',
        rawProse: 'Take 1 tablet by mouth before meals for DM2',
        sourceFormat: 'manual_text' as const,
      };
      // Default matching code is TIDAC (or AC)
      const res = translateClinicalSig(inbound);
      expect(['1T PO TIDAC FDM2', '1T PO AC FDM2']).toContain(res.primarySig);
    });

    it('falls back to the next available unblacklisted code when primary is excluded', () => {
      const policy1 = applyOutputCodePolicy('1T PO AC', [{ kind: 'code', value: 'AC' }]);
      expect(policy1.sig).toBe('1T PO TIDAC');
      expect(policy1.changes).toContain('AC → TIDAC');

      const policy2 = applyOutputCodePolicy('AP TPCL TO AFFECTED AREA QS', [{ kind: 'code', value: 'QS' }]);
      expect(policy2.sig).toBe('AP TPCL TO AFFECTED AREA QSD');

      const policy3 = applyOutputCodePolicy('1T PO QOD', [{ kind: 'code', value: 'QOD' }]);
      expect(policy3.sig).toBe('1T PO CQOD');

      const policy4 = applyOutputCodePolicy('1T PO PRN FPAIN', [{ kind: 'code', value: 'PRN' }]);
      expect(policy4.sig).toBe('1T PO ASN FPAIN');
    });

    it('falls back to printing the direction verbatim when all duplicate codes are blacklisted', () => {
      // Both AC and TIDAC are excluded
      const policy = applyOutputCodePolicy('1T PO AC', [
        { kind: 'code', value: 'AC' },
        { kind: 'code', value: 'TIDAC' },
      ]);
      expect(policy.sig).toBe('1T PO THREE TIMES A DAY BEFORE MEALS');
      expect(policy.changes.some(c => c.includes('THREE TIMES A DAY BEFORE MEALS'))).toBe(true);

      // PC has no duplicates; excluding PC falls back to verbatim direction
      const policyPc = applyOutputCodePolicy('1T PO PC', [
        { kind: 'code', value: 'PC' },
      ]);
      expect(policyPc.sig).toBe('1T PO THREE TIMES A DAY AFTER MEALS');

      // All QS codes excluded
      const policyQs = applyOutputCodePolicy('AP TPCL TO AFFECTED AREA QS', [
        { kind: 'code', value: 'QS' },
        { kind: 'code', value: 'QSD' },
        { kind: 'code', value: 'QSHIFT' },
        { kind: 'code', value: 'TXQS' },
      ]);
      expect(policyQs.sig).toBe('AP TPCL TO AFFECTED AREA EVERY SHIFT');
    });
  });

  describe('Never Use This SIG (Complete SIG Exclusions)', () => {
    it('uses the next available duplicate code when technician selects Never Use This SIG', () => {
      const policy = applyOutputCodePolicy('1T PO AC', [
        { kind: 'sig', value: '1T PO AC' },
      ]);
      expect(policy.sig).toBe('1T PO TIDAC');
      expect(policy.changes.some(c => c.includes('AC → TIDAC'))).toBe(true);
    });

    it('falls back to verbatim direction when all duplicate SIGs are selected for Never Use This SIG', () => {
      const policy = applyOutputCodePolicy('1T PO AC', [
        { kind: 'sig', value: '1T PO AC' },
        { kind: 'sig', value: '1T PO TIDAC' },
      ]);
      expect(policy.sig).toBe('1T PO THREE TIMES A DAY BEFORE MEALS');
      expect(policy.changes.some(c => c.includes('THREE TIMES A DAY BEFORE MEALS'))).toBe(true);
    });

    it('falls back to verbatim direction for single-code SIGs when Never Use This SIG is selected', () => {
      const policy = applyOutputCodePolicy('1T PO PC', [
        { kind: 'sig', value: '1T PO PC' },
      ]);
      expect(policy.sig).toBe('1T PO THREE TIMES A DAY AFTER MEALS');
    });

    it('preserves technician custom replacement if one was explicitly supplied', () => {
      const policy = applyOutputCodePolicy('GIVE 3 ML PO QD', [
        { kind: 'code', value: '3 ML', replacement: '1 VIAL' },
      ]);
      expect(policy.sig).toBe('GIVE 1 VIAL PO QD');
    });
  });
});
