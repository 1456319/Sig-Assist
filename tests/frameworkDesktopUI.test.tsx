import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FrameworkTransfer } from '../src/components/FrameworkDesktop';
import type { FrameworkDetection } from '../src/lib/frameworkDesktop';

const found: FrameworkDetection = { ok: true, pons: ['PON-A', 'PON-B'], token: 'synthetic-token', expiresAt: Date.now() + 300000, fields: { sig: { label: 'SIG', currentValue: 'OLD' } } };
function Harness({ initial }: { initial?: FrameworkDetection }) {
  const [detected, setDetected] = useState(initial);
  return <FrameworkTransfer detected={detected} pon="PON-B" sig="APPROVED SIG" blocked={undefined} times={['0900']} onDetected={setDetected} />;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('technician-controlled Framework sending', () => {
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
