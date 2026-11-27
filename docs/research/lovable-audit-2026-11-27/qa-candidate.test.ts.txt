import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DiscrepancyReport } from '../src/lib/clinical/types';
import { mergeDiscrepancyReports } from '../src/lib/discrepancyDatabase';
import { browserRecords } from '../src/lib/browserDatabase';
import { feedbackState, type TranslationFeedbackSnapshot } from '../src/lib/translationFeedbackModel';

const mock = vi.hoisted(() => ({ rows: [] as DiscrepancyReport[] }));
vi.mock('../src/lib/citrixStorage', () => ({ getCitrixStorageAdapter: () => ({
  readDiscrepancies: async () => mock.rows,
  appendDiscrepancy: async (report: DiscrepancyReport) => { mock.rows = mergeDiscrepancyReports(mock.rows, [report]); },
}) }));
const snapshot: TranslationFeedbackSnapshot = { orderKey: 'synthetic-reload', pon: 'SYN-RELOAD', drugName: 'SYNTHETIC TABLET',
  rawProse: 'Take 1 tablet by mouth daily', generatedSig: '1T PO QD.', presentedSig: '1T PO QD.', currentDraft: '1T PO QD.',
  presentationBuildId: 'synthetic-build', context: { source: 'queue', revision: 1 } };
beforeEach(() => { mock.rows = []; vi.resetModules(); });

it('a ten chosen right after a cold reload supersedes an unsaved earlier low rating', async () => {
  // Previous page session: rating 3 reached the outbox but not reports.
  await browserRecords('sig-assist-rating-outbox-v1').put('old-job', { id: 'old-job', at: '2026-11-27T00:00:00.000Z', order: 1,
    input: snapshot, event: { kind: 'rating', rating: 3, draft: snapshot.currentDraft }, appVersion: 'old', buildId: 'old' });
  const feedback = await import('../src/lib/translationFeedback');
  // Technician changes the score to 10 before any outbox load has finished.
  await feedback.saveTranslationFeedback(snapshot, { kind: 'rating', rating: 10, draft: snapshot.currentDraft });
  await feedback.retryTranslationFeedback();
  expect(mock.rows).toHaveLength(1);
  expect(mock.rows[0]!.translationFeedback!.events.map(e => e.rating)).toEqual([3, 10]);
  expect(feedbackState(mock.rows[0]!).rating).toBe(10);
});
