import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AbnormalityBanner } from '../src/components/AbnormalityBanner';
import { DiscrepancyPanel } from '../src/components/DiscrepancyPanel';
import { AbnormalityFinding } from '../src/lib/clinical/types';

describe('UI Components', () => {
  it('renders 3-tier abnormality banner with appropriate styling and notices', () => {
    const findings: AbnormalityFinding[] = [
      {
        id: '1',
        tier: 'uncorrected_gap',
        title: 'Sliding Scale Coverage Gap',
        message: 'The generated Sig does NOT contain a correction, consult RPh.'
      },
      {
        id: '2',
        tier: 'applied_correction',
        title: 'Diclofenac Dose Default Applied',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Sig was generated with Qty/Dose = 2GM',
        trigger: 'Unspecified anatomical site'
      }
    ];

    const html = renderToString(<AbnormalityBanner findings={findings} />);
    expect(html).toContain('One or more abnormalities were identified');
    expect(html).toContain('The generated Sig does NOT contain a correction, consult RPh.');
    expect(html).toContain('The generated Sig CONTAINS A CORRECTION.');
  });

  it('renders potential_error tier in abnormality banner', () => {
    const findings: AbnormalityFinding[] = [
      {
        id: '3',
        tier: 'potential_error',
        title: 'High Dose Threshold Exceeded',
        message: 'Review prescribed dose against max daily thresholds.'
      }
    ];
    const html = renderToString(<AbnormalityBanner findings={findings} />);
    expect(html).toContain('High Dose Threshold Exceeded');
    expect(html).toContain('Review prescribed dose against max daily thresholds.');
  });

  it('renders nothing when findings array is empty', () => {
    const html = renderToString(<AbnormalityBanner findings={[]} />);
    expect(html).toBe('');
  });

  it('renders discrepancy capture panel', () => {
    const html = renderToString(
      <DiscrepancyPanel
        pon="PON123"
        drugName="WARFARIN 5MG"
        rawProse="Give 1 tab at bedtime"
        generatedSig="1T PO QHS"
        onDiscrepancySaved={() => {}}
      />
    );
    expect(html).toContain('Flag Discrepancy or Uncaught Error');
  });
});
