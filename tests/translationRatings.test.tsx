import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiscrepancyReport } from '../src/lib/clinical/types';
import { mergeDiscrepancyReports } from '../src/lib/discrepancyDatabase';
import { TranslationRating } from '../src/components/TranslationRating';
import { TranslationFeedbackQueue } from '../src/components/TranslationFeedbackQueue';
import { feedbackKey, feedbackState, type TranslationFeedbackSnapshot } from '../src/lib/translationFeedbackModel';
import { captureFeedbackCorrection, pendingFeedback, retryTranslationFeedback, saveTranslationFeedback } from '../src/lib/translationFeedback';

const mock = vi.hoisted(() => ({ rows: [] as DiscrepancyReport[], fail: false }));
vi.mock('../src/lib/citrixStorage', () => ({ getCitrixStorageAdapter: () => ({
  readDiscrepancies: async () => mock.rows,
  appendDiscrepancy: async (report: DiscrepancyReport) => { if (mock.fail) throw new Error('disk unavailable'); mock.rows = mergeDiscrepancyReports(mock.rows, [report]); },
}) }));
let serial = 0;
const input = (): TranslationFeedbackSnapshot => ({ orderKey: `synthetic-${++serial}`, pon: 'SYNTHETIC', drugName: 'METFORMIN 500 MG TABLET',
  rawProse: 'Take 1 tablet by mouth daily', generatedSig: '1T PO QD.', presentedSig: '1T PO QD.', currentDraft: '1T PO QD.',
  context: { source: 'queue', revision: 1, exclusions: [{ kind: 'code', value: 'DAILY', replacement: 'QD' }] } });
beforeEach(() => { mock.rows = []; mock.fail = false; });
afterEach(async () => { cleanup(); mock.fail = false; await retryTranslationFeedback(); vi.restoreAllMocks(); });

