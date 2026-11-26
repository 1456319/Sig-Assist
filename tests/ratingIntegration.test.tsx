import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSession } from '../src/components/ReviewSession';
import { OrderQueueView } from '../src/components/OrderQueueView';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';
import { feedbackState } from '../src/lib/translationFeedbackModel';

beforeEach(() => { localStorage.clear(); _resetCitrixStorageAdapterForTesting(); });
afterEach(() => { cleanup(); _resetCitrixStorageAdapterForTesting(); vi.restoreAllMocks(); });

it('archives a real Queue rating, preserves the source/exclusions and later copied correction through the storage adapter', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<ReviewSession><OrderQueueView /></ReviewSession>);
  await waitFor(async () => expect(await getCitrixStorageAdapter().readQueue()).toEqual([]));
  fireEvent.click(screen.getByText('Add an order manually (optional)'));
  fireEvent.click(screen.getByRole('button', { name: 'Fill synthetic example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
  const draft = screen.getByLabelText('Final SIG · editable, uppercase') as HTMLTextAreaElement;
  const suggested = draft.value;
  fireEvent.click(screen.getByRole('button', { name: 'Rate translation 9 out of 10' }));
  await screen.findByText('Feedback saved. Continue processing.');
  const [report] = await getCitrixStorageAdapter().readDiscrepancies();
  expect(report.translationFeedback?.original.context?.source).toBe('queue');
  expect(report.translationFeedback?.original.presentedSig).toBe(suggested);
  expect(report.rawProse).toBeTruthy(); expect(report.drugName).toBeTruthy();
  expect(feedbackState(report).rating).toBe(9);
  fireEvent.change(draft, { target: { value: 'SYNTHETIC TECH CORRECTION' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I matched the order and checked/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy reviewed SIG' }));
  await waitFor(async () => expect((await getCitrixStorageAdapter().readDiscrepancies())[0].technicianSig).toBe('SYNTHETIC TECH CORRECTION'));
  expect(writeText).toHaveBeenCalledWith('SYNTHETIC TECH CORRECTION');
});

it('archives Workbench parser evidence and an optional deferred rating without a separate discrepancy form', async () => {
  render(<ReviewSession><WorkbenchView /></ReviewSession>);
  await screen.findByText('0 saved discrepancy reports');
  fireEvent.change(screen.getByPlaceholderText('e.g. Lisinopril 10mg'), { target: { value: 'SYNTHETIC METFORMIN 500MG TABLET' } });
  fireEvent.change(screen.getByPlaceholderText(/Enter free text SIG/), { target: { value: 'Take 1 tablet by mouth daily for diabetes' } });
  await screen.findByLabelText('Final SIG · editable, uppercase');
  fireEvent.click(screen.getByRole('button', { name: 'Rate translation 4 out of 10' }));
  fireEvent.click(screen.getByRole('button', { name: 'I will explain the error later' }));
  await waitFor(async () => expect(feedbackState((await getCitrixStorageAdapter().readDiscrepancies())[0]).deferred).toBe(true));
  const [report] = await getCitrixStorageAdapter().readDiscrepancies();
  expect(report.translationFeedback?.original.context?.source).toBe('workbench');
  expect(report.translationFeedback?.original.context?.diagnostics).toHaveProperty('parserSteps');
  expect(report.rawProse).toBe('Take 1 tablet by mouth daily for diabetes');
});
