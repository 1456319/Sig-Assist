# Independent Sig-Assist integration audit — 2026-11-18

Exact public baseline: `1456319/Sig-Assist@fe0281cc3ea037035e840b498677ebbd6230c8f0` (v0.1.12, build `930d219c8119` per handoff), extracted into a fresh `/tmp` directory. All observations below are from synthetic tests or source inspection. No pharmacy repository edits, deployments, credentials, live systems, Windows fixture execution, or clinical actions.

## Newly reproduced findings

### I1 — Classic loses `THEN` between dose phases (high)

`src/lib/clinical/instructionClauses.ts:35–48`, called by `src/lib/sigEngine.ts:108–118`. `Take 1 tablet by mouth daily for 5 days, then take 2 tablets by mouth at bedtime for 3 days.` produces `1T PO QD X5D. TAKE 2 TABLETS BY MOUTH AT BEDTIME FOR 3 DAYS`. The boundary logic rejects the empty qualifier between `THEN` and `TAKE`, then removes `THEN` from the primary clause. Without it, the two directions can read as concurrent. Patch 01 keeps an immediately preceding phase marker with the retained action; expected `1T PO QD X5D. THEN TAKE 2 TABLETS BY MOUTH AT BEDTIME FOR 3 DAYS`. It does not change the clinical or scale splitter modes.

### I2 — Classic combines the first injection dose with the second schedule (high)

`src/lib/clinical/instructionClauses.ts:5`, `src/lib/sigEngine.ts:73–78,108–118`. `Inject 2 units subcutaneously in the morning. Inject 1 unit subcutaneously at bedtime.` produces `INJ 2 UN SQ QHS` with no issue: the splitter does not recognize a later numeric `INJECT`, the dose extractor takes the first quantity, and bedtime wins the frequency scan. Patch 01 recognizes numeric `INJECT` in classic mode: `INJ 2 UN SQ QAM. INJECT 1 UNIT SUBCUTANEOUSLY AT BEDTIME`. The second dose is retained prose, not a second structured result.

### I3 — Classic silently drops an unencoded hold (high)

`src/lib/sigEngine.ts:137–138,149–159`. `Take 1 tablet by mouth daily. Hold if not eating.` produces `1T PO QD`, with no hold or retained-clause warning. Patch 01 separates an unsupported `HOLD IF/FOR/WHEN` from primary extraction and keeps it in the draft with the existing review warning: `1T PO QD. HOLD IF NOT EATING`. The known `SBP below N or HR below N` compact form still encodes; a condition with extra text is no longer treated as equivalent to that exact form. This is not a general negation parser: an additional manual probe, `Take 1 tablet by mouth daily and not at bedtime.`, produced `1T PO QHS` on baseline. Patch 01 does not cover that inline negation; preserve the complete input for that form rather than treating the excluded time as a schedule. The existing cut-date removal policy was not changed.

### I4 — Transient source failure remains cached as a miss (medium)

`src/components/SigDatasetPanel.tsx:55–87,95–111`; `src/lib/frameworkSigDataset.ts:27–37` and `src/lib/iguana/client.ts:11–18,38`. With an empty Queue, save an observation for `SYN-RETRY:01`. Reject its first lookup, then let the exact source become available with the field unchanged. Baseline saves the raw observation but does not try again: the rejection becomes `null` in the session cache, and field deduplication also prevents a new lookup for that observation. Patch 02 keeps the buffered observation and allows one retry after 30 seconds, driven by the existing poll rather than new timers or a repeated field event. Ordinary misses are still not retried. A second rejection stops automatic attempts, and live Queue collisions block the retry or the eventual pairing. A raw field observation is never upgraded to a verified save. The one-retry budget is for the tracked entry; the existing bounded cache can evict it, and collection restart starts a fresh session. No guarantee of recovery during ongoing outages or when a source is ambiguous outside the visible Queue.

## Verification and handoff

- **Baseline:** 158 existing tests passed across 13 focused files. The two new test files produced five failures and four passing controls. Failures cover the three classic examples, failed recovery of the same field, and the missing bounded retry on repeated rejection.
- **Candidates:** All nine new checks passed. The expanded focused run passed **210 tests in 19 files**; the broader run passed **1,312 tests in 87 files**, excluding `tests/prototypePackage.test.ts`. Upstream application typecheck and lint of changed source and tests passed. No compiler flags or existing assertions were changed. This was not a package freshness or Windows CI run.
- **Integrated controls:** Per-part correction, rating/comment isolation, Workbench reviewed-copy/confirmation provenance, failed local save recovery, and live Queue collision checks passed. Queue’s verified-transfer suggestion is selected by part ID by source inspection. The mocked helper tests passed for dataset waiting, technician priority, timeout backoff, recovery, and changing the selected window. No new split-confirmation or scheduling defect was reproduced in those checks; physical workstation behavior remains outside this review.
- **Transplant:** Apply each patch in `audit-integration-2026-11-18/` independently with `patch -p1`; copy its corresponding `auditFe0281*.test.*` file into the upstream `tests/` directory. Both diffs passed a dry run against a second pristine extraction. Review the classic draft changes before integration; test results establish the stated cases, not clinical accuracy. No balance measurement or purchase was performed.
