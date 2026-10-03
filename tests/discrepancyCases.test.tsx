import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewSession } from '../src/components/ReviewSession';
import { OrderQueueView } from '../src/components/OrderQueueView';
import { DiscrepancyPanel } from '../src/components/DiscrepancyPanel';
import { DiscrepancyArchive } from '../src/components/DiscrepancyArchive';
import { WorkbenchView } from '../src/components/WorkbenchView';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';
import { exportDiscrepancyCases } from '../src/lib/discrepancyCases';

beforeEach(() => {
  localStorage.clear();
  _resetCitrixStorageAdapterForTesting();
});
afterEach(() => {
  cleanup();
  _resetCitrixStorageAdapterForTesting();
  vi.restoreAllMocks();
});

it('captures the original and edited Queue SIG separately, persists after reload, and exports all cases without changing review', async () => {
  const ui = <ReviewSession><OrderQueueView /></ReviewSession>;
  let host = render(ui);
  await screen.findByText('0 saved discrepancy reports');
  fireEvent.click(screen.getByText('Add an order manually (optional)'));
  fireEvent.click(screen.getByRole('button', { name: 'Fill synthetic example' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
  const draft = screen.getByLabelText('Final SIG · editable, uppercase');
  fireEvent.change(draft, { target: { value: '1t po bid x7d with food' } });
  fireEvent.click(screen.getByRole('button', { name: /Flag Discrepancy/ }));
  expect((screen.getByLabelText('Technician Preferred / Corrected SIG:') as HTMLTextAreaElement).value).toBe('1T PO BID X7D WITH FOOD');
  fireEvent.change(screen.getByLabelText('Notes / Rationale:'), { target: { value: 'Synthetic comparison case.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  await screen.findByText('1 saved discrepancy reports');
  expect((screen.getByRole('button', { name: 'Copy reviewed SIG' }) as HTMLButtonElement).disabled).toBe(true);
  const [report] = await getCitrixStorageAdapter().readDiscrepancies();
  expect(report.generatedSig).toBe('1T PO BID X7D');
  expect(report.technicianSig).toBe('1T PO BID X7D WITH FOOD');
  expect(report.rawProse).toBe('Take 1 tablet by mouth twice daily for 7 days.');
  expect(report.context?.source).toBe('queue');
  expect(report.context?.revision).toBe(1);
  expect(report.buildId).toMatch(/^[a-f0-9]{64}$/);
  await getCitrixStorageAdapter().flushPendingWrites();
  host.unmount();
  _resetCitrixStorageAdapterForTesting();
  host = render(ui);
  await screen.findByText('1 saved discrepancy reports');
  const bundle = await exportDiscrepancyCases();
  expect(bundle.caseCount).toBe(1);
  expect(bundle.redacted).toBe(false);
  expect(bundle.reports).toEqual([report]);
  // Removing orders must not remove the separate case archive.
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear orders' }));
  await getCitrixStorageAdapter().flushPendingWrites();
  expect((await exportDiscrepancyCases()).reports).toEqual([report]);
});

it('never reports success on a storage failure and retains the correction for retry', async () => {
  const adapter = getCitrixStorageAdapter();
  const save = vi.spyOn(adapter, 'appendDiscrepancy').mockRejectedValueOnce(new Error('storage full'));
  const onSaved = vi.fn();
  render(<><DiscrepancyArchive /><DiscrepancyPanel pon="CASE-FAIL" drugName="Synthetic drug" rawProse="Original directions" generatedSig="DRAFT" isOpen onDiscrepancySaved={onSaved} /></>);
  fireEvent.change(screen.getByLabelText('Technician Preferred / Corrected SIG:'), { target: { value: 'corrected' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save Discrepancy Report' }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByText('Discrepancy saved locally')).toBeNull();
  expect((screen.getByLabelText('Technician Preferred / Corrected SIG:') as HTMLTextAreaElement).value).toBe('CORRECTED');
  expect(await adapter.readDiscrepancies()).toEqual([]);
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  await screen.findByText('1 saved discrepancy reports');
  expect((await adapter.readDiscrepancies())[0].technicianSig).toBe('CORRECTED');
});

it('rejects an empty report, permits notes-only cases and includes older reports in the export', async () => {
  const saved = vi.fn();
  render(<DiscrepancyPanel pon="CASE-NOTES" drugName="Synthetic drug" rawProse="Ambiguous directions" generatedSig="DRAFT" isOpen onDiscrepancySaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  expect(await getCitrixStorageAdapter().readDiscrepancies()).toEqual([]);
  await expect(exportDiscrepancyCases()).rejects.toThrow('No discrepancy reports');
  fireEvent.change(screen.getByLabelText('Notes / Rationale:'), { target: { value: 'Needs investigation; expected SIG not established.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  await screen.findByText('Discrepancy saved locally');
  const oldReport = { id: 'legacy', timestamp: '2026-09-18', pon: 'OLD', drugName: 'Synthetic', rawProse: 'Original', generatedSig: 'DRAFT', technicianSig: 'EXPECTED', notes: '', flaggedForRph: false };
  await getCitrixStorageAdapter().appendDiscrepancy(oldReport, { immediate: true });
  const bundle = await exportDiscrepancyCases();
  expect(bundle.caseCount).toBe(2);
  expect(bundle.reports[0].technicianSig).toBe('');
  expect(bundle.reports[1]).toEqual(oldReport);
});

it('clears every Workbench entry and draft while retaining the saved discrepancy archive', async () => {
  render(<ReviewSession><WorkbenchView /></ReviewSession>);
  await screen.findByText('0 saved discrepancy reports');
  const drug = screen.getByPlaceholderText('e.g. Lisinopril 10mg');
  const template = screen.getByPlaceholderText('e.g. Take 1 tablet daily');
  const directions = screen.getByPlaceholderText(/Enter free text SIG/);
  fireEvent.change(drug, { target: { value: 'PANTOPRAZOLE PWD PACKET 40MG' } });
  fireEvent.change(template, { target: { value: 'GIVE 1 PACKET PO' } });
  fireEvent.change(directions, { target: { value: 'Give 40 mg by mouth twice daily for GERD' } });
  await screen.findByLabelText('Final SIG · editable, uppercase');
  fireEvent.click(screen.getByRole('button', { name: /Flag Discrepancy/ }));
  fireEvent.change(screen.getByLabelText('Notes / Rationale:'), { target: { value: 'Synthetic clear-fields regression.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Discrepancy Report' }));
  await screen.findByText('1 saved discrepancy reports');
  const before = await exportDiscrepancyCases();
  fireEvent.click(screen.getByRole('button', { name: 'Clear all fields' }));
  for (const field of [drug, template, directions]) expect((field as HTMLInputElement).value).toBe('');
  expect(screen.queryByLabelText('Final SIG · editable, uppercase')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Copy reviewed SIG' })).toBeNull();
  expect((await exportDiscrepancyCases()).reports).toEqual(before.reports);
});
