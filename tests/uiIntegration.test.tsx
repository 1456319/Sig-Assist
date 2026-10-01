import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AbnormalityBanner } from '../src/components/AbnormalityBanner';
import { DiscrepancyPanel } from '../src/components/DiscrepancyPanel';
import { MultiOrderCards } from '../src/components/MultiOrderCards';
import { ReviewContext } from '../src/hooks/use-review-session';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { AbnormalityFinding, SubOrderResult } from '../src/lib/clinical/types';

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

  it('renders discrepancy capture panel in collapsed state with Alt+N badge', () => {
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

  it('renders discrepancy capture panel in expanded state when isOpen is true', () => {
    const html = renderToString(
      <DiscrepancyPanel
        pon="PON123"
        drugName="WARFARIN 5MG"
        rawProse="Give 1 tab at bedtime"
        generatedSig="1T PO QHS"
        isOpen={true}
        onDiscrepancySaved={() => {}}
      />
    );
    expect(html).toContain('Close Feedback');
    expect(html).toContain('Technician Preferred / Corrected SIG:');
    expect(html).toContain('Notes / Rationale:');
    expect(html).toContain('Save Discrepancy Report');
  });

  it('renders multi-order split cards for Paxit regimens with independent review checkboxes and disabled copy safeguards', () => {
    const subOrders: SubOrderResult[] = [
      {
        id: 'order_split_1',
        label: 'Order 1 of 2',
        suggestedSig: '2T PO QAM',
        abnormalities: []
      },
      {
        id: 'order_split_2',
        label: 'Order 2 of 2',
        suggestedSig: '1T PO QHS',
        abnormalities: [
          {
            id: 'sub_abn_1',
            tier: 'applied_correction',
            title: 'Paxit Bedtime Dose Split',
            message: 'The generated Sig CONTAINS A CORRECTION.',
            correction: 'Separated morning and evening dosing into independent cards',
            trigger: 'Paxit solid oral differential daily dosing'
          }
        ]
      }
    ];

    const html = renderToString(
      <ReviewContext.Provider value={{
        orders: [],
        setOrders: () => {},
        exclusions: [],
        policyRevision: 0,
        setExclusions: () => {}
      }}>
        <MultiOrderCards subOrders={subOrders} />
      </ReviewContext.Provider>
    );

    // Renders both sub-order labels
    expect(html).toContain('Order 1 of 2');
    expect(html).toContain('Order 2 of 2');

    // Renders suggested SIGs in drafts
    expect(html).toContain('2T PO QAM');
    expect(html).toContain('1T PO QHS');

    // Renders independent review approval checkboxes
    expect(html).toContain('Reviewed and approved for FrameworkLTC');

    // Renders dedicated copy buttons with exact sub-order labels
    expect(html).toContain('Copy Reviewed SIG (Order 1 of 2)');
    expect(html).toContain('Copy Reviewed SIG (Order 2 of 2)');

    // Verifies copy buttons are disabled by default prior to review approval
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Copy Reviewed SIG \(Order 1 of 2\)[\s\S]*?<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Copy Reviewed SIG \(Order 2 of 2\)[\s\S]*?<\/button>/);

    // Verifies sub-order abnormality banner is rendered in the relevant sub-card
    expect(html).toContain('Paxit Bedtime Dose Split');
    expect(html).toContain('Separated morning and evening dosing into independent cards');
  });

  it('renders WorkbenchView with integrated clinical review sections and discrepancy drawer', () => {
    const html = renderToString(<WorkbenchView />);
    expect(html).toContain('Review and correct SIG');
    expect(html).toContain('Flag Discrepancy or Uncaught Error');
  });
});
