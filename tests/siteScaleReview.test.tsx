import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MultiOrderCards } from '../src/components/MultiOrderCards';
import { AbnormalityBanner } from '../src/components/AbnormalityBanner';
import { SigReviewPanel } from '../src/components/SigReviewPanel';
import { ReviewContext } from '../src/hooks/use-review-session';
import { reviewStamp } from '../src/lib/reviewPolicy';
import { estimateScaleExpansion } from '../src/lib/clinical/slidingScaleBudget';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const session = { orders: [], setOrders: vi.fn(), exclusions: [], setExclusions: vi.fn(), policyRevision: 0 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('editable shared insulin scale budget', () => {
  it('shows a pharmacist clarification alert distinctly from the length warning', () => {
    render(<AbnormalityBanner findings={[
      { id: 'sliding_scale_gap', tier: 'uncorrected_gap', title: 'Sliding-Scale Coverage Gap', message: 'No prescribed dose band covers 350–399.' },
      { id: 'sliding_scale_budget_exceeded', tier: 'uncorrected_gap', title: 'SIG exceeds 199 characters', message: 'Edit the draft.' },
    ]} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Pharmacist clarification required');
    expect(alert.textContent).toContain('350–399');
    expect(alert.textContent).not.toContain('199 characters');
    expect(screen.getByText(/SIG exceeds 199 characters/)).toBeTruthy();
  });
  it('counts entered parts together, excludes the unified preview, and follows technician edits', () => {
    const first = 'CBS QID SS 150-200=2U';
    const second = 'PLUS3U QID ' + 'X'.repeat(95);
    const subOrders = [
      { id: 'scale', label: 'Scale', suggestedSig: first, abnormalities: [] },
      { id: 'fixed', label: 'Fixed dose', suggestedSig: second, abnormalities: [] },
    ];
    expect(estimateScaleExpansion(first).length).toBeLessThan(199);
    expect(estimateScaleExpansion(second).length).toBeLessThan(199);
    render(<ReviewContext.Provider value={session}><MultiOrderCards primarySig={`${first} **SPLIT** ${second}`} subOrders={subOrders} /></ReviewContext.Provider>);
    const total = [first, second].map(estimateScaleExpansion).join(' ').length;
    expect(screen.getByRole('alert').textContent).toContain(`${total} / 199`);
    expect(screen.queryByText(/Paxit Multi-Order Requirement/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: /Draft SIG \(Fixed dose\)/ }), { target: { value: 'PLUS3U QID' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(`${[first, 'PLUS3U QID'].map(estimateScaleExpansion).join(' ').length} / 199`);
    expect((screen.getByRole('textbox', { name: /Draft SIG \(Fixed dose\)/ }) as HTMLTextAreaElement).value).toBe('PLUS3U QID');
  });

  it('shows an over-budget alert without blocking a technician-approved copy', async () => {
    const draft = 'C.B.S. QID S.S. 150-200=2U;' + 'X'.repeat(200);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onCopied = vi.fn();
    render(<ReviewContext.Provider value={session}><SigReviewPanel source="synthetic insulin directions" suggestion={draft} draft={draft} approved={reviewStamp('synthetic insulin directions', draft, [], 0)} warnings={[]} onEdit={vi.fn()} onApprove={vi.fn()} onCopied={onCopied} /></ReviewContext.Provider>);
    expect(screen.getByRole('alert').textContent).toContain('199-character budget');
    const copy = screen.getByRole('button', { name: 'Copy reviewed SIG' });
    expect((copy as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(draft));
    expect(onCopied).toHaveBeenCalledOnce();
  });
});
