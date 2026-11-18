# Functional audit — 2026-11-18 (Sig-Assist prototype @ 11fa35b)

Lab-only. The pharmacy repo was not modified, pushed or deployed. All inputs are synthetic. Source: public codeload tarball for `11fa35b767cf221cefc81837486ee47f602a1c34`, extracted to an isolated /tmp folder (no git metadata).

## Baseline and scope
- **Read:** `frequencyEngine.ts` (scale branch, frequency ladder), `slidingScale.ts` (band/action loop, tail split), `sigEngine.ts` (classic `parseSigOrder`/`renderSig`), `instructionClauses.ts` (via behavior), DATASET-HANDOFF-2026-11-18 (named-meal and repeated-route notes).
- **Not re-read in full:** SIG-DATASET.md, FINAL-AUDIT-HANDOFF-2026-11-17.md, docs/research/final-audit-2026-11-17/. Disposition below is from fresh reproduction, not from those documents.
- **Baseline suite in this sandbox:** `tests/prototypePackage.test.ts` (4 tests) fails on the untouched baseline because the tarball has no git repository. Running the whole suite in one go also times out 7 UI/dataset tests under load; they pass when run in isolation on both baseline and candidate.
- **Entry points:** clinical `translateClinicalSig` and classic `translateFreeTextSig` (used by `parser.ts:262` and `OrderQueueView.tsx:47`).
- **Holdout:** 13 fresh sentences in `audit-2026-11-18/holdout-corpus.ts.txt`: treatments T1–T5, scales S1–S4, named meals M1–M2, repeated route/dose R1–R2. Outputs are in `holdout-baseline.jsonl` and `holdout-after.jsonl`. These are spot checks, not a measure of clinical accuracy.

## Earlier findings — disposition (reproduced fresh)
| Item | Status at 11fa35b |
|---|---|
| Nov17 F1 monitoring before notify | Fixed (clinical). M1/M2 retain CHECK/NOTIFY with `retained_supplemental_instructions`. **Still lost in classic** → D3. |
| Nov17 F2 qualified half-scale footer | Not re-triggered here. No regression seen. |
| Nov17 F3 sequential treatment phase | Fixed. T5 `two times a day for 10 days, then as needed` → `AP TPCL TO GROIN BID PRN X10D` with no finding. This collapses "then PRN" into simultaneous BID PRN. **Possible residual. Not proven harmful, not patched** (see limitations). |
| Action-local schedule / multi-site | Fixed (clinical). T1 keeps cleanse QD and apply QS PRN FOR REDNESS. T2 keeps per-heel QD X14D / BID. |
| Monitoring/negative qualifiers in treatments | Fixed (clinical). T3 keeps `DO NOT USE ON OPEN WOUNDS. MONITOR SKIN DAILY`. |
| Named breakfast AND dinner | Fixed in both entry points. Both meals kept, and no later qualifier is taken (M2 "after dinner" stays inside the notification). |
| S6 basal fixed dose + separately scheduled scale | **Still raw passthrough** (S1), with `incomplete_sliding_scale`. S2 (`4 units with meals. Plus sliding scale`) is the same. Safe but not a partial translation. Not patched: it needs a two-component render decision (two sub-orders vs one line), which is up to the technician or dictionary. |
| Repeated-route split wording | Clinical keeps the second dose clause verbatim (R1/R2). Classic dropped or overwrote it → D3. |

## D1 — "N times daily" becomes QD (clinical, every order type)
- **Where:** `src/lib/clinical/frequencyEngine.ts:196/198/200`. QID/TID/BID only match `TIMES (A|PER|EACH) DAY`. `THREE TIMES DAILY` falls through to the generic DAILY → QD.
- **Trigger:** `ACETAMINOPHEN 325 MG TABLET` / `Take 1 tablet by mouth three times daily.`
- **Current:** `1T PO QD 3GM` (classic already gives TID). The same applies to `2 times daily` → QD and `four times daily as needed for pain` → QD PRN. This **changes the prescribed frequency** and raises no finding. It also hits scales: `Inject per sliding scale … three times daily` → `CBS QD SS …`.
- **Expected:** `1T PO TID`, `1T PO BID`, `1T PO QID`, `CBS TID SS …`.
- **Fix:** accept `DAILY` as an alternative to `(A|PER|EACH) DAY` in those three patterns.

