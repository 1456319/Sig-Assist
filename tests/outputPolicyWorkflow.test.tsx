import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSession } from '../src/components/ReviewSession';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { OrderQueueView } from '../src/components/OrderQueueView';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';

beforeEach(() => { localStorage.clear(); _resetCitrixStorageAdapterForTesting(); });
afterEach(() => { cleanup(); _resetCitrixStorageAdapterForTesting(); vi.restoreAllMocks(); });
const value = (field: HTMLElement) => (field as HTMLTextAreaElement).value;
function exclude(code: string) {
  fireEvent.change(screen.getByLabelText('SIG code to exclude'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Exclude code' }));
}
it('updates an unedited Workbench draft immediately, preserves technician edits and saves restrictions for reload', async () => {
  const host = render(<ReviewSession><WorkbenchView /></ReviewSession>);
  await screen.findByText('0 saved discrepancy reports');
  fireEvent.change(screen.getByPlaceholderText('e.g. Lisinopril 10mg'), { target: { value: 'EXAMPLE TAB' } });
  fireEvent.change(screen.getByPlaceholderText(/Enter free text SIG/), { target: { value: 'Give 1 tablet by mouth daily' } });
  const draft = await screen.findByLabelText('Final SIG · editable, uppercase');
  expect(value(draft)).toBe('1T PO QD');
  exclude('QD');
  await waitFor(() => expect(value(draft)).toBe('1T PO ONE TIME A DAY'));
  fireEvent.change(draft, { target: { value: '1T PO ONE TIME A DAY WITH FOOD' } });
  exclude('PO');
  await screen.findAllByText('1T BY MOUTH ONE TIME A DAY', { selector: 'p' });
  expect(value(draft)).toBe('1T PO ONE TIME A DAY WITH FOOD');
  expect((screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Use calculated suggestion' }));
  expect(value(draft)).toBe('1T BY MOUTH ONE TIME A DAY');
  await waitFor(async () => expect((await getCitrixStorageAdapter().readPreferences()).exclusions).toHaveLength(2));
  await getCitrixStorageAdapter().flushPendingWrites();
  host.unmount();
  _resetCitrixStorageAdapterForTesting();
  render(<ReviewSession><OrderQueueView /></ReviewSession>);
  await screen.findByText('0 saved discrepancy reports');
  fireEvent.click(screen.getByText('Add an order manually (optional)'));
  fireEvent.click(screen.getByRole('button', { name: 'Fill synthetic example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
  expect(value(await screen.findByLabelText('Final SIG · editable, uppercase'))).toBe('1T BY MOUTH BID X7D');
});
