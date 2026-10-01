# Six additional discrepancy cases — October 1, 2026

The export at 07:03:56.560Z contained the original four reports and six new reports. The original reports remain in their existing fixture. The six new records, including their original corrections, notes, build fingerprint and context, are preserved in `tests/fixtures/reported-discrepancies-2026-10-01-batch2.json`. Reports are evidence to investigate; submitted corrections do not automatically become rules.

| Case | Result and rationale |
| --- | --- |
| Eye drops without an interval | `1G OS PRN FOR EYE COMFORT PER OPTOMETRIST`. Keeps drop quantity and left-eye route, adds no QD, and displays **Missing Frequency** for review. Keeps source “comfort”; the submitted “discomfort” changes meaning. |
| Diclofenac neck/ear | `AP 2GM TPCL TO NECK, UP TO LEFT EAR QID FOR NECK PAIN`. Preserves the complete application site and indication. Shows the added institutional dose default and a pharmacist verification notice for the site/dose. Explicit gram quantities override the default. |
| Acetaminophen | `2T (1000MG) PO Q8H PRN FPAIN 3GM`. The source says only “Pain”, so no neck location can be inferred. The calculated dose follows the existing two-tablet 500 mg rule. |
| Multiple weekdays | `1T PO QDDAY2467 FOR LOW THYROID HORMONE`. Keeps Tuesday, Thursday, Saturday and Sunday. Retains the actual drug and indication; does not diagnose or change therapy. |
| Blood clot prevention | `1T PO QD FBCP`, using the exact dictionary phrase. |
| PEG 17 g packet | `MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD FCON`. Shows **PEG Packet Preparation Added**. Blends actual frequency, PRN status, duration, indication, hold and stop into the preparation template. |

Indications now match dictionary macros only when the complete phrase matches. “Pain” can become FPAIN; “neck pain”, “hip pain”, “severe pain rated 7–10” and combined diagnoses retain their words. Recognizable ICD-10 codes are removed while other parenthetical details and terms such as vitamin B12 are retained. The same rule applies to XML fallback indications. This also updates the previous shampoo regression to omit L21.0 and the previous hip-pain regression to keep “FOR HIP PAIN”; their original report records are unchanged.

Weekday lists and simple inclusive ranges preserve every day. Unsupported alternate-week schedules, conflicting frequencies and schedule qualifiers retain the original directions with a review notice rather than silently becoming a first-day-only SIG. Eye directions with ambiguous quantity, laterality or conflicting routes likewise remain intact for manual translation. A PRN dose with no supplied interval can be proposed with a missing-frequency notice; an explicit unrecognized interval is retained for manual translation.

The PEG template is restricted to a recognized PEG/Miralax product explicitly identified as 17 g, an explicit one-packet oral dose, and no source mixing instructions. It is not applied to other powders, other strengths, unspecified strengths, electrolyte combinations or two-packet doses. A provided technician template takes precedence. Explicit source preparation is retained intact for review instead of overwritten.

## Reference checks

- `docs/Sig Codes (searchable).docx`: 1G = one drop; 2G = two drops; OS/OD/OU = left/right/each eye; FBCP = blood clot prevention; QDDAY2467 = Tuesday/Thursday/Saturday/Sunday. QD/QAM/QPM weekday families contain all 126 proper nonempty subsets of Monday=1 through Sunday=7. An all-days schedule uses the corresponding daily code.
- `TESTS.txt` and the existing packet-template regression supply the institutional `MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO` text.
- [DailyMed PEG 3350 packet labeling](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cccbe459-813d-4668-8cd2-76be82906a32), checked October 1, 2026: one packet is 17 g and is dissolved in 4–8 oz of beverage. The app uses the requested institutional 8 oz water template as a visible addition; it does not infer other treatment instructions or duration from OTC labeling.
- [DailyMed diclofenac sodium 1% gel labeling](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f21afee1-b556-4231-a18a-daaf9af6d2e2), checked October 1, 2026: labeled 2 g sites are hand/wrist/elbow; 4 g sites are foot/ankle/knee. These categories do not establish a neck/ear dose. The existing default remains a reviewable institutional suggestion with a verification notice, not a labeled neck dose.

## Validation and use

Regression tests cover all six records and neighboring eye routes, indication qualifiers, ICD-code handling, weekday lists/ranges, preparation overrides and product/quantity exclusions. Windows browser smoke tests replay all ten records through the shipped Workbench and actual clipboard, and check that missing frequency, unverified site/dose and added preparation notices appear. Existing report saving/export, copy review, source revision, saved draft and cancellation checks remain in place.

Export saved reports before replacing demo files. Extract the updated demo in the same folder to preserve its browser storage location, then reopen it. Existing saved drafts are not rewritten; re-enter the directions in Workbench or review and select **Use calculated suggestion** in Queue. A different build invalidates previous review approval while preserving draft text. Verify each proposed SIG and its Framework preview before copying.
