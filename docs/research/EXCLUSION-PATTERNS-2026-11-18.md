# Saved-exclusion pattern audit — 2026-11-18

Read-only audit of the supplied list; `Undo` is UI text and was ignored. No private records or external service was used. Probes used made-up directions/products against the clinical, classic and output-policy entry points, without saved exclusions. Findings describe the source before any follow-up repair in this report's families. The source includes the November17 clinical audit fixes; packaging/version work does not change those engine results.

This list is valuable correction evidence, but it is not a set of interchangeable global string rules. Some rows are aliases, some are product/packaging conversions, and some reject a complete output without specifying its accepted replacement. A dataset should retain original directions, product context, raw generated output, output after preferences, the actual edited final output, exclusion snapshot, build ID and observation stage. A copied/entered draft is not evidence that Framework saved it unchanged.

## Reproduced priorities

| Family and made-up input | Current clinical result without exclusions | Decision |
|---|---|---|
| METFORMIN500MG; `Take 1 tablet by mouth twice daily with breakfast and dinner.` | `1T PO BID WITH BREAKFAST`, no finding | **Actual omission:** dinner disappears. `frequencyEngine.ts` recognizes WITH BREAKFAST independently but not the complete coordinated meal phrase. Preserve both meals and frequency; do not reduce the source to breakfast or infer a frequency for a missing one. |
| ALBUTEROL0.083% inhalation solution; `Inhale 3 mL via nebulizer every 4 hours as needed for shortness of breath or wheezing.` | `1V NEB Q4H PRN FSOBW`, vial-conversion finding | Already works for this verified3mL presentation. It does not establish all `3ML`/`3 ML`/`3_ML` as one vial or a nebulizer route. |
| BUDESONIDE0.5MG/2ML inhalation suspension; `Inhale 2 mL via nebulizer twice daily.` | `ADM 2ML NEB BID`, volume-retained finding | Useful partial progress. Needs validated container/NDC presentation before reducing to1V. The same requirement applies to1,2,2.5mL rows. |
| ALBUTEROL HFA inhaler; `Inhale 2 puffs by mouth every 4 hours as needed for shortness of breath or wheezing.` | `2P PO Q4H PRN FSOBW` | Matches the user's rejected complete SIG. Need the accepted inhaler output and product context. A blanket INHALE→NEB would misclassify this device. Source currently selects PO when BY MOUTH is present in the inhaler branch. |
| FLUTICASONE; `Administer 2 sprays into each nostril daily.` | `2SP ENOS QD` | Already works. |
| Same; `Administer 1 spray into alternating nostrils daily.` | `ADMINISTER 1 SPRAY INTO ALTERNATING NOSTRILS QD.`, partial finding | Still useful retained wording; alternating-site parsing needs the exact accepted site code/expansion. ALTNOS is user-reported but absent from the bundled388-code reference. |
| `Give 2 packets by mouth daily.` with a4g packet | `2PKT PO QD` | User wants ADMINISTER2PACKETS. 2PKT is absent from the bundled reference; no built-in restriction prevents it. A count-aware multiunit renderer is preferable to dozens of saved rules. |
| `Apply 2 patches transdermally daily.` with a patch product | `2PA TRANSDERMALLY QD` | Same multiunit issue; user wants APPLY2PATCHES. 1PA exists in the root reference; 2PA does not. Absence alone does not prove site rejection, but here the user supplied that preference explicitly. |
| RIVASTIGMINE9.5MG/24HR patch; `Apply 9.5 mg transdermally daily.` | Original dose retained as partial text | A9.5mg→1PA conversion needs that exact patch presentation and prescribed release-period context. Do not infer a patch from APPLY or milligrams alone. |
| ERGOCALCIFEROL50000UNIT capsule; `Give 50000 IU by mouth every Friday.` | `1C PO QDDAY5`, strength-derived quantity finding | Already works when the printed capsule strength and explicit PO route are supplied. Never turn every50000IU order into1C. |
| Tablet; `Take 1 tablet by mouth daily every 3 days.` / `...every Friday.` / `...every shift.` | `1T PO QDQ3D` / `1T PO QDDAY5` / `1T PO QS` | These patterns are already handled by the current clinical engine. Keep dates/day/shift variants in the real corpus rather than reintroducing output substitutions. |
| APAP325mg tablet; `Give 2 tablets ... pain or fever. Do not exceed 3000 mg per day.` | `2T (650MG) PO Q6H PRN FPAIN OR FFEV 3GME. DO NOT EXCEED 3000 MG PER DAY.` | Dose and daily limit are recognized, but source limit is redundantly retained and the indication pair isn't collapsed to the user's FP/F convention. Limit deduplication must compare substance, amount and time period. |
| APAP500mg tablet,2tablets, explicit maximum3000mg/day | `2T (1000MG) ... 3GME. MAXIMUM OF 3000 MG PER DAY.` |2T1GM preference remains useful. A source-aware solid-dose formatter can choose the known2T1GM code; don't globally delete parentheses/mass.2T650 is user-reported and not in the bundled root reference. |
| Non-APAP tablet; `Take 1 tablet ... Maximum of 2 tablets per day.` | `1T PO QD. MAXIMUM OF 2 TABLETS PER DAY.` | Entire limit is retained and flagged. Generic MAXIMUM→NTE is a display convention, not permission to delete limits or replace them with an APAP-specific code. |
| ONDANSETRON ODT; `Place 1 tablet on the tongue and allow to dissolve every 6 hours as needed for nausea or vomiting.` | `DIS 1T PO Q6H PRN FNV` | Already works with explicit ODT product context. Do not remove the administration instruction from an unknown formulation. |
| PANTOPRAZOLE; `Take 1 tablet ... for GERD without esophagitis.` | `1T PO QD FOR GERD WITHOUT ESOPHAGITIS` | The current clinical engine retains the qualifier and does not reproduce standalone WITHOUTESOPHAGITIS. An original source/final pair is needed to explain that rejected whole-SIG fragment. |

