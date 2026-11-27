import { isSigDatasetExclusions, isSigDatasetRecord, type SigDatasetRecord } from './sigDataset';
import type { SigExclusion } from './reviewPolicy';
import { translateClinicalSig } from './clinical/clinicalEngine';

export interface ReplayIssue { file: number; line: number; code: string }
export interface ReplaySample {
  file: number;
  line: number;
  record: SigDatasetRecord;
  exclusions: SigExclusion[];
}
interface Batch {
  file: number; line: number; afterSeq: number; throughSeq: number;
  samples: Array<{ line: number; record: SigDatasetRecord }>;
  policies: Map<string, SigExclusion[]>;
  invalidPolicies: Set<string>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hex = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Parse complete exported batches, including concatenated/overlapping downloads.
 * Diagnostics contain positions/codes only; source text belongs in private output.
 */
export function parseSigDatasetBatches(files: string[]) {
  const issues: ReplayIssue[] = [], candidates: ReplaySample[] = [];
  const policyDefinitions = new Map<string, string>(), conflictingPolicies = new Set<string>();
  let batches = 0, policySnapshots = 0, observations = 0;
  const issue = (file: number, line: number, code: string) => issues.push({ file, line, code });
  const finish = (batch: Batch | undefined) => {
    if (!batch) return;
    const sequences = batch.samples.map(s => s.record.seq);
    if (sequences.length !== batch.throughSeq - batch.afterSeq || sequences.some((seq, i) => seq !== batch.afterSeq + i + 1)) {
      issue(batch.file, batch.line, 'incomplete_or_unordered_batch');
    }
    for (const { line, record } of batch.samples) {
      const id = record.exclusionPolicyId;
      if (id && (!batch.policies.has(id) || batch.invalidPolicies.has(id))) {
        issue(batch.file, line, 'missing_or_conflicting_policy'); continue;
      }
      candidates.push({ file: batch.file, line, record, exclusions: id ? batch.policies.get(id)! : [] });
    }
  };
  files.forEach((text, file) => {
    let batch: Batch | undefined;
    text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      let value: unknown;
      try { value = JSON.parse(line); } catch { issue(file, i + 1, 'invalid_json'); return; }
      if (!object(value)) { issue(file, i + 1, 'invalid_row'); return; }
      if (value.type === 'sig_dataset_batch') {
        finish(batch); batch = undefined;
        if (value.schemaVersion !== 1 || typeof value.appVersion !== 'string' || typeof value.buildId !== 'string' || !Number.isSafeInteger(value.afterSeq) || !Number.isSafeInteger(value.throughSeq) || (value.afterSeq as number) < 0 || (value.throughSeq as number) < (value.afterSeq as number)) {
          issue(file, i + 1, 'invalid_batch_header'); return;
        }
        batches++;
        batch = { file, line: i + 1, afterSeq: value.afterSeq as number, throughSeq: value.throughSeq as number, samples: [], policies: new Map(), invalidPolicies: new Set() };
      } else if (!batch) {
        issue(file, i + 1, 'missing_batch_header');
      } else if (value.type === 'exclusion_policy') {
        if (!hex(value.id) || !isSigDatasetExclusions(value.exclusions)) { issue(file, i + 1, 'invalid_policy'); return; }
        policySnapshots++;
        const previous = batch.policies.get(value.id);
        const definition = canonical(value.exclusions), earlierDefinition = policyDefinitions.get(value.id);
        if (previous && canonical(previous) !== definition || earlierDefinition !== undefined && earlierDefinition !== definition) {
          conflictingPolicies.add(value.id);
          batch.invalidPolicies.add(value.id); issue(file, i + 1, 'conflicting_policy');
        } else { batch.policies.set(value.id, value.exclusions); policyDefinitions.set(value.id, definition); }
      } else if (isSigDatasetRecord(value)) {
        observations++;
        if (value.seq <= batch.afterSeq || value.seq > batch.throughSeq) { issue(file, i + 1, 'sequence_outside_batch'); return; }
        batch.samples.push({ line: i + 1, record: value });
      } else issue(file, i + 1, 'invalid_observation');
    });
    finish(batch);
  });
  // Opaque dedup keys include the collector's local salt. Sequence numbers do
  // not identify an observation across independent browser databases.
  const seen = new Map<string, { sample: ReplaySample; value: string }>(), conflicts = new Set<string>();
  let duplicateObservations = 0;
  for (const sample of candidates) {
    if (sample.record.exclusionPolicyId && conflictingPolicies.has(sample.record.exclusionPolicyId)) {
      issue(sample.file, sample.line, 'missing_or_conflicting_policy'); continue;
    }
    const key = sample.record.dedupKey, value = canonical([sample.record, sample.exclusions]);
    const previous = seen.get(key);
    if (!previous) seen.set(key, { sample, value });
    else if (previous.value === value) duplicateObservations++;
    else { conflicts.add(key); issue(sample.file, sample.line, 'conflicting_observation'); }
  }
  if (!batches) issue(0, 1, 'no_batches');
  const samples = [...seen].filter(([key]) => !conflicts.has(key)).map(([, v]) => v.sample);
  return { samples, issues, batches, policySnapshots, observations, duplicateObservations };
}

