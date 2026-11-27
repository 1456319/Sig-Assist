# Functional audit — 2026-11-27 (rating durability, passive dataset provenance)

Baseline: `1456319/Sig-Assist@1a0105c435da70bb5bb45dd20200e3dca189527e` (v0.1.16), a fresh codeload tarball in `/tmp`. I used synthetic data only and edited nothing in the pharmacy repo. I did not read the three `docs/research/*` handoffs named in the request, so findings come from current source and tests.

## R1 — A 10 chosen right after a cold reload is lost; the old low rating wins (medium, executed)
- **Source:** `src/lib/translationFeedback.ts`, `saveTranslationFeedback`, the fresh-ten short-circuit (`rating === 10 && !negativeKeys.has(key) && !await findTranslationFeedback(...)`).
- **Cause:** `negativeKeys` is rebuilt from the IndexedDB outbox only by `loadPendingFeedback()`. That is called from the `TranslationFeedbackQueue`/`FeedbackOutbox` mount effect, never from the save path.
- **Trigger:** a page session rates a card 3, and the job reaches the outbox but not reports. Seen in the field as `browser_cache`, unconfirmed. After a reload, the technician re-rates the same card 10 before the outbox read finishes. The rating control reads reports, not the outbox, so the card may also show as unrated.
- **Current:** the save returns "Thanks — no discrepancy created" and records nothing. The background retry later writes the report with only `[3]`, so the stored outcome is a technician-observed error that the technician revised away.
- **Expected:** events `[3, 10]`, final state 10. The history stays append-only.
- **Repair:** `audit-2026-11-27/01-rating-ten-after-reload.patch` adds one awaited `loadPendingFeedback()`, only for rating 10. It adds no prompt and no new storage. `loadPendingFeedback` swallows its own errors, so outbox failure still falls through to the report check.
- **Test:** `audit-2026-11-27/auditNov27RatingReload.test.ts` › "a ten chosen right after a cold reload supersedes an unsaved earlier low rating". It fails on baseline (`expected [3] to deeply equal [3, 10]`) and passes with the patch.

## Verification (executed in /tmp)
- **Focused:** 4 files and 19 tests passed with the candidate: new + `translationRatings`, `ratingIntegration`, `technicianFeedback`. `tsc --noEmit -p tsconfig.app.json` passed.
- **Full suite:** baseline has 1425 passing and 5 failing, the 5 being my new test plus 4 in `prototypePackage.test.ts`. The candidate has 1426 passing and 4 failing. The 4 packaging failures need a git checkout, which a tarball does not have; they are unrelated.
- **Not run:** Windows fixtures, Edge/MVP CI and workstation behavior.

## Static observations (not reproduced as defects)
- Passive dataset (`SigDatasetPanel.tsx`): the Nov 24 issues F1–F3 look fixed.
  - The PON cache is gone. Only the latest observation can be enriched, and only while its identity and Queue context are unchanged.
  - The dedup identity includes the Queue context.
  - Lookup pairs are labelled `pon_candidate`, and unlabelled exported rows become `legacy_unverified`.
  - I found no remaining mispair path in static reading. The 7-day sibling check in `findDatasetSource` (F4) is unchanged; I did not re-test it.
- Split-card scope: each part's rating is keyed by `partId`, and its comment box is labelled only "Translation error explanation". A comment typed on card 1 about card 2 is stored with card 1 correctly, so this is a labelling clarity issue, not data loss. Including `subOrder.label` in the rating group or comment label is a low-cost option; it is unverified with users.
- Outbox jobs reloaded from a previous session are written together with a newer job for the same key, but only the newer job's outbox entry is removed. The banner can show updates as pending that are already saved, until the 30-second retry clears them. This is idempotent (events are deduplicated by id); a cosmetic false-pending, not loss.
- If report storage cannot be read, a fresh 10 shows "Feedback not saved" even though it should create nothing. A false alarm, not loss.

## Workstation-unknown
- Whether the field `browser_cache` saves are R1's situation. The exports were not shared with me.
- How long the outbox load takes on real Citrix/Edge, which sets the size of the R1 race window.
