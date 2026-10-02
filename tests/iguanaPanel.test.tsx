import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import { ReviewContext } from '../src/hooks/use-review-session';
import { OrderQueueView } from '../src/components/OrderQueueView';
import type { QueueOrder } from '../src/lib/orderQueue';
import { fourLogHar, newRx, escapeXml } from './iguanaFixtures';

function Harness() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  return <ReviewContext.Provider value={{ ready: true, orders, setOrders, exclusions: [], policyRevision: 0, setExclusions: () => {} }}><OrderQueueView /></ReviewContext.Provider>;
}
function upload(text: string) {
  const file = new File([text], 'capture.har', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  fireEvent.change(screen.getByLabelText('Import Iguana capture'), { target: { files: [file] } });
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('connector through queue UI', () => {
  it('populates the queue from four HAR details and preserves a technician correction on reimport', async () => {
    // Local optional validation reads the authorized capture without copying it into the repo.
    const text = process.env.SIG_ASSIST_HAR_CHECK ? await readFile(process.env.SIG_ASSIST_HAR_CHECK, 'utf8') : JSON.stringify(fourLogHar());
    render(<Harness />); upload(text);
    await screen.findByText('Capture imported: 4 logs · 1 added · 1 duplicates · 0 need investigation');
    expect(screen.getByText('0900, 2100')).toBeTruthy();
    const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'TECHNICIAN CORRECTION' } });
    upload(text);
    await screen.findByText('Capture imported: 4 logs · 0 added · 2 duplicates · 0 need investigation');
    expect(draft.value).toBe('TECHNICIAN CORRECTION');
  });
  it('fetches through the local bridge and pauses a saturated polling query visibly', async () => {
    const body = `<export><message source="MessageBroker" type="Info" time="2026/10/02 01:00:00"><data>${escapeXml(newRx())}</data></message></export>`;
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, status: 200, body }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<Harness />);
    fireEvent.click(screen.getByText('Live connection settings'));
    fireEvent.change(screen.getByLabelText('Iguana base URL'), { target: { value: 'http://example.invalid:6543' } });
    fireEvent.change(screen.getByLabelText('After · Iguana server time'), { target: { value: '2026/10/02 00:00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch once', exact: true }));
    await screen.findByText('Last fetch: 1 logs · 1 added · 0 need investigation');
    expect(fetcher.mock.calls[0][0]).toBe('/connector/query');
    fireEvent.change(screen.getByLabelText('Log limit · 1–5000'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start polling', exact: true }));
    await screen.findByText('Paused: log query limit reached. Narrow the time window or increase the limit.');
    expect((screen.getByRole('button', { name: 'Start polling', exact: true }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('reports undecodable SCRIPT and does not add a default tablet order', async () => {
    render(<Harness />);
    const file = new File(['<Message><Body><NewRx>broken'], 'broken.xml');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('<Message><Body><NewRx>broken') });
    fireEvent.change(screen.getByLabelText('Import Iguana capture'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Capture imported: 1 logs · 0 added · 0 duplicates · 1 need investigation')).toBeTruthy());
    expect(screen.getByText('No orders to display.')).toBeTruthy();
  });
});
