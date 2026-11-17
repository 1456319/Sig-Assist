import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReviewContext } from '../src/hooks/use-review-session';
import { OrderQueueView } from '../src/components/OrderQueueView';
import type { QueueOrder } from '../src/lib/orderQueue';
import { daysAgoMidnight, yesterdayMidnight } from '../src/lib/iguana/config';
import { attributeExport, newRx } from './iguanaFixtures';

function Harness() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  return <ReviewContext.Provider value={{ ready: true, orders, setOrders, exclusions: [], policyRevision: 0, setExclusions: () => {} }}><OrderQueueView /></ReviewContext.Provider>;
}

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const completed = (logs: number, added: number, matching: number) => `Search complete: ${logs} logs · ${added} added · ${matching} matching. Choose a matching E‑Rx below.`;
const noMatch = 'No matching orders are loaded for the current time window.';

function stubLookup(pon: string, bodies: string[]) {
  const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>().mockImplementation(async url => {
    if (url.endsWith('/detect')) return json({ ok: true, pon, token: 'synthetic-token', expiresAt: Date.now() + 300000, fields: {} });
    if (url.endsWith('/docutrack')) return json({ ok: true, capture: { headers: ['Document Type', 'Text 3', 'Document #'], rows: [['E-DC Order', pon, '001234']], unreadable: 0 } });
    return json({ ok: true, status: 200, body: bodies.shift() ?? attributeExport([]) });
  });
  vi.stubGlobal('fetch', fetcher);
  return {
    fetcher,
    requests: () => fetcher.mock.calls.filter(([url]) => url === '/connector/query').map(([, init]) => JSON.parse(init.body as string)),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('lookup PON identity and matching saved count', () => {
  it.each(['Framework detection', 'DocuTrack Find PON'])('keeps exact PON matching through the seven-day retry after %s', async source => {
    const pon = 'TEST-PON-100:1';
    const sibling = `${pon}0`;
    const { requests } = stubLookup(pon, [attributeExport([{ payload: newRx({ pon: sibling }) }])]);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Load recent E-Rx' }));
    await screen.findByText(completed(1, 1, 1));

    if (source === 'Framework detection') {
      fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Show E-DC PONs' }));
      await screen.findByText(/Iguana evidence checked for 1 document identities\./);
      fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Find PON', exact: true }));
    }
    await screen.findByText(completed(0, 0, 0));
    expect(screen.getByText(noMatch)).toBeTruthy();
    expect(requests().at(-1)).toMatchObject({ filter: pon, after: yesterdayMidnight(), before: '' });
    const candidates = within(screen.getByRole('region', { name: 'Orders' }));
    expect(candidates.getByText(sibling)).toBeTruthy();
    expect(candidates.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByLabelText('Final SIG · editable, uppercase')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Search the last 7 days' }));
    await screen.findByText(noMatch);
    expect(screen.getByText(completed(0, 0, 0))).toBeTruthy();
    expect(requests().at(-1)).toMatchObject({ filter: pon, after: daysAgoMidnight(7), before: '' });
    expect(screen.getByText(noMatch)).toBeTruthy();
    expect(candidates.getByText(sibling)).toBeTruthy();
    // The technician can still explicitly open a visible sibling for comparison.
    fireEvent.click(candidates.getByRole('button'));
    expect(screen.getByLabelText('Final SIG · editable, uppercase')).toBeTruthy();
  });

  it('preserves punctuation and counts only the exact detected PON among returned siblings', async () => {
    const pon = 'TEST-PON/100:01-A.2';
    const sibling = `${pon}0`;
    const { requests } = stubLookup(pon, [attributeExport([
      { payload: newRx({ id: 'synthetic-exact', pon }) },
      { payload: newRx({ id: 'synthetic-sibling', pon: sibling }) },
    ])]);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await screen.findByText(completed(2, 2, 1));
    expect((screen.getByLabelText('PON, patient reference, facility or drug') as HTMLInputElement).value).toBe(pon);
    expect(requests()[0].filter).toBe(pon);
    expect(screen.queryByText(noMatch)).toBeNull();
    const candidates = within(screen.getByRole('region', { name: 'Orders' }));
    expect(candidates.getAllByRole('button')).toHaveLength(2);
    expect(candidates.getByText(pon)).toBeTruthy();
    expect(candidates.getByText(sibling)).toBeTruthy();
    expect(screen.queryByLabelText('Final SIG · editable, uppercase')).toBeNull();
  });

  it('reports a matching saved order after duplicate logs and after a response with no logs', async () => {
    const pon = 'TEST-PON-300:1';
    const body = attributeExport([{ payload: newRx({ pon }) }]);
    stubLookup(pon, [body, body, attributeExport([])]);
    render(<Harness />);
    const detect = screen.getByRole('button', { name: 'Detect open E-Rx' });
    fireEvent.click(detect);
    await screen.findByText(completed(1, 1, 1));
    fireEvent.click(detect);
    await screen.findByText(completed(1, 0, 1));
    expect(screen.queryByText(noMatch)).toBeNull();
    fireEvent.click(detect);
    await screen.findByText(completed(0, 0, 1));
    expect(screen.queryByRole('button', { name: 'Search the last 7 days' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Orders' })).getAllByRole('button')).toHaveLength(1);
  });

  it('offers a wider search when a detected PON has no logs or saved matches', async () => {
    stubLookup('TEST-PON-404', []);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await screen.findByText(completed(0, 0, 0));
    expect(screen.getByText(noMatch)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search the last 7 days' })).toBeTruthy();
  });

  it.each(['test-pon-2', 'resident', 'demo-si', '0.5 mg'])('keeps broad substring matching for a typed %s query', async query => {
    const { requests } = stubLookup('unused', [attributeExport([{ payload: newRx({ pon: 'TEST-PON-200' }) }])]);
    render(<Harness />);
    const search = screen.getByLabelText('PON, patient reference, facility or drug');
    fireEvent.change(search, { target: { value: ` ${query} ` } });
    fireEvent.submit(search.closest('form')!);
    await screen.findByText(completed(1, 1, 1));
    expect(requests()[0].filter).toBe(query);
    expect(screen.queryByText(noMatch)).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Orders' })).getByText('TEST-PON-200')).toBeTruthy();
  });

  it('uses broad matching again when the technician submits the detected text manually', async () => {
    const pon = 'TEST-PON-100:1';
    stubLookup(pon, [attributeExport([{ payload: newRx({ pon: `${pon}0` }) }])]);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Load recent E-Rx' }));
    await screen.findByText(completed(1, 1, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await screen.findByText(completed(0, 0, 0));
    expect(screen.getByText(noMatch)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Find E-Rx', exact: true }));
    await screen.findByText(completed(0, 0, 1));
    expect(screen.queryByText(noMatch)).toBeNull();
  });
});
