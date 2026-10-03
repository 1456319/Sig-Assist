import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSession } from '../src/components/ReviewSession';
import { OrderQueueView } from '../src/components/OrderQueueView';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';

beforeEach(() => {
  localStorage.clear();
  _resetCitrixStorageAdapterForTesting();
});

afterEach(() => {
  cleanup();
  _resetCitrixStorageAdapterForTesting();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('demonstrates translation, review, clipboard, saved queue recovery and clearing through the UI', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  const ui = <ReviewSession><OrderQueueView /></ReviewSession>;
  let host = render(ui);
  // Wait for initial storage hydration before entering the demo.
  await waitFor(async () => expect(await getCitrixStorageAdapter().readQueue()).toEqual([]));
  fireEvent.click(screen.getByText('Add an order manually (optional)'));
  fireEvent.click(screen.getByRole('button', { name: 'Fill synthetic example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
  const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
  expect(draft.value).toBe('1T PO BID X7D');
  const copy = screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement;
  expect(copy.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /I matched the order/ }));
  fireEvent.click(copy);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('1T PO BID X7D'));
  fireEvent.change(draft, { target: { value: '1t po bid x7d (after meals)' } });
  expect(draft.value).toBe('1T PO BID X7D (AFTER MEALS)');
  expect(copy.disabled).toBe(true);
  await getCitrixStorageAdapter().flushPendingWrites();
  host.unmount();
  _resetCitrixStorageAdapterForTesting();
  host = render(ui);
  fireEvent.click(await screen.findByText('DEMO-PON-001'));
  expect((screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement).value).toBe('1T PO BID X7D (AFTER MEALS)');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear orders' }));
  await getCitrixStorageAdapter().flushPendingWrites();
  host.unmount();
  _resetCitrixStorageAdapterForTesting();
  render(ui);
  await waitFor(async () => expect(await getCitrixStorageAdapter().readQueue()).toEqual([]));
  expect(screen.queryByText('DEMO-PON-001')).toBeNull();
});
