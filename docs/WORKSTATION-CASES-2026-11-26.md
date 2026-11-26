# Workstation evidence and discrepancy fixes

The review used prototype `cc358c88b89ad5262196ef70da72c569bfdeeb08` and the newly supplied workstation exports. Private files remain outside the repository. The first implementation checkpoint is `d359ed987a15458d7627fa8ecb410759620aa706` on `codex/workstation-cases-2026-11-26`.

## Report inventory

The active export contains eight reports covering six distinct drug/direction inputs. The archive contains 168 archived reports covering 159 distinct inputs. Report IDs have no overlap between the two exports. The second cholestyramine report corrects lunch timing, and the second Tylenol report adds the omitted daily-limit code. These later comments guided the repaired output.

| Report positions | Change |
| --- | --- |
| 1 | The regimen boundary now recognizes MILLILITER and MILLILITERS before INHALE. The PRN nebulizer and scheduled seven-day course receive separate cards with their own frequency, indication and duration. WHEEZE resolves to the existing FWHZ code. |
| 2 | Repeated AS NEEDED FOR and FOR wording no longer obscures the pain indication. The result is `1T PO Q6H PRN FPAIN`. |
| 3–4 | The reported cholestyramine light 4 g single-packet preparation is added. The administration schedule and lunch timing precede the complete parenthesized other-drug instructions. Explicit source mixing remains authoritative. |
| 5 | The site's explicit ENTERALLY wording resolves to ETUBE before oral-product defaults can replace it. Named G, PEG, J and NG routes retain their own codes. Conflicting oral/enteral directions produce a review finding. |
| 6 | Enteral PEG 17 g packets reach the existing packet preparation template, with ETUBE, the morning schedule and constipation indication. The existing template uses `1 PACKET` and `IN 8OZ`. |
| 7–8 | The stated 650 mg dose and 325 mg tablet strength calculate two tablets. The reported `2T650` preference applies. ETUBE, the pain indication and the existing institutional 3GM code survive assembly. |

## Cholestyramine wording and site codes

The supplied template uses DIS and H20. The root reference expands DIS as DISSOLVE. The product label describes mixing the powder to a uniform consistency and gives other-medication spacing of at least one hour before or four to six hours afterward. The generated draft keeps the requested site wording and four-hour spacing, with a visible pharmacist-review finding for preparation and product verification. The malformed original parentheses and schedule placement were repaired. QDW/L follows the technician's latest lunch correction and carries a Preview Sig verification finding because it is absent from the root reference. [DailyMed product label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4c9d4561-d5b5-463b-ac57-1bc4d84d135d)

## Archive replay

All 168 archived reports were replayed using their recorded exclusions and available indication/template context. Outputs for 165 remain identical to the baseline. Two cholestyramine cases gain their preparation and spacing text. One eye case loses duplicated PRN wording while retaining its unverified `1 UNIT` dose for manual review. All 41 previous exact matches to technician text remain, and one additional cholestyramine case now matches exactly. Text equality here measures agreement with the saved correction, while clinical acceptance still requires review. Archived correction fields include older formatting and incomplete text and were not copied wholesale into expectations.

## Native and intake evidence

Seven desktop captures report the current v0.1.13 build and complete scans of the remembered Framework window. Six expose the E-Rx work queue, and one exposes patient orders. Directions views are hidden and Rx Entry draft controls are absent from these captures. The data establishes these workflow views and grid reach. A current directions-editor and Rx Entry capture is still needed to validate draft SIG, quantity, days-supply and date bindings.

Five Iguana diagnostics show successful intake alongside two short connector failures reported as CONNECTOR_ERROR. The sanitized exports do not identify their underlying exception. The source parser also quarantines an incomplete SCRIPT envelope. Bounded event/payload retention is visible in the exports. Existing quarantine and queue-preservation behavior remains appropriate for this evidence.

The dataset batch contains 38 source observations and two technician-confirmed rows. One confirms the nebulizer split correction. The other marks a fixed insulin SIG acceptable and requests consideration of a 28-day opened-product days-supply cap. That comment is recorded for product-specific quantity/days-supply work. The current reviewed-entry fields take technician-supplied values.

## Verification

The complete local suite passes 1,403 tests in 96 files. Full lint, TypeScript production build, the root 388-code reference check and portable package checks pass. After restoring the requested H20 spelling, the ten new regression cases pass again, and archive replay retains every earlier exact match. The release is packaged as v0.1.14. Prototype runtime commit `40676c0ffb547d5991941ea22abdf2029f3dfbfd` passed [GitHub run 45769968338](https://github.com/1456319/Sig-Assist/actions/runs/45769968338) on Windows and Linux, including all 1,403 tests, native desktop fixtures, actual Edge/clipboard and direct-file workflows, launchers, Iguana, pilot recording and prototype publication. The published v0.1.14 package reports build `b16a60d0bf56` and matches the verified source. This final verification note is preserved on the workstation-cases branch.
