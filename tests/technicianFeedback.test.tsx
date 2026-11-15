import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TechnicianFeedback } from '../src/components/TechnicianFeedback';
import { AppLayout } from '../src/components/AppLayout';
import { ReviewSession } from '../src/components/ReviewSession';
import { getCitrixStorageAdapter, _resetCitrixStorageAdapterForTesting } from '../src/lib/citrixStorage';
import type { TechnicianFeedback as FeedbackReport } from '../src/lib/feedbackTypes';

beforeEach(() => { localStorage.clear(); _resetCitrixStorageAdapterForTesting(); });
afterEach(() => { cleanup(); _resetCitrixStorageAdapterForTesting(); vi.restoreAllMocks(); });

it('offers feedback on the first screen with no order and saves a general comment', async () => {
  render(<ReviewSession><AppLayout /></ReviewSession>);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  fireEvent.change(screen.getByLabelText('Comments / what you changed (optional)'), { target: { value: 'Finding the server port was tedious.' } });
  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'connection' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  await screen.findByText(/Feedback saved in this browser/);
  const [report] = await getCitrixStorageAdapter().readFeedback();
  expect(report).toMatchObject({ category: 'connection', acceptable: 'not-rated', screen: 'queue', comment: 'Finding the server port was tedious.', appVersion: __SIG_ASSIST_VERSION__ });
  expect(report.buildId).toMatch(/^[a-f0-9]{64}$/);
  expect(report.diagnostics?.marker).toContain('REVIEW_BEFORE_PRODUCTION');
  expect(await getCitrixStorageAdapter().readQueue()).toEqual([]);
});

it('records yes after correction, severity, occurrence time and optional rationale without approving an order', async () => {
  render(<TechnicianFeedback screen="workbench" />);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Yes', exact: true }));
  fireEvent.change(screen.getByLabelText('How did it meet your needs?'), { target: { value: 'after-correction' } });
  fireEvent.change(screen.getByLabelText('Impact'), { target: { value: 'slowed-work' } });
  fireEvent.change(screen.getByLabelText('Comments / what you changed (optional)'), { target: { value: 'Acceptable after restoring the missing instruction.' } });
  fireEvent.change(screen.getByLabelText('When did this happen?'), { target: { value: '2026-11-15T09:15' } });
  fireEvent.change(screen.getByLabelText('Estimated minutes lost (optional)'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  await screen.findByRole('button', { name: 'Feedback saved' });
  const [report] = await getCitrixStorageAdapter().readFeedback();
  expect(report).toMatchObject({ acceptable: 'yes', quality: 'after-correction', impact: 'slowed-work', minutesLost: 3, observedAt: new Date('2026-11-15T09:15').toISOString() });
  expect(await getCitrixStorageAdapter().readDiscrepancies()).toEqual([]);
});

it('keeps a failed save available for retry and permits a no answer without mandatory comments', async () => {
  const adapter = getCitrixStorageAdapter();
  const save = vi.spyOn(adapter, 'appendFeedback').mockRejectedValueOnce(new Error('synthetic storage failure'));
  render(<TechnicianFeedback screen="dictionary" />);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  fireEvent.click(screen.getByRole('radio', { name: 'No', exact: true }));
  fireEvent.change(screen.getByLabelText('Comments / what you changed (optional)'), { target: { value: 'Custom codes disappeared after reopening.' } });
  fireEvent.click(screen.getByLabelText(/Include troubleshooting details/));
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Your entries are still here');
  expect((screen.getByLabelText('Comments / what you changed (optional)') as HTMLTextAreaElement).value).toContain('Custom codes');
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  await screen.findByRole('button', { name: 'Feedback saved' });
  expect(save).toHaveBeenCalledTimes(2);
  const reports = await adapter.readFeedback();
  expect(reports).toHaveLength(1);
  expect(reports[0].diagnostics).toBeUndefined();
  cleanup();
  _resetCitrixStorageAdapterForTesting();
  render(<TechnicianFeedback screen="queue" />);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  await screen.findByText('1 saved reports');
});

it('validates an empty report and exports saved reports with their original answers and comments', async () => {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((b: Blob) => { blobs.push(b); return 'blob:feedback-test'; }) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<TechnicianFeedback screen="queue" />);
  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Choose Yes or No');
  fireEvent.click(screen.getByRole('radio', { name: 'Yes', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Save feedback locally' }));
  await screen.findByRole('button', { name: 'Feedback saved' });
  fireEvent.click(screen.getByRole('button', { name: 'Export saved feedback' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blobs[0]); });
  expect(JSON.parse(text)).toMatchObject({ commentsRedacted: false, reportCount: 1, reports: [{ acceptable: 'yes', quality: 'as-shown', comment: '' }] });
});

function sampleReport(id: string): FeedbackReport {
  return { schemaVersion: 1, id, timestamp: new Date().toISOString(), observedAt: new Date().toISOString(), appVersion: 'test', buildId: 'test', screen: 'queue', category: 'general', acceptable: 'yes', quality: 'as-shown', impact: 'none', comment: id };
}

it('serializes concurrent appends, survives reload and never overwrites a corrupt archive', async () => {
  const adapter = getCitrixStorageAdapter();
  await Promise.all([adapter.appendFeedback(sampleReport('one')), adapter.appendFeedback(sampleReport('two'))]);
  _resetCitrixStorageAdapterForTesting();
  expect((await getCitrixStorageAdapter().readFeedback()).map(r => r.id)).toEqual(['one', 'two']);
  localStorage.setItem('citrix_storage_feedback_v1', '{broken');
  await expect(getCitrixStorageAdapter().appendFeedback(sampleReport('three'))).rejects.toThrow();
  expect(localStorage.getItem('citrix_storage_feedback_v1')).toBe('{broken');
});

it('uses the connected folder, falls back to browser on a disconnected folder, then merges by report ID', async () => {
  const files = new Map<string, string>();
  let disconnected = false;
  const directory = {
    name: 'synthetic', getFileHandle: async (name: string, options?: { create?: boolean }) => {
      if (disconnected) throw new DOMException('synthetic', 'NotAllowedError');
      if (!files.has(name) && !options?.create) throw new DOMException('synthetic', 'NotFoundError');
      return { getFile: async () => ({ text: async () => files.get(name)! }), createWritable: async () => {
        let buffer = ''; return { write: async (text: string) => { buffer = text; }, close: async () => { files.set(name, buffer); } };
      } };
    },
  };
  Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => directory });
  try {
    const adapter = getCitrixStorageAdapter();
    await adapter.connectDirectory();
    expect(await adapter.appendFeedback(sampleReport('folder'))).toBe('file_system');
    disconnected = true;
    expect(await adapter.appendFeedback(sampleReport('cache'))).toBe('browser_cache');
    disconnected = false;
    expect((await adapter.readFeedback()).map(r => r.id)).toEqual(['folder', 'cache']);
    await adapter.appendFeedback(sampleReport('cache'));
    expect(JSON.parse(files.get('feedback.json')!).map((r: FeedbackReport) => r.id)).toEqual(['folder', 'cache']);
  } finally { delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker; }
});
