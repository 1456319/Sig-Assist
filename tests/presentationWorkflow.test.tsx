import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrderQueueView } from '../src/components/OrderQueueView';
import { ReviewContext } from '../src/hooks/use-review-session';
import { addDemoOrders } from '../src/lib/demoOrders';
import type { QueueOrder } from '../src/lib/orderQueue';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function DemoHost() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  return <ReviewContext.Provider value={{ orders, setOrders, exclusions: [], policyRevision: 0, setExclusions: () => {} }}><OrderQueueView /></ReviewContext.Provider>;
}

describe('presentation workflow', () => {
  it('loads translated synthetic orders without overwriting an existing correction', () => {
    const orders = addDemoOrders([]);
    expect(orders).toHaveLength(5);
    expect(orders[0].draft).toBe('1T PO BID X7D');
    expect(orders[2].draft).toContain('X5D THEN 1T PO BID X4D THEN STOP');
    expect(orders[3].draft).toBe('1T PO Q12H PRN FCOU X7D');
    expect(orders[4].draft).toContain('SBP100');
    orders[0] = { ...orders[0], draft: 'MY REVIEWED CORRECTION', cancelled: true };
    expect(addDemoOrders(orders)[0]).toEqual(orders[0]);
  });

  it('shows an exact DocuTrack warning while permitting the technician to review and copy the selected order', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<DemoHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo queue' }));
    fireEvent.change(screen.getByLabelText('Copied DocuTrack text'), {target: {value: 'Order Type: Discontinue Rx\nPrescriber Order Number: DEMO-001\nOriginal document #: 001234 received on example date'}});
    fireEvent.click(screen.getByLabelText(/I checked that these documents/));
    fireEvent.click(screen.getByText('Read copied documents'));
    expect(screen.getByRole('heading', {name:'This PON has a matching E-DC in DocuTrack!'})).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', {name:/I matched the order and checked/}));
    fireEvent.click(screen.getByRole('button', {name:'Copy reviewed SIG'}));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('1T PO BID X7D'));
  });

  it('runs load, edit, approve, actual clipboard call and source revision through the queue', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<DemoHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo queue' }));
    const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
    const copy = screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement;
    expect(draft.value).toBe('1T PO BID X7D');
    expect(copy.disabled).toBe(true);
    fireEvent.change(draft, { target: { value: '1t po bid x7d with food' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I matched the order and checked/ }));
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('1T PO BID X7D WITH FOOD'));
    fireEvent.click(screen.getByRole('button', { name: 'Revise source' }));
    expect(copy.disabled).toBe(true);
    vi.unstubAllGlobals();
  });
});
