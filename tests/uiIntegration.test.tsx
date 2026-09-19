import { describe, expect, it, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup } from '@testing-library/react';
import { AbnormalityBanner } from '../src/components/AbnormalityBanner';
import { DiscrepancyPanel } from '../src/components/DiscrepancyPanel';
import { MultiOrderCards } from '../src/components/MultiOrderCards';
import { ReviewContext } from '../src/hooks/use-review-session';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { AbnormalityFinding, SubOrderResult } from '../src/lib/clinical/types';

describe('UI Components', () => {
  afterEach(() => {
    cleanup();
  });
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

  it('MultiOrderCards: disables review, editing, and copying and invalidates approval when unavailable is true', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const subOrders: SubOrderResult[] = [
      { id: 'sub_1', label: 'Order 1 of 2', suggestedSig: '2T PO QAM', abnormalities: [] },
      { id: 'sub_2', label: 'Order 2 of 2', suggestedSig: '1T PO QHS', abnormalities: [] },
    ];

    const { rerender } = render(
      <ReviewContext.Provider value={{
        orders: [],
        setOrders: () => {},
        exclusions: [],
        policyRevision: 0,
        setExclusions: () => {}
      }}>
        <MultiOrderCards subOrders={subOrders} unavailable={false} />
      </ReviewContext.Provider>
    );

    const checkboxes = screen.getAllByLabelText(/Reviewed and approved for FrameworkLTC/i) as HTMLInputElement[];
    const checkbox = checkboxes[0];
    const copyBtn = screen.getByRole('button', { name: /Copy Reviewed SIG \(Order 1 of 2\)/i }) as HTMLButtonElement;
    const textarea = screen.getByLabelText(/Draft SIG \(Order 1 of 2\)/i) as HTMLTextAreaElement;

    expect(checkbox.checked).toBe(false);
    expect(copyBtn.disabled).toBe(true);
    expect(textarea.disabled).toBe(false);

    // Approve Order 1 of 2
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(copyBtn.disabled).toBe(false);

    // Now order becomes unavailable (e.g. cancelled or revising)
    rerender(
      <ReviewContext.Provider value={{
        orders: [],
        setOrders: () => {},
        exclusions: [],
        policyRevision: 0,
        setExclusions: () => {}
      }}>
        <MultiOrderCards subOrders={subOrders} unavailable={true} />
      </ReviewContext.Provider>
    );

    // Approval must be invalidated and controls locked
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(copyBtn.disabled).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(screen.getByTestId('multi-order-unavailable-banner')).toBeDefined();
  });

  it('OrderQueueView: revising a split-order immediately blocks copying and disables sub-orders', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { OrderQueueView } = await import('../src/components/OrderQueueView');

    const initialOrder = {
      id: 'split_order_revise',
      facility: 'Sunrise LTC',
      patientRef: 'Room 101',
      pon: 'PON-SPLIT-REV',
      drug: 'PREDNISONE 10MG',
      directions: 'Take 2 tablets in the morning and 1 tablet at night for 5 days',
      draft: '2T PO QAM AND 1T PO QHS X5D',
      revision: 1,
      previousSources: [],
    };

    function TestHost() {
      const [orders, setOrders] = React.useState([initialOrder]);
      return (
        <ReviewContext.Provider value={{
          orders,
          setOrders,
          exclusions: [],
          policyRevision: 0,
          setExclusions: () => {}
        }}>
          <OrderQueueView />
        </ReviewContext.Provider>
      );
    }

    render(<TestHost />);

    // Select the split order
    const orderItem = screen.getByText('PON-SPLIT-REV');
    fireEvent.click(orderItem);

    // Locate the sub-order card controls
    const checkboxes = screen.getAllByLabelText(/Reviewed and approved for FrameworkLTC/i) as HTMLInputElement[];
    const copyButton1 = screen.getByRole('button', { name: /Copy Reviewed SIG \(Order 1 of 2\)/i }) as HTMLButtonElement;

    // Approve Order 1 of 2
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);
    expect(copyButton1.disabled).toBe(false);

    // Click Revise source
    const reviseBtn = screen.getByRole('button', { name: /Revise source/i });
    fireEvent.click(reviseBtn);

    // Revision mode must immediately disable copy button and checkbox
    expect(copyButton1.disabled).toBe(true);
    expect(checkboxes[0].disabled).toBe(true);
    expect(screen.getByTestId('multi-order-unavailable-banner')).toBeDefined();
  });

  it('OrderQueueView: cancelling a split-order immediately blocks copying and disables sub-orders', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { OrderQueueView } = await import('../src/components/OrderQueueView');

    const initialOrder = {
      id: 'split_order_cancel',
      facility: 'Sunrise LTC',
      patientRef: 'Room 102',
      pon: 'PON-SPLIT-CNC',
      drug: 'PREDNISONE 10MG',
      directions: 'Take 2 tablets in the morning and 1 tablet at night for 5 days',
      draft: '2T PO QAM AND 1T PO QHS X5D',
      revision: 1,
      previousSources: [],
    };

    function TestHost() {
      const [orders, setOrders] = React.useState([initialOrder]);
      return (
        <ReviewContext.Provider value={{
          orders,
          setOrders,
          exclusions: [],
          policyRevision: 0,
          setExclusions: () => {}
        }}>
          <OrderQueueView />
        </ReviewContext.Provider>
      );
    }

    render(<TestHost />);

    // Select the split order
    const orderItem = screen.getByText('PON-SPLIT-CNC');
    fireEvent.click(orderItem);

    const checkboxes = screen.getAllByLabelText(/Reviewed and approved for FrameworkLTC/i) as HTMLInputElement[];
    const copyBtn = screen.getByRole('button', { name: /Copy Reviewed SIG \(Order 1 of 2\)/i }) as HTMLButtonElement;

    // Approve Order 1 of 2
    fireEvent.click(checkboxes[0]);
    expect(copyBtn.disabled).toBe(false);

    // Confirm cancel
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancelBtn = screen.getByRole('button', { name: /Cancel order/i });
    fireEvent.click(cancelBtn);

    // Cancelled state must immediately disable copy button and checkbox
    expect(copyBtn.disabled).toBe(true);
    expect(checkboxes[0].disabled).toBe(true);
    expect(screen.getByTestId('multi-order-unavailable-banner')).toBeDefined();
  });

  it('WorkbenchView: marks split sub-orders as unavailable when HL7 input has an unverified profile warning', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { WorkbenchView } = await import('../src/components/WorkbenchView');

    render(
      <ReviewContext.Provider value={{
        orders: [],
        setOrders: () => {},
        exclusions: [],
        policyRevision: 0,
        setExclusions: () => {}
      }}>
        <WorkbenchView />
      </ReviewContext.Provider>
    );

    // Switch to Raw HL7 mode
    const hl7Button = screen.getByRole('button', { name: /Raw HL7/i });
    fireEvent.click(hl7Button);

    const textarea = screen.getByPlaceholderText(/Paste raw HL7 message here/i);
    const hl7Message = [
      'MSH|^~\\&|EHR|FAC|SIG|RX|202609191000||OMP^O09|MSG01|P|2.5',
      'PID|1||12345^^^FAC^MR||DOE^JOHN',
      'ORC|NW|ORD123|||||1^BID',
      'RXO|PREDNISONE 10MG TABLET|||||||||||||||||||||||Take 2 tablets in the morning and 1 tablet at night for 5 days',
    ].join('\n');

    fireEvent.change(textarea, { target: { value: hl7Message } });

    // MultiOrderCards should render the unavailable banner and lock copy buttons
    expect(await screen.findByTestId('multi-order-unavailable-banner')).toBeDefined();
    const copyBtns = screen.getAllByRole('button', { name: /Copy Reviewed SIG/i }) as HTMLButtonElement[];
    expect(copyBtns.length).toBeGreaterThan(0);
    expect(copyBtns[0].disabled).toBe(true);
  });
});
