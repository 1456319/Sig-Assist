# Focused integration audit — 2026-11-27

## Source, boundary and actual execution

Fresh public codeload archive of `1456319/Sig-Assist@6ace0036f213486253460bcb2b703f3924069044`, extracted under `/tmp/sig-integration-20261127/`; the stale lab engine was not executed. Package version inspected: **0.1.17**. Archive URL and SHA256 are in `audit-integration-2026-11-27/source-provenance.txt`. The supplied build identity `3ed40918e4df`, root's 1445/104 result and Windows/package results were not independently verified here.

Inspected the pinned `AGENTS.md`, `treatmentOrderEngine.ts`, `durationEngine.ts`, `instructionClauses.ts`, `frequencyEngine.ts`, `indicationEngine.ts`, `sigEngine.ts`, `slidingScaleProse.ts`, most of `slidingScale.ts` (lines 1–230), and relevant assembly sections of `clinicalEngine.ts` (1–170, 220–320). Read all three specifically requested test files. Only fresh synthetic orders; no private reports, captures, PHI, credentials or live systems. No pharmacy-repository writes, deployment, configuration edits or rescue-dose conversions. The site's explicit glucagon template is unchanged.

| Execution | Actual result |
|---|---|
| Selected baseline regressions, 11 files | **253 passed / 253** |
| Independent holdout | **15 fixtures × 2 entry points**, baseline and candidate outputs saved |
| New named baseline tests | **7 failed, 6 passed / 13** |
| Same tests with isolated candidate | **13 passed / 13** |
| Full candidate suite | **1453 passed, 5 failed / 1458**, 103 passing files, 2 failing files |

Selected regression files: `treatmentSharedCourse`, `maximumCourse`, `durationEngine`, `treatmentOrders`, `finalTreatmentSequences`, `treatmentSplitSitePreservation`, `siteSlidingScale`, `slidingScaleIntegrity`, `slidingScaleVariants`, `finalScaleScope`, `finalScaleScheduleAliases` (all `.test.ts`). The full candidate run includes those files and the new holdout tests; no expected values were weakened.

**Full-suite limits:** four `prototypePackage.test.ts` fixtures fail at `git init --bare`, an operation unavailable in this sandbox. One `sigDataset.test.ts` 10,000-record test timed out after 60 seconds under the full concurrent run. Its cause is **unclassified**, not asserted unrelated or a product regression. No full baseline suite, timeout rerun, lint/typecheck, Windows/Edge/native run or package reproduction was performed. Credits ran out after the candidate run, so further investigation stopped.

## F1 — A later maximum-course prefix changes the earlier classic dose

**Pinned locations:** `src/lib/clinical/instructionClauses.ts:44–49` (prefix recognition); `src/lib/sigEngine.ts:112–118,160` (primary course extraction and maximum precedence).

**Synthetic trigger (tablet):**

```text
Take 1 tablet by mouth daily for 7 days. For up to 3 days, take 1 tablet by mouth at bedtime as needed for pain.
```

**Actual classic output:**

```text
1T PO QD FOR UP TO 3 DAYS. TAKE 1 TABLET BY MOUTH AT BEDTIME AS NEEDED FOR PAIN
```

The daily seven-day course is replaced with a three-day upper bound; that upper bound belongs to the bedtime PRN action. `order.durationDays` is 7, but `order.maximumCourse` incorrectly becomes `FOR UP TO 3 DAYS`, and rendering prefers it. The later prefix is removed from its own action.

**Clinical baseline:** all source content survives in useful partial translation, but a spurious `conflicting_durations` finding is generated across two independently scoped actions:

```text
TAKE 1 TABLET PO QD X7D. FOR UP TO 3 DAYS, TAKE 1 TABLET PO QHS PRN FPAIN
```

**Expected / verified candidate:**

```text
1T PO QD X7D. FOR UP TO 3 DAYS, TAKE 1 TABLET BY MOUTH AT BEDTIME AS NEEDED FOR PAIN.
```

Classic omits the final period by existing convention. Its `maximumCourse` is now absent for the first action. Clinical no longer reports a cross-action duration conflict; the later dose remains literal and editable with the existing supplemental-instructions finding.

**Small fix:** extend the existing `FOR [THE NEXT] n DAYS/WEEKS/MONTHS` action-prefix recognizer to include `FOR UP TO n ...`. No new course interpretation. Three new tests fail on the pinned baseline and pass with the one-line candidate: shared boundary, classic output/course ownership, and clinical useful first-dose translation without false conflict.

**Limit:** this proves a sentence-delimited, comma-bearing later action prefix. It is not coverage of every hours/abbreviation/conjunction variant.

## F2 — A symptom interval becomes an invented treatment course

**Pinned location:** `src/lib/clinical/treatmentOrderEngine.ts:78–91` — each duration match is extracted before the PRN reason, without checking what it describes.

**Synthetic trigger (zinc oxide):**

```text
Apply to sacrum every shift and as needed for redness present for 2 days.
```

`lasting` in place of `present` reproduces the same defect.

**Actual clinical cards:**

```text
TO SACRUM:APPLY ZINC OXIDE QS X2D
TO SACRUM:APPLY ZINC OXIDE PRN X2D FOR REDNESS PRESENT
```

The source describes redness present for two days, not a two-day treatment course. The condition interval disappears from its reason and becomes a stop course on both cards, with only the ordinary split finding.