export function replaySigDataset(parsed: ReturnType<typeof parseSigDatasetBatches>) {
  const stages: Record<string, number> = {}, findings: Record<string, number> = {};
  // No joins by orderId/PON or raw text. A source sample must match the exact
  // salted sample identity, revision, drug and prose for whole-source comparison.
  const sourceSamples = new Set(parsed.samples.filter(s => s.record.stage === 'source_received' && s.record.captureKind !== 'framework_sig_observation')
    .map(s => canonical([s.record.sampleId, s.record.revision, s.record.drug, s.record.rawSig])));
  // Same salted sample identity comes from one collector DB. Its increasing
  // sequence is authoritative even if exports arrive reversed or the clock moves.
  // Include rejected/unrated confirmations so an older acceptance cannot revive.
  const confirmationKey = (s: ReplaySample) => canonical([s.record.sampleId, s.record.revision]);
  const latestConfirmed = new Map<string, ReplaySample>();
  for (const sample of parsed.samples) if (sample.record.stage === 'technician_confirmed') {
    const key = confirmationKey(sample), previous = latestConfirmed.get(key);
    if (!previous || sample.record.seq > previous.record.seq) latestConfirmed.set(key, sample);
  }
  const results = parsed.samples.map(sample => {
    const { record } = sample;
    stages[record.stage] = (stages[record.stage] ?? 0) + 1;
    if (record.stage === 'framework_observed' || record.captureKind === 'framework_sig_observation') {
      return { ...sample, status: 'skipped' as const, reason: 'passive_observation' };
    }
    if (!record.rawSig.trim()) return { ...sample, status: 'skipped' as const, reason: 'empty_source' };
    try {
      const result = translateClinicalSig({ id: 'OFFLINE-REPLAY', pon: 'OFFLINE-REPLAY', drugName: record.drug,
        rawProse: record.rawSig, defaultSigTemplate: record.defaultSigTemplate, sourceFormat: 'manual_text' }, { exclusions: sample.exclusions });
      const flags = [...result.abnormalities, ...result.subOrders.flatMap(p => p.abnormalities)];
      // Several engine IDs contain timestamps or order identity. Categories
      // must remain stable across repeated runs and count each observation once.
      for (const category of new Set(flags.map(f => `${f.tier}: ${f.title}`))) findings[category] = (findings[category] ?? 0) + 1;
      const eligible = record.stage === 'technician_confirmed' && record.acceptable === true && !!record.finalSig?.trim()
        && latestConfirmed.get(confirmationKey(sample)) === sample
        && result.subOrders.length <= 1 && sourceSamples.has(canonical([record.sampleId, record.revision, record.drug, record.rawSig]));
      // Literal formatting agreement only; never call it clinical accuracy.
      const literalFinalMatch = eligible ? result.primarySig === record.finalSig!.trim().toUpperCase() : null;
      return { ...sample, status: 'translated' as const, result, literalFinalMatch };
    } catch {
      return { ...sample, status: 'error' as const, reason: 'translator_exception' };
    }
  });
  const translated = results.filter(r => r.status === 'translated');
  return { results, summary: {
    batches: parsed.batches, policySnapshots: parsed.policySnapshots, observations: parsed.observations,
    uniqueObservations: parsed.samples.length, duplicateObservations: parsed.duplicateObservations,
    parseIssues: parsed.issues.length, translated: translated.length,
    skipped: results.filter(r => r.status === 'skipped').length, errors: results.filter(r => r.status === 'error').length,
    stages, findings,
    distinctSourceDrugProsePairs: new Set(parsed.samples.filter(s => s.record.stage === 'source_received').map(s => canonical([s.record.drug, s.record.rawSig]))).size,
    literalComparisons: translated.filter(r => r.literalFinalMatch !== null).length,
    literalMatches: translated.filter(r => r.literalFinalMatch === true).length,
    interpretation: 'Observation coverage and literal agreement only; no clinical accuracy score. Split/unrated/passive finals are not whole-order answers.',
  } };
}
