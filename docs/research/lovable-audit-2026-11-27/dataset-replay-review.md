# Dataset replay review — 2026-11-27

Baseline: 1456319/Sig-Assist@df5e2f4ae0525b031476f51fc914377e94d780ee (fresh codeload archive in /tmp). Synthetic data only.

## Finding DR1 (reproduced): re-confirmations inflate literal comparisons
- Source: `src/lib/sigDatasetReplay.ts`, `replaySigDataset`, `eligible` (line ~114).
- Trigger: one `source_received` sample, then three `technician_confirmed` rows for the same `sampleId`+`revision` (distinct `dedupKey`s): `1T PO QD`, `1T PO QD`, later correction `1T PO DAILY`.
- Current: `literalComparisons: 3`, `literalMatches: 2`. Superseded confirmations are counted, and the technician's latest answer is outvoted.
- Expected: one comparison per sample/revision, using the latest confirmation (`capturedAt`, then `seq`). Result: 1 comparison, 0 matches. Stored rows and stage counts are unchanged, so history stays append-only.
- Fix: `audit-dataset-replay-2026-11-27/01-latest-confirmation-only.patch`
- Test: `audit-dataset-replay-2026-11-27/datasetReplayReconfirm.test.ts` — `a corrected re-confirmation of one sample counts as one literal comparison`. Fails on baseline (3 ≠ 1) and passes with the fix.
- Limitation: I didn't check whether the live collector can emit an identical re-save with a new dedupKey. The correction case alone gives 2 comparisons on baseline.

## Checked, no defect shown
- Split-part confirmations: `sampleId` hashes `partId`, so they never match the whole-order source and are never compared. This is static reading.
- Policy scope stays per batch. The same policy id with different exclusions in overlapping files leads to `conflicting_observation` and exclusion. This is covered by existing tests and static reading.
- Inhaler route probes: "Take 2 puffs orally", "2 puffs by mouth", the Diskus form and "Rinse mouth" all gave `BY INHALATION`. "Take 1 tablet orally... Do not inhale" stays `PO`. Side note, not new: "Inhale contents of 1 capsule" → `1P`.

## Executed
`tests/sigDatasetReplay.test.ts` (20), `tests/inhalerOralRoute.test.ts` (4), the probe tests and the candidate test: all pass with the candidate. Scratch `tsc --noEmit` is clean. The full suite, lint, build, CLI run and Windows checks were not run. The CLI was reviewed statically: it writes exclusive-create mode 0600 output, prints aggregates only and exits nonzero on issues.