## D2 — Leading scale hold attaches to the wrong band
- **Where:** `src/lib/clinical/slidingScale.ts` band loop (`HOLD` capture, ~line 167). The text between two condition markers becomes the earlier band's action. In `… 200-249 4 units. Hold if blood sugar less than 70 and call MD.`, the word `HOLD` sits before the `<70` marker, so it is taken as an action of the 200-249 band.
- **Current:** `CBS QD SS <70=CALL MD;150-199=2U;200-249=4U&HOLD SQ`, with no finding. The draft says "hold" at 200-249 and drops the hold from <70. That is a scope change on an insulin dose.
- **Expected:** `CBS TID SS <70=CALL MD&HOLD;150-199=2U;200-249=4U SQ` (with D1).
- **Fix:** about 4 lines. If a band's action text ends with `HOLD|CALL X|NOTIFY X` + `IF|FOR|WHEN` [+ BS/BG], cut it and prefix it to the next band's action. Action order inside a band follows the existing code's CALL-then-HOLD order. Root may prefer source order.

## D3 — Classic translator silently drops later clauses, including a second dose
- **Where:** `src/lib/sigEngine.ts` `parseSigOrder`. Dose, frequency and PRN are read from the whole text. `splitSupplementalDirections` is used only for the meal qualifier, and the supplemental text is never rendered.
- **Triggers / current:**
  - `Take 1 tablet by mouth in the morning and take 1 tablet by mouth at noon.` → `1T PO QAM`. The noon dose is lost.
  - `Give 1 capsule by mouth in the morning and give 2 capsules by mouth at bedtime.` → `1C PO QHS`. The morning dose is lost and the bedtime dose is changed from 2 to 1.
  - `… with breakfast and dinner. Check blood sugar before breakfast.` → monitoring lost. The existing test `exclusionRefinement.test.ts:48` expects classic to drop `DO NOT TAKE WITH BREAKFAST AND DINNER`. That locks in the loss of a negative instruction that the clinical path keeps.
- **Expected:** `1T PO QAM. TAKE 1 TABLET BY MOUTH AT NOON`, `1C PO QAM. GIVE 2 CAPSULES BY MOUTH AT BEDTIME`, `… CHECK BLOOD SUGAR BEFORE BREAKFAST`, each with the warning `retained-supplemental-instructions`.
- **Fix:** when a supplemental clause exists *and the primary clause has a parsed dose*, read dose, route, frequency and PRN from the primary clause and append the supplemental clause verbatim. Treatments and scales keep their existing classic behavior. The existing test is **tightened** to expect the kept prohibition, not loosened.

## Artifacts (`audit-2026-11-18/`)
- `fix.patch`: unified diff against 11fa35b covering `frequencyEngine.ts`, `slidingScale.ts` and `sigEngine.ts`, plus a one-line expectation update in `tests/exclusionRefinement.test.ts`.
- `audit20261118Holdout.test.ts`: on baseline, the 5 defect tests fail and the 2 controls pass. With the patch, all 7 pass. `exclusionRefinement.test.ts` passes with the updated line (17/17 across both files).
- **Full suite with the patch:** 1270 passed, 12 failed. The failures are the 4 environmental prototypePackage tests (they fail on baseline too), 7 load timeouts (all 7 pass in isolation), and the 1 intended expectation change.
- `holdout-corpus.ts.txt`, `holdout-baseline.jsonl`, `holdout-after.jsonl`.

## Limitations
- I did not run Windows/native, lint or typecheck here. The root should rerun the CI matrix.
- **D3 scope:** classic now outputs supplemental text for any dosed order that has a later action clause. Before this, classic output was shorter. The dataset/Workbench tests passed in isolation, but Queue drafts will be longer for these orders. That is intended: nothing is dropped.
- **Classic on treatments** (T1–T3) still outputs frequency-only drafts (`QD`, `BID X14D`). It looks like classic is not the treatment path, but I didn't prove that. If it is reachable for treatments, it is a further loss.
- **T5** `BID for 10 days, then as needed` → `BID PRN X10D` with no finding. This may fall outside the Nov17 sequential fix because PRN is not a SCHEDULE token. It is a likely residual for the next commit (flag `treatment_sequential_schedule` when `THEN` is followed by PRN).
- The S6 partial-translation design is still open.

## Next increment
1. T5: extend the sequential-phase detector to a `THEN AS NEEDED`/`THEN PRN` phase, in both the drug and treatment paths.
2. S6/S2: return the basal dose as its own translated clause (`INJ 12 UN SQ QHS`) next to the translated scale, only when both components parse completely. Otherwise keep the current passthrough.
3. Classic treatments: route treatment-like classic input through the clinical treatment engine, or flag it.
