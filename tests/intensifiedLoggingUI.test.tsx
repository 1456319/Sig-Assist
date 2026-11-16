import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntensifiedLogging } from '../src/components/IntensifiedLogging';
import { INTENSIFIED_REMOVAL_MARKER } from '../src/lib/diagnostics/intensifiedLogging';
beforeEach(() => document.head.insertAdjacentHTML('beforeend', '<meta name="sig-assist-local-connector" content="pilot-v1">'));
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); document.querySelector('meta[name="sig-assist-local-connector"]')?.remove(); });

it('exposes opt-in recording from the first screen, marks removal priority, and saves its bundle in the connector folder', async () => {
  let active = false; let started = false;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const action = String(input).split('/').pop(); if (action === 'start') { active = true; started = true; } if (action === 'stop') active = false;
    return new Response(JSON.stringify({ ok: true, active, configured: true, ...(started ? { sessionId: 'synthetic-session', directory: 'Z:\\Synthetic Recording Root\\session', workflowEvents: 8 } : {}), ...(action === 'bundle' ? { bundleFile: 'synthetic-review.jsonl' } : {}) }), { headers: { 'Content-Type': 'application/json' } });
  });
  render(<IntensifiedLogging screen="queue" />);
  expect(screen.getByText(/REMOVAL PRIORITY: HIGH/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Open recording controls' }));
  expect(screen.getByText(INTENSIFIED_REMOVAL_MARKER)).toBeTruthy();
  await waitFor(() => expect((screen.getByRole('button', { name: 'Start pilot recording' }) as HTMLButtonElement).disabled).toBe(false));
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/start'))).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Start pilot recording' }));
  await screen.findByText(/RECORDING$/); expect(screen.getByText(/Recording folder: Z:/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Stop and save recording' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Start pilot recording' }) as HTMLButtonElement).disabled).toBe(false));
  await userEvent.click(screen.getByRole('button', { name: 'Save review bundle in recording folder' }));
  expect(await screen.findByText(/Review bundle saved inside the recording folder: synthetic-review.jsonl/)).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/bundle'))).toBe(true);
});

it('keeps start disabled with an explanation when the intended recording root is not configured', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, active: false, configured: false })));
  render(<IntensifiedLogging screen="queue" />); await userEvent.click(screen.getByRole('button', { name: 'Open recording controls' }));
  expect(await screen.findByText(/Recording destination is not configured/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Start pilot recording' }) as HTMLButtonElement).disabled).toBe(true);
});

it('does not probe a standalone HTTP demo server for logging endpoints', async () => {
  document.querySelector('meta[name="sig-assist-local-connector"]')?.remove();
  const fetchMock = vi.spyOn(globalThis, 'fetch'); render(<IntensifiedLogging screen="queue" />);
  await userEvent.click(screen.getByRole('button', { name: 'Open recording controls' }));
  expect(await screen.findByText(/Open Start-Iguana-Connector.bat from this build/)).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});