## Alias coverage: small, context-independent candidates

Current exact phrase resolution was probed separately from doses. These additions can be kept as a small reviewed alias table rather than growing final-output regexes.

| Supplied family | Already works | Remaining exact gaps |
|---|---|---|
| Hyperlipidemia/depression/diarrhea/CAD/wound healing | Full HYPERLIPIDEMIA→FHYL; DEPRESSION→FDEP; DIARRHEA→FDIA; CAD→FCAD; WOUNDHEALING→FWH | HLD is retained as FORHLD; an HLD→HYPERLIPIDEMIA indication alias would let the known expansion choose FHYL. |
| SOB/wheezing | SHORTNESSOFBREATHORWHEEZING and SOBORWHEEZING→FSOBW | WHEEZINGORSOB→FWHZORFSOB; comma forms and FWHZ/FSOB variants remain separate. Only consolidate known equivalent site phrases, retaining unknown qualifiers and negation. |
| Nausea/vomiting | NAUSEAORVOMITING and NAUSEAANDVOMITING→FNV; the latter raises the existing site-convention finding | N/V stays FORN/V. Output FNAU/FVOM becomes FNAU/FORVOMITING because the hard FVOM restriction fires before any suitable combined alias. Normalize a complete combined indication before applying single-code restrictions. |
| Cough/congestion | COUGHANDCONGESTION→FCC | COUGHORCONGESTION stays FCOUORFCOG and code-pair FCOU/FCOG is unchanged. The user's combined code preference needs explicit treatment of conjunction semantics, as FNV already does for a site convention. |
| AFIB/insomnia/muscle spasm/overactive bladder | AFIB and A-FIB→FAFIB; INSOMNIA→FINS; plural MUSCLESPASMS→FMUS; OVERACTIVEBLADDER→FOAB | A.FIB, INSMONIA typo, singular MUSCLESPASM, OAB not recognized. These are narrow alias candidates. |
| UTI prevention | UTI→FUTI; UTIPREVENTION→FUTIP | UTIPROPHYLAXIS and typo PROPHYLAXSIS remain verbatim. The user reports UTIP while the bundled reference has FUTIP. Need the intended UTIP expansion/site convention, not an assumption that they are identical codes. |
| Loose-stool timing | FORDIARRHEA→FDIA | AFTEREACHLOOSESTOOL is retained with partial translation; it doesn't produce AELS. AELS is user-reported and absent from the bundled reference. Preserve the triggering event if adding a site alias. |

The literal abbreviations SX, S/S, BM, PPX, URI, MGT, R/T, MDD, D/T, CRCL, VIT, DEF, HX, ABD and BILATERAL are normalization/expansion candidates only in the relevant context. Don't expand arbitrary substrings inside product names/codes or let diagnostic phrases supply a medication frequency. Keep the source text unchanged alongside normalized features.

UNSPECIFIED and RECURRENT deletion is a technician formatting preference, not a universal semantic equivalence. The supplied blank-looking character is Hangul Filler U+3164, not an empty string. Preserve the exact exclusion and final output in the dataset so intentional omission isn't confused with a parser omission or an invisible-character artifact. The bare ADMISSIONORDER and tongue/dissolve exclusions have no stated replacement; ask the corpus to show accepted results rather than interpreting them as unconditional deletion rules.

## Classic versus clinical path

The clinical path is used by OrderQueue and preferred by Workbench when it returns a result/findings. Classic translation remains a separate entry point/fallback; its behavior is not equivalent. In these probes classic omitted meal/route information from several examples and rendered the9.5mg patch example as INJ9.5MG TRANSDERMALLYQD. This is not the normal clinical result, which retains the original patch dose for review. Store engine/path and generated output in the dataset; don't call a classic-only failure proof that the current clinical UI failed in that way.

## Practical refinement order

