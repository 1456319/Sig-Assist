// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSigDatasetBatches, replaySigDataset } from '../src/lib/sigDatasetReplay';
import type { SigDatasetRecord } from '../src/lib/sigDataset';

const hash = (n: number) => n.toString(16).padStart(64, '0');
const row = (seq: number, changes: Partial<SigDatasetRecord> = {}): SigDatasetRecord => ({
  schemaVersion: 1, seq, capturedAt: '2026-11-27T12:00:00Z', appVersion: '0.1.15', buildId: hash(1),
  orderId: hash(2), sampleId: hash(seq + 10), dedupKey: hash(seq + 100), revision: 1,
  stage: 'source_received', captureKind: 'erx_source', drug: 'SYNTHETIC TABLET 25 MG', rawSig: 'Take 1 tablet by mouth daily.', ...changes,
});
const batch = (rows: unknown[], extras: unknown[] = [], afterSeq = 0, throughSeq = rows.length) => [
  { type: 'sig_dataset_batch', schemaVersion: 1, appVersion: '0.1.15', buildId: hash(1), afterSeq, throughSeq }, ...extras, ...rows,
].map(v => JSON.stringify(v)).join('\n');
const policy = (replacement = 'EVERY DAY') => ({ type: 'exclusion_policy', id: hash(9), exclusions: [{ kind: 'code', value: 'QD', replacement }] });