**Expected / verified candidate cards:**

```text
TO SACRUM:APPLY ZINC OXIDE QS
TO SACRUM:APPLY ZINC OXIDE PRN FOR REDNESS PRESENT FOR 2 DAYS
```

The candidate adds `treatment_condition_duration_retained` for review rather than inferring a treatment course. It still translates the procedure and the routine/PRN schedules.

**Small fix:** in the existing duration-replacement callback, retain a match immediately preceded by `PRESENT` or `LASTING`, with a review finding. Other actual course matches still follow the integrated extraction-first path. Both new mutation tests fail on baseline and pass with candidate. Existing shared fourteen-day and bounded-course tests remain intact.

**Important limit:** the candidate is deliberately lexical and narrow, not a general symptom/course classifier. It does not handle arbitrary phrases such as “ongoing for” or “persisting for,” or prove every other qualifier safe. The standalone classic treatment path remains affected (`PRN FOR REDNESS PRESENT X2D`) and is **not repaired by this candidate**; its treatment-structure loss was already known, and no UI use of that path was established in this run. Do not claim this fix covers both entry points.

## F3 — Classic maximum precedence silently hides a fixed/bounded conflict

**Pinned locations:** `src/lib/sigEngine.ts:117–118,160–161`; existing contrast in `src/lib/clinical/durationEngine.ts:29–37` and `tests/maximumCourse.test.ts:23–25`.

**Synthetic trigger (tablet):**

```text
Take 1 tablet by mouth daily for up to 7 days and for 7 days.
```

The same result occurs with `for 5 days` as the second course.

**Actual classic:** `1T PO QD FOR UP TO 7 DAYS`, **no issues**. Both fields are parsed, but the renderer selects the maximum and silently drops the fixed course. The existing shared resolver correctly regards bounded and fixed courses as different even when the numeric limits match; that integration rule was not applied to classic rendering.

**Clinical baseline:** preserves both with `conflicting_durations` and partial translation (`TAKE 1 TABLET PO QD FOR UP TO 7 DAYS AND X7D.`). No clinical candidate change needed.

**Expected / verified classic candidate:** retain the complete conflicting regimen and attach `conflicting-durations`, without choosing a course:

```text
TAKE 1 TABLET BY MOUTH DAILY FOR UP TO 7 DAYS AND FOR 7 DAYS.
```

**Small fix:** consult the existing shared duration resolver on the already scoped, non-scale primary clause; if it reports `conflicting_durations`, use the existing retained-regimen output and add a warning. The two new conflict tests fail on baseline and pass with candidate. Single fixed and maximum controls remain `1T PO QD X7D` and `1T PO QD FOR UP TO 7 DAYS`.

**Limit:** intentional raw retention here is preferable to a falsely resolved conflict. Only conflicts recognized by the shared resolver are covered; do not infer broader classic duration-schema completeness. Scale rendering is explicitly excluded from this new check.

## Preserved integrations and tested limits

- Clinical separate cleansing/application courses retain `QD X7D` on cleansing and `PRN FOR UP TO 3 DAYS FOR REDNESS` on application (T2).
- Sequential treatment keeps `TWICE DAILY FOR UP TO 7 DAYS, THEN DAILY FOR 3 DAYS` with the existing sequence review finding (T5); it is useful partial translation, not whole-source fallback.
- A later notification condition `IF REDNESS PERSISTS FOR 2 DAYS` remains literal on both clinical cards, distinct from the shared `FOR UP TO 7 DAYS` course (T6).
- Both scale entry points retain a maximum correction course separately from a fixed three-day basal course, and vice versa (S2/S3). Exact output assertions cover each dose, schedule and course. No dose conversions or rescue-policy changes.
- S5 retains the later bedtime half-dose action and its own maximum course verbatim, with a scale review finding.
- **S4 is not a clean scope success:** `Sliding scale SQ TID:150-199=2 units;200+=4 units. For up to 3 days, at bedtime give half the scale dose.` takes the full-source review fallback, but its prefixed header reads `CBS QHS S.S.` despite the stated scale TID. The full original source and `incomplete_sliding_scale` remain visible. No candidate or failing test was completed for that fallback-header mismatch before credits ended; do not count it as verified correct translation or as repaired.
- Known classic treatment loss was observed again but is not re-reported as a new repair recommendation. No conclusions about ratings, reader hooks, sweeper writes or workstation performance arise from this focused check.
- No bounded-regex benchmark was executed; no performance or universal source-coverage claim.

## Durable artifacts and root handoff

`audit-integration-2026-11-27/` contains:

- `candidate.patch` — three small edits to the pinned source, applied **only in /tmp**;
- `integration20261127Scope.test.ts` — 13 concrete regression/control cases; copy into the actual pinned checkout's `tests/` to execute;
- `holdout-corpus.ts.txt` and baseline/candidate JSONL — 15 fresh fixtures through both paths;
- baseline selected-regression log, new-test baseline/candidate logs, full candidate log;
- source provenance and execution instructions.

**Review priority:** F1 first (wrong course ownership in a supported classic tablet path); F2 next (invented clinical treatment course); F3 then (classic conflict parity). The candidate is not production-ready approval: root should transplant selectively, execute its normal checks and classify the dataset timeout. Further work requires available credits. Nothing was pushed to the pharmacy repository or published, and no old glucagon patch was reapplied.
