# Integration audit — 2026-11-27 (rating outbox)

Baseline: `1456319/Sig-Assist@6ace0036f213486253460bcb2b703f3924069044` (v0.1.17), a fresh codeload tarball in `/tmp`. Synthetic data only. No pharmacy edits.

## Result
**I reproduced no new integration defect** in `src/lib/translationFeedback.ts`.

## Confirmed by execution
The integrated awaited `loadPendingFeedback()` for a rating of 10 is present at line 78. The checks below are in `audit-integration-2026-11-27/ratingIntegrationControls.test.ts`. They are controls, not regressions, and all pass on the baseline:
1. A 3 from a previous session waits in the outbox for split part 1. After a reload, the technician rates part 1 a 10. The stored events are `[3, 10]` and the final state is 10.
   - The original evidence is kept, including `partId: p1` and the original draft. The edited draft is recorded separately.
   - A fresh 10 on part 2 returns `undefined` and creates no report. The part identity in `feedbackKey` keeps the two parts separate.
   - Running retry twice leaves one report, no duplicate events and an empty pending list.
2. When report storage fails, the 4 is rejected and the 10 is queued. After storage recovers, two retries give one report with `[4, 10]`, no duplicates and nothing pending.

Focused run: 4 files and 16 tests passed. These were the new controls plus `ratingColdReload`, `ratingIntegration` and `translationRatings`, which includes the split-card scope label test.

## Not run / limits
- Full suite, lint, typecheck and Windows/Edge were not run. I did not touch the recorder or UIA tests, so I make no claim about UIA degradation labelling.
- `browser_cache` attribution: the earlier conjecture is withdrawn. Root says it is a successful persistence outcome. Nothing here makes a field or clinical claim.
- The earlier static notes still apply and are not defects: a brief false-pending banner, and a false "not saved" alarm when reports cannot be read on a fresh 10.
