# Latest discrepancy export — October 1, 2026

The 09:31:43.647Z export is preserved unchanged in `tests/fixtures/reported-discrepancies-2026-10-01-batch3.json`. Its 24 records include the preceding ten reports, thirteen additional clinical cases and a duplicate pantoprazole report requesting **Clear all fields**. Source directions, submitted corrections and notes remain separate; corrections are evidence, not automatically accepted translations.

## Root SIG reference

`scripts/generate-clinical-code-reference.py` compiles 194 relevant indication, duration and administration codes from the root `Sig Codes (searchable) (1).docx` into an offline lookup. The generated source records the document SHA256 (`f7016a5c61d08efd4d478500621501c5caf5566cbdd14538ca18b3a478d69dd2`). CI checks that it matches the document on Linux and Windows.

Complete matching indications now use verified codes such as FNEU, FAFIB, FSP, FDE and FPRO. Conjunctions remain present: GERD and prophylaxis becomes `FGERD AND FPRO`. Unmatched qualifiers remain spelled out, including neck pain and severe pain rated 7–10. Recognizable ICD-10 codes are omitted; other clinical wording remains. FBM2–FBM5 condition intervals are protected so they do not become treatment durations. Duration codes are used only when present in the reference; unsupported, conflicting or unmarked course intervals retain the original directions for review.

## New records

| Case | Result |
| --- | --- |
| Timolol right eye | `1G OD QAM FOR PRESSURE IN THE EYE`. Removes only the identical repeated dose/eye/schedule, with a visible notice. Changed eye, schedule or extra instructions remain. |
| Potassium chloride 20 mEq/15 mL | `ADM 15ML (20MEQ) PO QD FSU`. Computes the total from the provided concentration. |
| Mupirocin | `AP TPCL TO STERNUM AND UPPER BACK QD (DURING DAY SHIFT) X14D FOR HEALING SITE. FOLLOW TAR`. Keeps both sites, shift, duration and TAR instruction. |
| Prednisolone eye drops | `1G OS TID X7D FOR S/P CATARACT SURGERY`. Deduplicates the identical seven-day course. |
| Nystatin suspension | `SSW 5ML PO QID X7D FOR THRUSH`. Uses the source swish-and-swallow instruction. |
| Pantoprazole packet | Appends `BIDAC FGERD` to the explicitly supplied preparation template. Flags its DISSOLVE wording for pharmacist review; the template is not validated as a product-label instruction. |
| Eliquis 2.5 mg tablet | `1T PO BID FAFIB`. Uses the stated single-ingredient tablet strength. ELIQUIS no longer matches the LIQ liquid-form substring. |
| Neuropathy | `1C PO BID FNEU`. |
| Diclofenac knee and hand | `AP4GM TPCL TO KNEE AND HAND QID PRN FPAIN`. Keeps the explicit four grams once, all sites and the frequency after the indication. Mixed-site dose requires verification; no per-site quantities are invented. |
| NDC 47335075649 ipratropium/albuterol | `1V NEB Q6H PRN FSOBW`. Converts 3 mL using this verified 3 mL unit-dose vial presentation and shows the conversion. |
| Omeprazole | `1T PO QD X2WK FGERD AND FPRO`. Keeps both indications and the two-week course. |
| Humalog sliding scale | `CBS ACHS SS 151-200=2U;201-250=4U;251-300=6U;301-350=8U;351-400=10U;401+=12U&CALL NP/PA`. Keeps the last band, dose, units and actual notification recipient. UNIS → UNITS is disclosed. An unparsed numeric band or unfamiliar plus-band notification retains the entire source for manual translation. |
| Simethicone colonoscopy preparation | `2T (250MG) PO X1 ONLY FOR UPCOMING COLONOSCOPY PROCEDURE PER DR. LONG UNTIL 10/12/2026 15:00. DRINK WITH SECOND BOTTLE OF GATORADE`. Preserves one-time dosing, deadline and preparation instructions; adds no QD. |

Oral solid quantities calculated from milligram doses require an explicit single strength and compatible route/form. Unknown strengths, combination products, unsupported fractions and fractional capsules retain the original directions. Calculated quantities are visible corrections requiring review.

The two earlier nebulizer records identify no drug or vial presentation. They now retain their full directions with **Unverified Nebulizer Vial Quantity** rather than proposing an unverified vial count or an mL-based nebulizer SIG. They require product identification before a machine SIG can be established. Explicit one-vial nebulizer doses are supported without a volume assumption.

**Clear all fields** clears drug, template, directions, generated/editable result and review state. Saved discrepancy reports remain in their separate archive. Report saving remains explicit through **Flag Discrepancy → Save Discrepancy Report**; reports stay local until exported.

## Reference checks

- [DailyMed ipratropium bromide/albuterol sulfate label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=38f9a201-3954-4370-8e71-7ec2df88a1ff), checked October 1, 2026: NDC 47335-756-49/52 identifies 3 mL unit-dose vials for nebulizer use. This does not establish a universal 3 mL = one vial rule.
- [DailyMed PROTONIX label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=08098cb2-c048-4640-f387-6beec4a38936), checked October 1, 2026: delayed-release granules can be administered in one teaspoon of apple juice; the granules do not dissolve. The user-supplied template's wording therefore requires review.
- The root SIG reference supplies SSW, SSP, 1V, NEB, AP4GM, LT/RT, BIDAC and the indication/duration codes. Unsupported meal-frequency combinations retain BEFORE MEALS rather than using an absent code.

## Validation and updating

The complete export and neighboring route, concentration, quantity, duration, duplicate-direction and sliding-scale cases have regression coverage. The Windows Edge smoke checks replay all 24 records through Workbench, verify review notices and the actual clipboard, and verify that clearing fields retains the case archive. Existing queue recovery, source revision, cancellation, report saving/export and direct UNC/file launch checks remain.

Export reports before updating. Extract into the same demo folder and reopen. Existing saved drafts are not rewritten: re-enter directions in Workbench or choose **Use calculated suggestion** in Queue and review the result. A changed build invalidates previous approval while preserving draft text. Verify each proposed SIG and Framework preview before copying.
