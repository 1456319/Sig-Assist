# Final audit evidence

Three existing Lovable labs were followed up in Max mode using public source and synthetic data. QA received one additional integration review. All available daily credits were exhausted; no patient captures, credentials or private Drive files were supplied.

The raw reports describe what each lab actually investigated, including incomplete work and limitations. Candidate patches and `.test.ts.txt` files are evidence, not a patch set to apply blindly. In particular, the first clinical patch still lost the bedtime modifier's scope; the coordinator completed that fix and later corrected two integration boundary regressions. The engineering report is an early checkpoint; its final response is in `engineering-final-summary.md`.

`clinical-baseline.jsonl` is the lab's 20-order baseline at b853b88. `clinical-lab-partial-after.jsonl` is the lab's incomplete candidate output. `clinical-integrated-after.jsonl` is the coordinator's replay after final source 9128bed: H1/S5/N1/N3 changed as intended, with the other 16 outputs unchanged. These are synthetic examples, not a measured technician success rate.

The accepted implementations have executable tests in the repository's `tests/` directory: finalMonitoringClauses, finalTreatmentSequences, finalScaleScope, sigDictionaryRaces, iguanaLookupIdentity, finalIntegrationBoundaries and finalScaleScheduleAliases. Existing fixture prose and expected clinical outputs were not weakened to obtain a pass. Lookup UI and browser smoke assertions were updated to require the newly visible saved-match count.

The authoritative decisions, verification state, job IDs and next steps are in `docs/FINAL-AUDIT-HANDOFF-2026-11-17.md` at the repository root.
