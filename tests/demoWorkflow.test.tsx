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

it.each([
  ['Insulin Lispro Injection 100 UNIT/ML', 'Inject as per sliding scale: 150-199=1 unit;200-349=2 units;greater than or equals 350 give 5 units, subcutaneously at bedtime for DM', 'CBS QHS SS 150-199=1U;200-349=2U;350+=5U SQ FDM'],
  ['MiraLax Oral Packet 17 GM', 'Give 1 packet by mouth daily for constipation. Mixed in 4-8 oz fluid of choice. Hold for loose stools', 'MIX 17 GM (1 PACKET) IN 4-8OZ OF FOC AND GIVE PO QD FCON (H LS)'],
])('keeps the reviewed %s suggestion editable through the actual queue', async (drug, directions, expected) => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  render(<ReviewSession><OrderQueueView /></ReviewSession>);
  await waitFor(async () => expect(await getCitrixStorageAdapter().readQueue()).toEqual([]));
  fireEvent.click(screen.getByText('Add an order manually (optional)'));
  fireEvent.click(screen.getByRole('button', { name: 'Fill synthetic example' }));
  fireEvent.change(screen.getByLabelText('Drug / strength as ordered'), { target: { value: drug } });
  fireEvent.change(screen.getByLabelText('Original nurse directions'), { target: { value: directions } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
  const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
  expect(draft.value).toBe(expected);
  const copy = screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement;
  expect(copy.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /I matched the order/ }));
  fireEvent.click(copy);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
  fireEvent.change(draft, { target: { value: `${expected} (VERIFIED)` } });
  expect(draft.value).toBe(`${expected} (VERIFIED)`);
  expect(copy.disabled).toBe(true);
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