describe('offline JSONL dataset replay', () => {
  it('reads metadata, policy rows and observations separately with BOM, CRLF and blanks', () => {
    const text = '\uFEFF' + batch([row(41), row(42, { exclusionPolicyId: hash(9) })], [policy()], 40, 42).replace(/\n/g, '\r\n\r\n') + '\r\n';
    const parsed = parseSigDatasetBatches([text]);
    expect(parsed.issues).toEqual([]);
    expect(parsed).toMatchObject({ batches: 1, observations: 2, policySnapshots: 1 });
    expect(parsed.samples.map(s => s.record.seq)).toEqual([41, 42]);
    expect(parsed.samples[1].exclusions).toEqual(policy().exclusions);
  });
  it('replays the exact referenced saved exclusion policy', () => {
    const parsed = parseSigDatasetBatches([batch([row(1, { exclusionPolicyId: hash(9) })], [policy()])]);
    expect(replaySigDataset(parsed).results[0]).toMatchObject({ status: 'translated', result: { primarySig: '1T PO EVERY DAY' } });
  });
  it('does not substitute current defaults when a referenced policy is absent', () => {
    const parsed = parseSigDatasetBatches([batch([row(1, { exclusionPolicyId: hash(9) })])]);
    expect(parsed.samples).toEqual([]);
    expect(parsed.issues).toContainEqual({ file: 0, line: 2, code: 'missing_or_conflicting_policy' });
  });
  it('does not resolve policy references using a different batch', () => {
    const parsed = parseSigDatasetBatches([batch([row(1)], [policy()]) + '\n' + batch([row(2, { exclusionPolicyId: hash(9) })], [], 1, 2)]);
    expect(parsed.samples).toHaveLength(1);
    expect(parsed.issues.some(i => i.code === 'missing_or_conflicting_policy')).toBe(true);
  });
  it('deduplicates overlapping files by opaque identity without dropping independent sequence numbers', () => {
    const first = batch([row(1), row(2)]);
    const parsed = parseSigDatasetBatches([first, first, batch([row(1, { dedupKey: hash(999), orderId: hash(998) })])]);
    expect(parsed.issues).toEqual([]);
    expect(parsed).toMatchObject({ duplicateObservations: 2, observations: 5 });
    expect(parsed.samples).toHaveLength(3);
  });
  it('recognizes identical rows with reordered JSON keys', () => {
    const reversed = Object.fromEntries(Object.entries(row(1)).reverse());
    expect(parseSigDatasetBatches([batch([row(1)]), batch([reversed])])).toMatchObject({ duplicateObservations: 1, issues: [] });
  });
  it('rejects both versions of conflicting observations instead of silently choosing one', () => {
    const parsed = parseSigDatasetBatches([batch([row(1)]), batch([row(1, { rawSig: 'Take 2 tablets daily.' })])]);
    expect(parsed.samples).toHaveLength(0);
    expect(parsed.issues.some(i => i.code === 'conflicting_observation')).toBe(true);
  });
  it('rejects conflicting policy snapshots and affected observations', () => {
    const parsed = parseSigDatasetBatches([batch([row(1, { exclusionPolicyId: hash(9) })], [policy(), policy('QAM')])]);
    expect(parsed.samples).toEqual([]);
    expect(parsed.issues.map(i => i.code)).toEqual(['conflicting_policy', 'missing_or_conflicting_policy']);
  });
  it.each([
    ['invalid_json', '{broken'], ['invalid_row', '[]'], ['invalid_observation', JSON.stringify({ ...row(1), schemaVersion: 2 })],
    ['invalid_policy', JSON.stringify({ ...policy(), exclusions: [{ kind: 'unknown', value: 'QD' }] })],
  ])('reports %s with a line number and no source text', (code, badLine) => {
    const parsed = parseSigDatasetBatches([batch([]) + '\n' + badLine]);
    expect(parsed.issues).toContainEqual({ file: 0, line: 2, code });
    expect(JSON.stringify(parsed.issues)).not.toContain('rawSig');
  });
  it('reports truncated, unordered and out-of-range batches', () => {
    expect(parseSigDatasetBatches([batch([row(1)], [], 0, 2)]).issues.some(i => i.code === 'incomplete_or_unordered_batch')).toBe(true);
    expect(parseSigDatasetBatches([batch([row(2), row(1)])]).issues.some(i => i.code === 'incomplete_or_unordered_batch')).toBe(true);
    expect(parseSigDatasetBatches([batch([row(3)])]).issues.some(i => i.code === 'sequence_outside_batch')).toBe(true);
  });
  it('rejects missing/future headers rather than treating metadata as an order', () => {
    expect(parseSigDatasetBatches([JSON.stringify(row(1))]).issues.some(i => i.code === 'missing_batch_header')).toBe(true);
    expect(parseSigDatasetBatches([batch([row(1)]).replace('"schemaVersion":1', '"schemaVersion":2')]).samples).toEqual([]);
  });
  it('keeps passive observations separate regardless of final text or possible source matches', () => {
    const parsed = parseSigDatasetBatches([batch([row(1, { stage: 'framework_observed', sourceMatch: 'pon_candidate', finalSig: '1T PO QD', acceptable: true }),
      row(2, { stage: 'framework_observed', captureKind: 'framework_sig_observation' })])]);
    const replay = replaySigDataset(parsed);
    expect(replay.summary).toMatchObject({ skipped: 2, translated: 0, literalComparisons: 0 });
    expect(replay.results.every(r => r.status === 'skipped' && r.reason === 'passive_observation')).toBe(true);
  });
  it('compares literal text only for explicitly accepted whole-source confirmations', () => {
    const source = row(1), confirmed = row(2, { stage: 'technician_confirmed', sampleId: source.sampleId, finalSig: '1T PO QD', acceptable: true });
    const replay = replaySigDataset(parseSigDatasetBatches([batch([source, confirmed])]));
    expect(replay.summary).toMatchObject({ translated: 2, literalComparisons: 1, literalMatches: 1 });
    expect(replay.results[0]).toMatchObject({ literalFinalMatch: null });
  });
  it('does not join unrelated split samples, revisions, drugs or source wording by order identity', () => {
    const source = row(1);
    const changes: Partial<SigDatasetRecord>[] = [{ sampleId: hash(222) }, { revision: 2 }, { rawSig: 'Take 2 tablets daily.' }, { drug: 'OTHER TABLET' }, { acceptable: false }, { acceptable: undefined }];
    for (const change of changes) {
      const confirmed = row(2, { stage: 'technician_confirmed', sampleId: source.sampleId, finalSig: '1T PO QD', acceptable: true, ...change });
      expect(replaySigDataset(parseSigDatasetBatches([batch([source, confirmed])])).summary.literalComparisons).toBe(0);
    }
  });
  it('never compares a combined split preview with one final card', () => {
    const source = row(1, { drug: 'ZINC OXIDE 20% PASTE', rawSig: 'Apply to sacrum every shift and as needed for redness for 7 days.' });
    const confirmed = row(2, { ...source, seq: 2, dedupKey: hash(102), stage: 'technician_confirmed', finalSig: 'AP TPCL BID', acceptable: true });
    const replay = replaySigDataset(parseSigDatasetBatches([batch([source, confirmed])]));
    expect(replay.summary.literalComparisons).toBe(0);
    expect(replay.results[1].status === 'translated' && replay.results[1].result.subOrders.length).toBeGreaterThan(1);
  });
  it('uses stable finding categories across repeated runs and skips empty source prose', () => {
    const parsed = parseSigDatasetBatches([batch([row(1, { drug: 'UNKNOWN', rawSig: 'Unfamiliar direction.' }), row(2, { rawSig: ' ' })])]);
    expect(replaySigDataset(parsed).summary).toEqual(replaySigDataset(parsed).summary);
    expect(replaySigDataset(parsed).summary).toMatchObject({ translated: 1, skipped: 1 });
  });
  it('parses 10,000 observations across incremental batches without metadata inflation', () => {
    const files = Array.from({ length: 10 }, (_, i) => batch(Array.from({ length: 1000 }, (_, j) => row(i * 1000 + j + 1)), [], i * 1000, (i + 1) * 1000));
    const parsed = parseSigDatasetBatches(files);
    expect(parsed.issues).toEqual([]);
    expect(parsed).toMatchObject({ batches: 10, observations: 10000, duplicateObservations: 0 });
    expect(parsed.samples).toHaveLength(10000);
  });
});
