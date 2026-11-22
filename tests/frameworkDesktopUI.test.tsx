import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FrameworkDetect, FrameworkTransfer } from '../src/components/FrameworkDesktop';
import type { FrameworkDetection } from '../src/lib/frameworkDesktop';

const found: FrameworkDetection = { ok: true, pons: ['PON-A', 'PON-B'], token: 'synthetic-token', expiresAt: Date.now() + 300000, fields: { sig: { label: 'SIG', currentValue: 'OLD' } } };
function Harness({ initial }: { initial?: FrameworkDetection }) {
  const [detected, setDetected] = useState(initial);
  return <FrameworkTransfer detected={detected} pon="PON-B" sig="APPROVED SIG" blocked={undefined} times={['0900']} onDetected={setDetected} />;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('technician-controlled Framework sending', () => {
  it('offers explicit entry-window selection and displays the remembered window', async () => {
    const result = { ok: true, pon: 'PON-A', pons: ['PON-A'], entryWindow: { title: 'Framework entry fixture', pid: 41 } };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(result))));
    vi.stubGlobal('fetch', fetcher);
    render(<FrameworkDetect disabled={false} onStart={vi.fn()} onDetected={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose entry window' }));
    expect(screen.getByText(/Click inside the Framework window you use/)).toBeTruthy();
    await screen.findByText(/Entry window: Framework entry fixture/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ positionReview: false, chooseWindow: true });
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ positionReview: false });
  });
  it('uses Iguana for details after PON detection and makes desktop positioning optional', async () => {
    const result = { ok: true, pon: 'PON-A', pons: ['PON-A'] };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(result))));
    vi.stubGlobal('fetch', fetcher);
    render(<FrameworkDetect disabled={false} onStart={vi.fn()} onDetected={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await screen.findByText(/Detected PON PON-A/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ positionReview: false });
    fireEvent.click(screen.getByLabelText(/Also position Framework/));
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ positionReview: true });
  });
  it('distinguishes finding the open wizard from reading its PON across five instances', async () => {
    const detection = { ok: true, instances: 5, openErxWindows: 1, pons: [], diagnostics: { windowsScanned: 1, windows: [] }, warnings: ['Some open E-Rx detail rows could not be read.'] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(detection))));
    const onDetected = vi.fn(); render(<FrameworkDetect disabled={false} onStart={vi.fn()} onDetected={onDetected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Detect open E-Rx' }));
    await screen.findByText(/5 Framework instances; 1 open E-Rx window/);
    expect(screen.getByText(/its PON could not be read/)).toBeTruthy();
    expect(onDetected).toHaveBeenCalledWith(detection);
    expect(screen.getByRole('button', { name: 'Download PON detection report' })).toBeTruthy();
  });
  it('warns about two PONs without blocking an approved send', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, verified: true, next: found })));
    vi.stubGlobal('fetch', fetcher); render(<Harness initial={found} />);
    expect(screen.getByRole('alert').textContent).toContain('Multiple PONs detected');
    fireEvent.click(screen.getByLabelText(/I matched this patient, drug and PON/));
    const send = screen.getByRole('button', { name: 'Send approved SIG to Framework' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false); fireEvent.click(send);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toBe('/connector/desktop/send');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ pon: 'PON-B', value: 'APPROVED SIG', approved: true, matched: true });
  });
  it('requires review of exact Rx Entry values and reports a partial fill without retrying', async () => {
    const draft = { ok: true, draftReady: true, pon: 'PON-B', token: 'draft-token', expiresAt: Date.now() + 300000,
      fields: { quantity: { label: 'Quantity', currentValue: '7' }, startDate: { label: 'Start Date', currentValue: '11/24/2026' } } };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(draft))).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, completed: ['quantity'], uncertain: true, error: 'Start Date changed.' })));
    vi.stubGlobal('fetch', fetcher);
    render(<Harness />);
    fireEvent.click(screen.getByText('Fill Rx Entry fields'));
    fireEvent.click(screen.getByRole('button', { name: 'Read Rx Entry fields' }));
    fireEvent.change(await screen.findByLabelText(/Quantity/), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value: '11/25/2026' } });
    const approved = screen.getByLabelText(/reviewed these draft values/);
    const fill = screen.getByRole('button', { name: 'Fill reviewed Rx Entry fields' }) as HTMLButtonElement;
    expect(fill.disabled).toBe(true);
    fireEvent.click(approved);
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '9' } });
    expect(fill.disabled).toBe(true);
    fireEvent.click(approved);
    fireEvent.click(fill);
    await screen.findByText(/Read back before stopping: Quantity/);
    expect(fetcher.mock.calls[1][0]).toBe('/connector/desktop/fill');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      token: 'draft-token', pon: 'PON-B', values: { quantity: '9', startDate: '11/25/2026' }, matched: true, approved: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps sending available without detected metadata and identifies a chosen field before a separate send', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(found))).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, verified: true, next: found })));
    vi.stubGlobal('fetch', fetcher); render(<Harness />);
    fireEvent.click(screen.getByLabelText(/I matched this patient, drug and PON/));
    const send = screen.getByRole('button', { name: 'Send approved SIG to Framework' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false); fireEvent.click(send);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toBe('/connector/desktop/target');
    await screen.findByText(/Current Framework SIG: OLD/);
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/send'))).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher.mock.calls[1][0]).toBe('/connector/desktop/send');
  });
});
