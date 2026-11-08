import { describe, it, expect } from 'vitest';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';
import { resolveLidocainePatch, isLidocainePatch } from '../src/lib/clinical/lidocainePatch';

describe('Lidocaine Patch Translation (Issue #38)', () => {
  it('recognizes 4% and 5% Lidocaine patches', () => {
    expect(isLidocainePatch('Lidocaine HCl Topical Patch 4 %')).toBe(true);
    expect(isLidocainePatch('Lidocaine Topical Patch 5 %')).toBe(true);
    expect(isLidocainePatch('Lidocaine 5% Patch')).toBe(true);
    expect(isLidocainePatch('Fentanyl Transdermal Patch 25 mcg/hr')).toBe(false);
    expect(isLidocainePatch('Clonidine Transdermal Patch 0.1 mg/24hr')).toBe(false);
  });

  it('translates discrepancy case disc_ba93de14-df83-4205-9d77-43280abdc652 exactly', () => {
    const inbound = {
      id: '286544',
      pon: '286544',
      drugName: 'Lidocaine HCl Topical Patch 4 %',
      rawProse: 'Apply to left lower back  topically in the morning for pain remove for 12 hours prior to placing new patch',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL TO LEFT LOWER BACK QAM FPAIN 12ON');
    expect(result.subOrders[0].suggestedSig).toBe('1PA TPCL TO LEFT LOWER BACK QAM FPAIN 12ON');
    // Ensure no unsupported duration abnormality was flagged
    expect(result.abnormalities.some((a) => a.id === 'unsupported_duration')).toBe(false);
  });

  it('translates BID to QD for Lidocaine patches to prevent burns from >12hr wear', () => {
    const inbound = {
      id: 'test_bid',
      pon: '286545',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply to right shoulder topically twice daily for pain remove after 12 hours',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL TO RIGHT SHOULDER QD FPAIN 12ON');
  });

  it('handles Lidocaine patch orders with no anatomical site specified', () => {
    const inbound = {
      id: 'test_no_site',
      pon: '286546',
      drugName: 'Lidocaine HCl Topical Patch 4 %',
      rawProse: 'Apply 1 patch topically daily for pain on 12 hours and off for 12 hours',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL QD FPAIN 12ON');
  });

  it('handles PRN Lidocaine patch orders with removal instructions', () => {
    const inbound = {
      id: 'test_prn',
      pon: '286547',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply to lower back topically as needed for pain remove after 12 hours',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL TO LOWER BACK PRN FPAIN 12ON');
  });

  it('correctly extracts site when site appears after route', () => {
    const inbound = {
      id: 'test_site_after_route',
      pon: '286549',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply 1 patch topically to left shoulder daily for pain',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL TO LEFT SHOULDER QD FPAIN 12ON');
  });

  it('does not capture frequency words as site when no site is present', () => {
    const inbound1 = {
      id: 'test_no_site_daily',
      pon: '286550',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply topically daily for pain',
      sourceFormat: 'manual_text' as const,
    };
    expect(translateClinicalSig(inbound1).primarySig).toBe('1PA TPCL QD FPAIN 12ON');

    const inbound2 = {
      id: 'test_no_site_prn',
      pon: '286551',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply topically as needed for pain',
      sourceFormat: 'manual_text' as const,
    };
    expect(translateClinicalSig(inbound2).primarySig).toBe('1PA TPCL PRN FPAIN 12ON');

    const inbound3 = {
      id: 'test_no_site_qam',
      pon: '286552',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply topically in the morning for pain',
      sourceFormat: 'manual_text' as const,
    };
    expect(translateClinicalSig(inbound3).primarySig).toBe('1PA TPCL QAM FPAIN 12ON');
  });

  it('strips bedtime removal prose without mistaking application time as QHS', () => {
    const inbound = {
      id: 'test_bedtime_removal',
      pon: '286553',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply daily, remove at bedtime for pain',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL QD FPAIN 12ON');
  });

  it('normalizes Q12H and every 12 hours to QD to prevent toxic continuous wear', () => {
    const inbound = {
      id: 'test_q12h',
      pon: '286554',
      drugName: 'Lidocaine Topical Patch 5 %',
      rawProse: 'Apply 1 patch topically every 12 hours for pain',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('1PA TPCL QD FPAIN 12ON');
  });

  it('handles spelled-out patch counts (e.g. two patches)', () => {
    const inbound = {
      id: 'test_word_count',
      pon: '286555',
      drugName: 'Lidocaine HCl Topical Patch 4 %',
      rawProse: 'Apply two patches topically to lower back daily for pain',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).toBe('2PA TPCL TO LOWER BACK QD FPAIN 12ON');
  });

  it('does not intercept non-Lidocaine transdermal patches', () => {
    const inbound = {
      id: 'test_fentanyl',
      pon: '286548',
      drugName: 'Fentanyl Transdermal Patch 25 mcg/hr',
      rawProse: 'Apply 1 patch transdermally every 72 hours for pain',
      sourceFormat: 'manual_text' as const,
    };

    const result = translateClinicalSig(inbound);
    expect(result.primarySig).not.toContain('12ON');
    expect(resolveLidocainePatch(inbound.drugName, inbound.rawProse)).toBeUndefined();
  });
});
