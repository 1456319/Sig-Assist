import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DiscrepancyReport } from '../src/lib/clinical/types';
import { mergeDiscrepancyReports } from '../src/lib/discrepancyDatabase';
import { browserRecords } from '../src/lib/browserDatabase';
import { feedbackState, type TranslationFeedbackSnapshot } from '../src/lib/translationFeedbackModel';
const mock = vi.hoisted(() => ({ rows: [] as DiscrepancyReport[], fail: false }));
vi.mock('../src/lib/citrixStorage', () => ({ getCitrixStorageAdapter: () => ({
  readDiscrepancies: async () => mock.rows,
  appendDiscrepancy: async (r: DiscrepancyReport) => { if (mock.fail) throw new Error('down'); mock.rows = mergeDiscrepancyReports(mock.rows, [r]); },
}) }));
const base: TranslationFeedbackSnapshot = { orderKey: 'syn-split', pon: 'SYN-S', drugName: 'SYN', rawProse: 'Take 1 tab daily then 2 tabs daily',
  generatedSig: '1T QD', presentedSig: '1T QD', currentDraft: '1T QD ORIGINAL', presentationBuildId: 'b', context: { source: 'queue', revision: 1 } };
const p1 = { ...base, partId: 'p1' }, p2 = { ...base, partId: 'p2', presentedSig: '2T QD', generatedSig: '2T QD' };
beforeEach(async () => { mock.rows = []; mock.fail = false; vi.resetModules(); const store = browserRecords('sig-assist-rating-outbox-v1'); for (const [key] of await store.entries()) await store.remove(key); });
it('reload low->10 on part1 only; part2 fresh 10 ignored; original kept; repeated retry idempotent', async () => {
  await browserRecords('sig-assist-rating-outbox-v1').put('j1', { id: 'j1', at: '2026-11-27T00:00:00.000Z', order: 1, input: p1,
    event: { kind: 'rating', rating: 3, draft: p1.currentDraft }, appVersion: 'o', buildId: 'o' });
  const f = await import('../src/lib/translationFeedback');
  expect(await f.saveTranslationFeedback(p2, { kind: 'rating', rating: 10, draft: p2.currentDraft })).toBeUndefined();
  await f.saveTranslationFeedback({ ...p1, currentDraft: 'EDITED' }, { kind: 'rating', rating: 10, draft: 'EDITED' });
  await f.retryTranslationFeedback(); await f.retryTranslationFeedback();
  expect(mock.rows).toHaveLength(1);
  const r = mock.rows[0]!;
  expect(r.translationFeedback!.original.partId).toBe('p1');
  expect(r.translationFeedback!.original.currentDraft).toBe('1T QD ORIGINAL');
  expect(r.translationFeedback!.events.map(e => e.rating)).toEqual([3, 10]);
  expect(feedbackState(r).rating).toBe(10);
  expect(r.technicianSig).toBe('EDITED');
  expect(f.pendingFeedback()).toHaveLength(0);
});
it('storage down then recovers: no duplicate events', async () => {
  const f = await import('../src/lib/translationFeedback');
  mock.fail = true;
  await expect(f.saveTranslationFeedback(p1, { kind: 'rating', rating: 4 })).rejects.toThrow();
  await f.saveTranslationFeedback(p1, { kind: 'rating', rating: 10 }).catch(() => {});
  mock.fail = false;
  await f.retryTranslationFeedback(); await f.retryTranslationFeedback();
  expect(mock.rows).toHaveLength(1);
  expect(mock.rows[0]!.translationFeedback!.events.map(e => e.rating)).toEqual([4, 10]);
  expect(f.pendingFeedback()).toHaveLength(0);
});
