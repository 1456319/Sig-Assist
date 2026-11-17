# Final integration review 2026-11-17 (8636180)

Scope: read-only public tarballs of `8636180f6ac873f2c0c747afda620815e748bc68` and `b853b88` in `/tmp`; diffed `src/` (7 files: IguanaConnectorPanel, frequencyEngine, instructionClauses, slidingScale, treatmentOrderEngine, sigDictionaryService, sigEngine). Synthetic inputs only, no PHI. Pharmacy repo not edited, pushed or published. Patch and tests: `audit-final-integration/`.

**Correction.** The earlier claim that D2 (missing "matching" count) likely explained the pilot's 0 logs / no 7-day retry is **withdrawn**. The pilot showed the "No matching orders" banner, so zero saved candidates existed; D2 and the pilot result are independent.

**Verification.**
- Integrated as-is: 71 files, 1174 tests pass.
- New file `auditIntegrationSplitter.test.ts`, 7 tests: 5 fail on 8636180, 2 are controls that pass on both.
- Patched: 72 files, **1181 tests pass**; `tsc --noEmit -p tsconfig.app.json` clean. (One run hit a timing flake in `iguanaBridge.test.ts`; 36/36 on two re-runs and a clean full re-run.)

## N1 (high, regression vs b853b88): a comma-delimited primary schedule moves into the supplemental clause
- **Where.** `instructionClauses.ts`, `splitSupplementalDirections`, boundary loop. Boundaries are scanned earliest-first and a prefix may contain commas, so the first comma before `AT/BEFORE/ONLY/IN THE …` captures everything up to the later action.
- **Repro** (clinical engine):
  - `TAKE 1 TABLET BY MOUTH, BEFORE BREAKFAST, DO NOT CRUSH` — b853b88 `1T PO QDA/B. DO NOT CRUSH`; 8636180 untranslated with `partial_translation` (primary `TAKE 1 TABLET BY MOUTH`).
  - `INHALE 2 PUFFS, IN THE MORNING AND EVENING, MAY USE EXTRA PUFF IF NEEDED` and `GIVE 1 TABLET BY MOUTH, ONLY WHEN AWAKE, DO NOT GIVE IF SLEEPING` — same pattern. Negation itself is retained; the defect is that the primary schedule is lost.
- **Fix.** After a mid-sentence boundary (`,` / AND / THEN), reject a prefix that itself contains a comma. Sentence-initial prefixes (`. BEFORE BREAKFAST, RECHECK …`) keep their comma (existing `finalMonitoringClauses` test still passes), and `DAILY, AT BEDTIME TAKE 2` still splits.

## N2 (medium): scale footer qualifier after a route with no punctuation overrides the header schedule
- **Where.** Same function with `allowScaleActions`, called from `slidingScale.ts`. In `SQ BEFORE BREAKFAST GIVE HALF` no boundary precedes `BEFORE`, so only `GIVE HALF` is retained and `BEFORE BREAKFAST` merges into the common schedule.
- **Repro.** `INSULIN SLIDING SCALE ACHS: 151-200 = 2 UNITS, 201-250 = 4 UNITS SQ BEFORE BREAKFAST GIVE HALF` → both entry points `CBS QDA/B SS … SQ. GIVE HALF`. The ACHS header is replaced and the half dose loses its scope. The review finding does fire in both entry points.
- **Fix.** In scale mode only, treat the route token as a boundary. Result: `CBS ACHS SS … SQ. BEFORE BREAKFAST GIVE HALF`, with the finding.

## Controls confirmed (no new defect shown)
- With a period (`SQ. AT BEDTIME GIVE HALF …`), the footer stays separate and is flagged in both clinical and classic engines. A scale with no header schedule stays as the editable original, with `incomplete_sliding_scale`.
- Sequential treatment, exact/Docutrack PON with the 7-day retry keeping exact mode, broad typed search, no automatic selection, the "Show all saved" reset, and dictionary reread after every remote outcome are all covered by existing integrated tests. Diff inspection found no new gap.

## Remaining uncertainty
- `SLIDING SCALE AC/HS: … SQ. AT BEDTIME GIVE HALF …` yields `CBS AC SS`, so HS is not shown in the header. I did not trace whether this is a header-parse gap from before or a new one. It is flagged for review, so it was not patched.
- Credits: this was the last focused pass of the day's budget. No further probing was done.