1. Repair the demonstrated breakfast+dinner omission with a focused source-to-output test before large corpus work.
2. Add narrow indication alias coverage with controls for retained qualifiers; normalize combined known indications before individual-code restrictions.
3. Render unsupported multi-packet/multi-patch quantities as the user's explicit text while preserving count/route. Keep user-reported codes separate from the generated root dictionary; don't hand-edit `sigCodeReference.ts`.
4. Retain dose/formulation evidence for vial, enema, capsule and patch conversions. Needed fields: full selected drug, NDC when known, strength/concentration, dosage form, container volume/packaging, route and original quantity. A label or volume alone is not a container count.
5. Collect source, suggestion before/after exclusions, actual edited final SIG, structured context, exclusions and technician outcome. Split records by observed stage; don't silently label copied or transferred text as a saved order. Keep duplicates across patients available for frequency analysis while deduplicating repeated capture of the same observation.

## Supplied exclusions, normalized as rows

This is the user's preference evidence, not a new global rule list. Repeated Undo controls were removed; blank/missing replacements remain distinct.

```text
SIG: WITHOUT ESOPHAGITIS
Code: HLD → HYPERLIPIDEMIA
SIG: UTI TAKE
Code: INHALE → NEB
SIG: MAXIMUM OF
Code: MAXIMUM → NTE
Code: 3ML → 1V
Code: 3_ML → NEB
SIG: WITH BREAKFAST AND DINNER
Code: 2.5ML → 1V
Code: SX → SYMPTOMS
Code: FWHZ/FSOB → FSOBW
Code: UNSPECIFIED → ㅤ
Code: RECURRENT → ㅤ
Code: FSOB/FWHZ → FSOBW
Code: PPX → PROPHYLAXIS
Code: FCOU/FCOG → FCC
Code: S/S → SIGNS/SYMPTOMS
Code: BM → BOWEL MOVEMENT
Code: ㅤ-ㅤ → -
Code: FNAU/FVOM → FNV
Code: 2 SPRAYS → 2SP
Code: 2 SPRAY → 2SP
Code: ALTERNATING NOSTRILS → ALTNOS
Code: 1 VIAL → 1V
Code: 3 ML → 1V
Code: FOR DEPRESSION → FDEP
Code: **ADMISSION ORDER**
Code: URI → UPPER RESPIRATORY TRACT INFECTION
Code: AFTER EACH LOOSE STOOL → AELS
Code: FOR DIARRHEA → FDIA
Code: FOR MUSCLE SPASM → FMUS
Code: (HOLD → (H
Code: FOR LOOSE STOOL) → FLS)
Code: (H FOR → (H
Code: R/T → RELATED TO
Code: PLACE ON THE TONGUE AND ALLOW TO DISSOLVE
Code: FOR PAIN → FPAIN
Code: MGT → MANAGEMENT
Code: QD EVERY 3 DAY(S) → QDQ3D
Code: FOR SHORTNESS OF BREATH, WHEEZING → FSOBW
Code: 2.5 MG NEB → 1V NEB
Code: BILATERAL → BIL
Code: FOR A. FIB → FAFIB
Code: EVERY SHIFT → QS
Code: UNSUPERVISED SELF-ADMINISTRATION. → (UNSUPERVISED SELF-ADMINISTRATION)
Code: FWHZ/ FSOB → FSOBW
Code: FWHZ OR FSOB → FSOBW
Code: FOR HYPERLIPIDEMIA → FHYL
Code: 2PKT → ADMINISTER 2 PACKETS
Code: 2 ML → 1V
Code: GIVE 50000 IU → 1C
Code: QD EVERY FRI → QDDAY5
Code: VIT → VITAMIN
Code: DEF → DEFICIENCY
Code: HX → HISTORY OF
Code: DAILY → QD
Code: 118 MILLILITER → 1E
Code: 1 SPRAY → 1SP
Code: APPLY 9.5 MG → 1PA
Code: MDD → MAJOR DEPRESSIVE DISORDER
Code: D/T → DUE TO
Code: CRCL → CREATININE CLEARANCE
Code: FSOB/ FWHZ → FSOBW
SIG: 2P PO Q4H PRN FSOBW
Code: FOR OAB → FOAB
Code: FOR WOUND HEALING → FWH
Code: 2PA → APPLY 2 PATCHES
Code: FOR WHEEZING, SOB → FSOBW
Code: FOR N/V → FNV
Code: FOR INSMONIA → FINS
Code: UTI PROPHYLAXSIS → UTIP
Code: ABD → ABDOMINAL
Code: FOR CAD → FCAD
Code: 1 ML → 1V
Code: UNSUPERVISED SELF-ADMINISTRATION → (UNSUPERVISED SELF-ADMINISTRATION)
Code: 2T (1000MG) → 2T1GM
Code: 2T (650MG) → 2T650
Code: FPAIN OR FOR FEVER → FP/F
Code: NTE DOSAGE 3000MG PER DAY 3GM → 3GME
```
