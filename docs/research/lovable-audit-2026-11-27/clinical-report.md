# Functional audit 2026-11-27 — Sig-Assist prototype @ 1a0105c (v0.1.16)

Source: fresh codeload tarball of 1a0105c435da70bb5bb45dd20200e3dca189527e in /tmp (not the lab mirror). Synthetic inputs only.
Read: docs/research/LOVABLE-MORNING-HANDOFF-2026-11-27.md; clinical sources named below. SESSION-2 and SOL-2026-11-24 reviews were not read in full this allocation.

## Executed
- 10-order novel holdout (5 scales, 5 treatments), both `translateClinicalSig` and `translateFreeTextSig` (audit-2026-11-27/holdout-corpus.ts.txt, holdout-baseline.jsonl).
- New tests audit-2026-11-27/audit20261127Holdout.test.ts: **2 fail on 1a0105c, 4/4 pass with fix.patch**.
- Full suite with patch: 1429 passed + 4 new; 4 failures only in tests/prototypePackage.test.ts (need a git checkout; tarball has none — expected unrelated). Windows/Edge/native not run.

## F1 — Glucagon rescue dose overwritten with 1ML (dose invention)
- Source: src/lib/clinical/slidingScaleProse.ts:101-107. Any GLUCAGON band strips the stated dose and pushes the fixed `1ML GLUCAGON IM`.
- Trigger: `... less than 70 give glucagon 0.5 mg IM and call MD, 150-199 2 units, 200-249 4 units.`
- Current: `<70=1ML GLUCAGON IM&CALL MD` (both paths). Finding says "compare the source" but the draft states a different dose.
- Expected: `<70=0.5MG GLUCAGON IM&CALL MD`; 1 mg / 1 mL / no stated dose keeps the technician template `1ML GLUCAGON IM`.
- Fix: capture the stated amount; use the template only when absent or 1. Tests: `glucagon_rescue_keeps_stated_non_template_dose` (baseline fail), `glucagon_rescue_1mg_control_keeps_site_template` (control).

## F2 — Routine/PRN treatment split drops shared duration from routine card
- Source: src/lib/clinical/treatmentOrderEngine.ts:79 (`parseModifiers`, PRN regex). `FOR ([^.;]+)` swallows `FOR 14 DAYS` into the PRN reason, so the duration extractor never sees it and `render('routine')` (which excludes prnReason) has no course.
- Trigger: `Apply to sacrum every shift and as needed for incontinence for 14 days.` (zinc oxide)
- Current: `TO SACRUM:APPLY ZINC OXIDE QS **SPLIT** TO SACRUM:APPLY ZINC OXIDE PRN FOR INCONTINENCE FOR 14 DAYS` — routine card is open-ended, no finding. Classic path: `PRN FOR INCONTINENCE X14D` (routine schedule lost; see open items).
- Expected: routine `... QS X14D`; PRN `... PRN X14D FOR INCONTINENCE`.
- Fix: stop the PRN reason before a `FOR|X <n>` duration (negative lookahead). Tests: `treatment_routine_prn_split_keeps_shared_duration_on_routine_card` (baseline fail), `treatment_prn_reason_without_duration_control`.
- Limitation: PRN card renders duration before reason; order is cosmetic, both kept.

## Static/observed, not patched
- Classic path loses treatment structure: T1 drops routine QS; T2 → `QD`; T4 → empty; T5 → `BID X7D` (second phase lost). Clinical path keeps them. Unknown whether the classic path is used for treatments in the UI — verify before fixing.
- T3 lidocaine "apply in the morning and remove at bedtime ... on 12 / off 12" → clinical `1PA TPCL TO LOWER BACK QAM 12ON`: "remove at bedtime"/off interval not shown; confirm against the site 12ON template meaning.
- T4 "every shift on day shift and evening shift" → raw passthrough with manual finding (safe, untranslated).
- S2 (gap 250-399, "over 400 call MD and recheck") → whole-source fallback with `incomplete_sliding_scale` (safe).
- S1/S5 long scales fit 199 here; split budget combined with scale not stressed further.

## Not audited this allocation (workstation-unknown / later)
- Sweeper FINAL invariant (batch date, full 3-day quantity, DS3, delivery ID 9…): no code read; no claim.
- Reader/events/ratings items from the handoff.
- Bounded regex performance controls on the new lookahead (pattern is linear; unmeasured).
