import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SigReviewPanel } from '../src/components/SigReviewPanel';
import { MultiOrderCards } from '../src/components/MultiOrderCards';
import { ReviewContext } from '../src/hooks/use-review-session';
import { reviewStamp } from '../src/lib/reviewPolicy';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const session = { orders: [], setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function expectSelected(textarea: HTMLTextAreaElement, value: string) {
  expect(document.activeElement).toBe(textarea);
  expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(value);
}

describe('Citrix clipboard recovery', () => {
  it('selects the reviewed edited draft after a clipboard rejection without reporting a successful copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    const draft = '1T PO QAM FPAIN';
    const onCopied = vi.fn();
    render(<ReviewContext.Provider value={session}><SigReviewPanel source="synthetic directions" suggestion="1T PO QD" draft={draft} approved={reviewStamp('synthetic directions', draft, [], 0)} warnings={[]} onEdit={vi.fn()} onApprove={vi.fn()} onCopied={onCopied} /></ReviewContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copy reviewed SIG' }));
    await waitFor(() => expectSelected(screen.getByRole('textbox', { name: /Final SIG/ }) as HTMLTextAreaElement, draft));
    expect(onCopied).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Ctrl+C'));
  });

  it('selects only the matching sub-order draft when the clipboard API is absent', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const subOrders = [
      { id: 'routine', label: 'Routine', suggestedSig: '1T PO QAM', abnormalities: [] },
      { id: 'prn', label: 'PRN', suggestedSig: '1T PO QD PRN FPAIN', abnormalities: [] },
    ];
    const draft = '1T PO BID PRN FPAIN';
    const onCopySubOrder = vi.fn();
    render(<ReviewContext.Provider value={session}><MultiOrderCards subOrders={subOrders} initialDrafts={{ prn: draft }} initialApprovals={{ prn: reviewStamp(subOrders[1].suggestedSig, draft, [], 0) }} onCopySubOrder={onCopySubOrder} /></ReviewContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Reviewed SIG (PRN)' }));
    await waitFor(() => expectSelected(screen.getByRole('textbox', { name: /Draft SIG \(PRN\)/ }) as HTMLTextAreaElement, draft));
    expect(onCopySubOrder).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText('Copied!')).toBeNull();
  });
});
