import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import { ReviewContext } from '../src/hooks/use-review-session';
import { OrderQueueView } from '../src/components/OrderQueueView';
import type { QueueOrder } from '../src/lib/orderQueue';
import { attributeExport, fourLogHar, newRx, escapeXml } from './iguanaFixtures';
import { daysAgoMidnight, yesterdayMidnight } from '../src/lib/iguana/config';

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
  it('finds by one field and requires a choice between the same PON for different residents', async () => {
    const first = newRx({ pon: '12345' });
    const second = newRx({ id: 'synthetic-msg-2', pon: '12345', directions: 'Give 2 tablets by mouth daily' })
      .replace('DEMO-RESIDENT', 'DEMO-RESIDENT-2').replace('Example 0.5 MG Tablet', 'Other example tablet');
    const body = attributeExport([{ payload: first }, { payload: second }]);
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, status: 200, body }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<Harness />);
    const search = screen.getByLabelText('PON, patient reference, facility or drug');
    expect(screen.getByText('Add an order manually (optional)').closest('details')?.open).toBe(false);
    expect(screen.getByText('Live connection settings').closest('details')?.open).toBe(false);
    fireEvent.change(search, { target: { value: ' 12345 ' } });
    fireEvent.submit(search.closest('form')!);
    await screen.findByText('Search complete: 2 logs · 2 added. Choose a matching E‑Rx below.');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ filter: '12345', serverUrl: 'http://iguanabalt01v:6543', after: yesterdayMidnight(), before: '' });
    const candidates = within(screen.getByRole('region', { name: 'Orders' }));
    expect(candidates.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByLabelText('Final SIG · editable, uppercase')).toBeNull();
    fireEvent.click(candidates.getByRole('button', { name: /Other example tablet/ }));
    expect((screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement).value).toBe('2T PO QD');
    expect(screen.getByText('DEMO-SITE · DEMO-RESIDENT-2 · Other example tablet')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(search, { target: { value: 'other example' } });
    expect(candidates.getAllByRole('button')).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Final SIG · editable, uppercase')).toBeNull();
  });
  it('offers an older search without requesting another field and never moves the polling cursor for a lookup', async () => {
    const bodies = ['<export/>', attributeExport([{ payload: newRx() }]), '<export/>'];
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, status: 200, body: bodies.shift() }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('PON, patient reference, facility or drug'), { target: { value: 'DEMO-PON-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find E-Rx', exact: true }));
    await screen.findByText('No matching orders are loaded for the current time window.');
    fireEvent.click(screen.getByRole('button', { name: 'Search the last 7 days' }));
    await screen.findByText('Search complete: 1 logs · 1 added. Choose a matching E‑Rx below.');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ after: daysAgoMidnight(7), filter: 'DEMO-PON-1', before: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Start polling' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ after: yesterdayMidnight(), filter: '' });
    expect((screen.getByLabelText('PON, patient reference, facility or drug') as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop intake' }));
  });
  it('keeps the active order and its draft when a background fetch adds another E-Rx', async () => {
    const bodies = [attributeExport([{ payload: newRx() }]), attributeExport([{ payload: newRx({ id: 'another-msg', pon: 'ANOTHER-PON' }) }])];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, status: 200, body: bodies.shift() }), { headers: { 'content-type': 'application/json' } })));
    render(<Harness />);
    fireEvent.click(screen.getByText('Live connection settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Fetch once', exact: true }));
    const draft = await screen.findByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'TECHNICIAN DRAFT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch once', exact: true }));
    await screen.findByText('ANOTHER-PON');
    expect(screen.getByRole('heading', { name: 'PON DEMO-PON-1 · revision 1' })).toBeTruthy();
    expect(draft.value).toBe('TECHNICIAN DRAFT');
  });
  it('fetches attribute-based live logs with the prefilled settings and preserves the edited draft on a repeat fetch', async () => {
    const body = attributeExport([{ type: 'Message', payload: '' }, { payload: newRx() }]);
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, status: 200, body }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<Harness />);
    fireEvent.click(screen.getByText('Live connection settings'));
    expect((screen.getByLabelText('After · Iguana server time') as HTMLInputElement).value).toBe(yesterdayMidnight());
    fireEvent.click(screen.getByRole('button', { name: 'Fetch once', exact: true }));
    await screen.findByText('Last fetch: 2 logs · 1 added · 0 need investigation');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ serverUrl: 'http://iguanabalt01v:6543', username: 'admin', password: 'password', after: yesterdayMidnight(), before: '' });
    const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'TECHNICIAN CORRECTION' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch once', exact: true }));
    await screen.findByText('Last fetch: 2 logs · 0 added · 0 need investigation');
    expect(draft.value).toBe('TECHNICIAN CORRECTION');
    fireEvent.change(screen.getByLabelText('After · Iguana server time'), { target: { value: '2020/01/01 12:00:00' } });
    fireEvent.change(screen.getByLabelText('Before · optional server time'), { target: { value: '2020/01/02 12:00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use yesterday’s midnight' }));
    expect((screen.getByLabelText('After · Iguana server time') as HTMLInputElement).value).toBe(yesterdayMidnight());
    expect((screen.getByLabelText('Before · optional server time') as HTMLInputElement).value).toBe('');
  });
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