describe('optional translation ratings', () => {
  it('creates no report or pending evidence for an ignored rating or a fresh ten', async () => {
    render(<TranslationRating input={input()} />);
    expect(mock.rows).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Rate translation 10 out of 10' }));
    await screen.findByText('Thanks — no discrepancy created.');
    expect(mock.rows).toHaveLength(0); expect(pendingFeedback()).toHaveLength(0);
  });
  it.each([6, 9])('saves score %i immediately without requiring a correction or comment', async rating => {
    const source = input();
    render(<TranslationRating input={source} />);
    fireEvent.click(screen.getByRole('button', { name: `Rate translation ${rating} out of 10` }));
    await waitFor(() => expect(mock.rows).toHaveLength(1));
    expect(feedbackState(mock.rows[0]).rating).toBe(rating);
    expect(mock.rows[0].notes).toBe('');
    expect(mock.rows[0].translationFeedback?.original.context?.exclusions).toEqual(source.context?.exclusions);
    expect(screen.getByRole('button', { name: 'The error is obvious' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I will explain the error later' })).toBeNull();
  });
  it.each([1, 5])('offers all four low-rating choices at score %i', async rating => {
    render(<TranslationRating input={input()} />);
    fireEvent.click(screen.getByRole('button', { name: `Rate translation ${rating} out of 10` }));
    for (const choice of ["I don't want to explain the error", 'I will briefly describe the error', 'I will give an in-depth explanation of the error', 'I will explain the error later']) expect(screen.getByRole('button', { name: choice })).toBeTruthy();
    await waitFor(() => expect(mock.rows).toHaveLength(1));
  });
  it('keeps the original suggestion and exclusions, associates later edits, and retains an earlier failure after a ten', async () => {
    const source = input();
    await saveTranslationFeedback(source, { kind: 'rating', rating: 9 });
    source.context!.exclusions![0] = { kind: 'code', value: 'CHANGED' };
    const frozen = mock.rows[0].translationFeedback!.original;
    const corrected = { ...frozen, currentDraft: '1T PO QD' };
    expect(feedbackKey(corrected)).toBe(feedbackKey(frozen));
    captureFeedbackCorrection(corrected, corrected.currentDraft);
    await waitFor(() => expect(mock.rows[0].technicianSig).toBe('1T PO QD'));
    await saveTranslationFeedback(corrected, { kind: 'rating', rating: 10 });
    expect(mock.rows[0].translationFeedback!.events.map(e => e.kind)).toEqual(['rating', 'corrected_copy', 'rating']);
    expect(mock.rows[0].translationFeedback!.original.presentedSig).toBe('1T PO QD.');
    expect(mock.rows[0].translationFeedback!.original.context!.exclusions![0].value).toBe('DAILY');
  });
  it('isolates revisions and split parts, but keeps a rating through a manual draft edit', async () => {
    const source = input();
    const host = render(<TranslationRating input={source} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate translation 9 out of 10' }));
    await waitFor(() => expect(mock.rows).toHaveLength(1));
    host.rerender(<TranslationRating input={{ ...source, currentDraft: 'EDITED' }} />);
    expect(screen.getByRole('button', { name: 'Rate translation 9 out of 10' }).getAttribute('aria-pressed')).toBe('true');
    await saveTranslationFeedback({ ...source, partId: 'second' }, { kind: 'rating', rating: 5 });
    await saveTranslationFeedback({ ...source, context: { ...source.context!, revision: 2 } }, { kind: 'rating', rating: 4 });
    expect(mock.rows).toHaveLength(3);
  });
  it('retains a brief explanation when the technician immediately moves to another order', async () => {
    const source = input();
    const host = render(<TranslationRating input={source} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate translation 9 out of 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'I will briefly explain the error' }));
    fireEvent.change(screen.getByLabelText('Translation error explanation'), { target: { value: 'Extra period at the end' } });
    host.unmount();
    await waitFor(() => expect(mock.rows[0]?.notes).toBe('Extra period at the end'));
    expect(mock.rows[0].translationFeedback!.events.some(e => e.kind === 'comment' && e.resolved === false)).toBe(true);
    expect(mock.rows[0].translationFeedback!.original.rawProse).toBe(source.rawProse);
  });
  it('preserves modes/comments following a failed initial rating and retries without duplicate history', async () => {
    const source = input(); mock.fail = true;
    await expect(saveTranslationFeedback(source, { kind: 'rating', rating: 3 })).rejects.toThrow();
    await expect(saveTranslationFeedback(source, { kind: 'explanation', mode: 'later' })).rejects.toThrow();
    expect(pendingFeedback().length).toBeGreaterThanOrEqual(2);
    mock.fail = false; await retryTranslationFeedback();
    expect(mock.rows).toHaveLength(1);
    expect(mock.rows[0].translationFeedback!.events).toHaveLength(2);
    expect(feedbackState(mock.rows[0]).deferred).toBe(true);
    expect(pendingFeedback()).toHaveLength(0);
    const stale = { ...mock.rows[0], storageUpdatedAt: '2100-01-01T00:00:00Z', translationFeedback: { ...mock.rows[0].translationFeedback!, events: mock.rows[0].translationFeedback!.events.slice(0, 1) } };
    expect(mergeDiscrepancyReports(mock.rows, [stale])[0].translationFeedback!.events).toHaveLength(2);
  });
  it('reopens a deferred source without live intake and preserves retranslation and explanation iterations', async () => {
    const source = input();
    await saveTranslationFeedback(source, { kind: 'rating', rating: 4 });
    await saveTranslationFeedback(source, { kind: 'explanation', mode: 'later' });
    render(<TranslationFeedbackQueue />);
    await screen.findByText(/1 deferred explanations/);
    fireEvent.click(screen.getByRole('button', { name: 'Retranslate saved source with current engine' }));
    await waitFor(() => expect(mock.rows[0].translationFeedback!.events.some(e => e.kind === 'retranslation')).toBe(true));
    fireEvent.change(screen.getByRole('textbox', { name: 'Explanation for SYNTHETIC' }), { target: { value: 'Extra period only.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save explanation and finish' }));
    await waitFor(() => expect(feedbackState(mock.rows[0]).resolved).toBe(true));
    expect(mock.rows[0].translationFeedback!.original.presentedSig).toBe('1T PO QD.');
    expect(mock.rows[0].translationFeedback!.events).toHaveLength(4);
  });
});
