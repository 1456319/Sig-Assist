# Functional audit 2026-11-18 — passive native / connector / dataset snapshot

Status: IN PROGRESS (checkpoint 1).
Baseline: Sig-Assist `prototype` @ 11fa35b767cf221cefc81837486ee47f602a1c34 (runtime 45ecfa4e, v0.1.11 build 3f5d71dba6b8), fetched as a read-only codeload tarball into /tmp. Pharmacy repo not modified, pushed or deployed. Synthetic data only. FWDirect excluded.

Baseline check (Linux, Node 22): `vitest run tests/frameworkDesktop.test.ts tests/iguanaBridge.test.ts tests/pilotJournal.test.ts tests/frameworkSigDataset.test.ts tests/sigDatasetPanel.test.tsx tests/frameworkDatasetSource.test.ts` → 110/110 pass.

## Earlier findings: first look
- Hung-window check / passive backoff (Nov 17 candidate 2): no `IsHungAppWindow`, no backoff anywhere in scripts/windows/src at 11fa35b. Still present.
