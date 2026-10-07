# October 6 active discrepancy fixes

The corrected export contains 13 new reports. The replay fixtures retain drug names and directions, with a synthetic clinician name and phone number in the insulin example. Report IDs, order identifiers and patient/desktop context are excluded.

The shared clinical extractors now recognize:

- `HLD` → `FHYL`, `CKD` → `FCKD`, and `DMII` → `FDM2`, using the root SIG dictionary.
- Misplaced PRN frequency wording such as `as needed for BID PRN FOR SYSTOLIC GREATER THAN 160 MMHG` → `BID PRN FOR SBP >160MMHG`. Comparisons, equality and thresholds are retained.
- Explicit intramuscular, subcutaneous and intravenous injection routes and gram doses. Missing or conflicting routes require review; they no longer default to `SQ` or produce a bare `INJ` without a dose.
- The reported 1 g IM ertapenem preparation, including 3.2 mL lidocaine 1% and multiple sites, as a visible site-template correction. This addition requires verification of diluent suitability, preparation and injection sites. It does not apply to IV orders, other doses or explicit alternative preparation instructions.
- Lidocaine patch application separately from removal. Explicit patch counts and indications remain intact. The reported one-patch and 12-hour on/off defaults are visible corrections. Q12 application/removal and morning/bedtime interpretation are also flagged for verification. Other wear intervals remain explicit; unsupported or conflicting removal instructions retain the source wording. Other patch products do not receive lidocaine defaults.
- The named ipratropium/albuterol 0.5 mg/2.5 mg per 3 mL solution presentation as `1V NEB` for a 3 mL inhaled dose, with a product-verification notice. Other concentrations and volumes do not inherit this conversion.
- A single rectal enema, with the one-time course and in-house supply instruction preserved; `QS` for every shift while retaining all topical sites.
- MiraLax Mix-In Pax packets as the reported 17 g preparation, and explicit PEG mixing alternatives such as 6 oz juice **or** water. Unknown packet strengths, combination products and unsupported preparation wording do not inherit the template.
- Named insulin-scale recipients and phone numbers, with both the band-specific notification and the separate threshold instruction retained. Unsupported bands, extra actions or notification clauses retain the complete scale.

Expected outputs preserve details sometimes omitted from the technician examples: the rib-fracture location, pain indication, severe constipation wording, insulin route/diagnosis and both source notification clauses. These are intentional differences, not lost corrections.

The discrepancy form now focuses its SIG field when the form opens, without a delayed timer that could steal focus after the technician starts entering Notes. The browser check verifies the two fields remain separate in the saved export.

`12ON`, `1PA`, `1E` and `QS` are generated from the root DOCX reference. Regression tests cover all 13 cases plus variations and unsupported inputs. The browser smoke test replays all 13 through Workbench, checks review notices and verifies actual clipboard text after acknowledgment. The portable HTML and ZIP must be rebuilt alongside these source changes.
