# Final functional audit — 2026-11-17 (Sig-Assist prototype @ b853b88)

I worked only in the lab. The pharmacy repo was not modified, pushed or deployed. Every input below is made up (no PHI, captures or Drive material). The source came from the public codeload tarball for `b853b88cb7bc6c96f262d06b8240c434f0174a13`, extracted to /tmp.

## Evidence and scope
- **Read:** `treatmentOrderEngine.ts`, `slidingScale.ts`, `instructionClauses.ts`, the scale branch of `frequencyEngine.ts`, `clinicalEngine.ts` (`translateClinicalSig` and the output policy wrapper), and `docs/ASTRA-FUNCTIONAL-AUDIT-2026-11-16.md`.
- **Not re-read:** FUNCTIONAL-POLISH-RECOVERY, PILOT-CAPTURE-REVIEW-2026-11-17, and docs/research. Nothing below depends on them.
- **Not used for findings:** the pilot aggregate figures in the request.
- **Note:** `src/lib/sigEngine.ts` exists. `src/lib/clinical/sigEngine.ts` does not.
- **Baseline suite:** 1111 tests in 66 files pass. With the patch, 1116 tests in 67 files pass (5 new).
- **Already fixed at this commit, not re-reported:** invented QS/APPLY, lost weekday/duration/PRN, the headingless scale, mg/dL, postfix `or greater`, the base dose and recheck.
- **Holdout corpus:** 20 fresh sentences in `audit-2026-11-17/holdout-corpus.ts.txt`, covering treatments, scales and non-scale monitoring. Output is in `holdout-baseline.jsonl` and `holdout-after.jsonl`.

## Correct at baseline (controls)
Multi-site cleanse, action-local frequencies (cleanse QD / apply QS), `until healed`, `at 0800`, `after each incontinent episode`, `do not apply to open areas`, `hold if skin is broken`, `x14 days then reassess`, scale overlap, scale gap, low/high call-MD bands, `300 or greater … and call MD`, `hold if not eating` (retained and flagged), and the BP/HR hold. A fixed basal dose plus a separately scheduled scale (S6) falls back to raw passthrough, with `incomplete_sliding_scale`. That is safe but not useful partial translation. It is listed under next increment.

## F1 — Silent loss of a monitoring sentence before a notification (non-scale orders)
- **Where:** `src/lib/clinical/instructionClauses.ts:5`, the `actions` regex in `splitSupplementalDirections`.
- **Trigger:** `METFORMIN 500 MG TABLET` / `Take 1 tablet by mouth twice daily with meals. Check blood sugar 2 times a day, call MD if over 300.`
- **Current:** `1T PO WMBID. CALL MD IF OVER 300.`
  - `CHECK BLOOD SUGAR 2 TIMES A DAY` disappears with no finding.
  - The kept note now reads "over 300" with no subject, which is a scope change.
- **Second trigger:** `Weigh daily, notify MD if weight gain…` (furosemide). `WEIGH DAILY` is lost.
- **Cause:** the first recognized action verb is `CALL`/`NOTIFY`. Everything before it becomes `primary`, and the dose and frequency parsers silently ignore the unconsumed monitoring words in that text.
- **Expected:** `1T PO WMBID. CHECK BLOOD SUGAR 2 TIMES A DAY, CALL MD IF OVER 300.` This is a useful partial translation: the dose is translated and the remainder is kept verbatim, with the existing `retained_supplemental_instructions` finding.
- **Fix:** add `CHECK\b|MONITOR\b|WEIGH\b|RECHECK\b` to the split actions.

## F2 — A dose modifier after a scale is dropped silently
- **Where:** `slidingScale.ts:128-139`, where the tail is folded into `schedule`. Then `frequencyEngine.ts:50`, where `splitSupplementalDirections(scale.schedule)` doesn't split on `GIVE HALF`.
- **Trigger:** `INSULIN LISPRO 100 UNIT/ML` / `Inject per sliding scale subcutaneously before meals and at bedtime: 150-199 2 units, 200-249 4 units. At bedtime give half the scale dose.`
- **Current:** `CBS ACHS SS 150-199=2U;200-249=4U SQ`, with **zero abnormalities**. At bedtime the draft gives the full dose, which is a changed prescribed dose.
- **Fix:** the same regex line as F1. `(?:TAKE|GIVE|ADMINISTER)\s+(?=…|HALF\b)` now also matches `GIVE HALF`.
- **After:** `CBS ACHS SS 150-199=2U;200-249=4U SQ. GIVE HALF THE SCALE DOSE`
- **Limitation (still open):** `AT BEDTIME` has already been absorbed into ACHS, so the kept clause loses its "at bedtime" scope, and no finding is raised. A complete fix belongs in `slidingScale.ts`:
  - Keep any tail words that aren't schedule or route words as `retainAction(...)`, so a finding is raised.
  - Don't merge a tail schedule that restates a qualifier.

  This is recommended as the next commit (test idea: assert that `sliding_scale_unparsed_action` is present for S5).

## F3 — A sequential treatment schedule is merged into one simultaneous schedule (scope change)
- **Where:** `treatmentOrderEngine.ts`, `parseModifiers`. The `SCHEDULE` replace collects every frequency into one `result.frequency`.
- **Trigger:** `ZINC OXIDE 20% PASTE` / `Cleanse sacrum with normal saline, pat dry, apply zinc oxide twice daily for 7 days then daily.`
- **Current:** `…THEN APPLY ZINC OXIDE BID QD X7D THEN`
  - It reads as BID and QD both for 7 days, and the "then daily" phase loses its order.
  - The only finding is a misleading `treatment_untranslated_clause: THEN`.
- **Expected:** `…THEN APPLY ZINC OXIDE TWICE DAILY FOR 7 DAYS THEN DAILY`, plus `treatment_sequential_schedule`. The procedure is translated, the sequence is kept verbatim and in order, and no missing-frequency warning is raised.
- **Fix:** about 10 lines at the top of `parseModifiers`. If a schedule is later followed by `THEN … <schedule>`, keep that whole span as the action's frequency text and flag it. It never splits automatically.

## Artifacts (`audit-2026-11-17/`)
- `fix.patch`: a unified diff against b853b88. It touches only `instructionClauses.ts` and `treatmentOrderEngine.ts`.
- `audit20261117Holdout.test.ts`: drop it into `tests/`. On baseline, 4 tests fail and 1 control passes. With the patch, all 5 pass. The full suite then shows 1116 passing in 67 files.
- `holdout-corpus.ts.txt`, `holdout-baseline.jsonl`, `holdout-after.jsonl`.

## Limitations
- Adding `CHECK|MONITOR|WEIGH|RECHECK` moves text into `supplemental` for any order where those words appear after the dose. The whole suite still passes, but technician review of existing discrepancy reports is advised.
- In F3, the Framework spelling of a sequence (for example a split into two orders) is a technician or dictionary decision. The patch only stops the merge.
- The non-scale "CALL MD IF OVER 300" now has its subject back, because the check sentence is kept. Nothing was reworded.

## Next increment (evidence-backed)
1. F2 complete fix (above).
2. S6: a fixed basal dose plus a separately scheduled scale. Return `baseInstruction` as its own clause rather than raw passthrough. The `PLUS` path already does this for additive doses.
3. A general guard: before `clinicalEngine` returns a non-passthrough draft, flag any word in `primary` (letters only, ignoring connectives) that isn't consumed by the dose, frequency or route token sets. F1 would have been caught by such a guard.

