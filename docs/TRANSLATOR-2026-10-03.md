# October 3 translator regression fixes

The 17 exported reports are replayed in `tests/reportedDiscrepanciesOct3.test.ts`.
Fixtures contain only drug names, source directions and sequential case numbers;
patient, PON, prescriber and Iguana context are excluded.

## Behavior

- An unsupported formulation, amount or schedule no longer prevents abbreviation
  of recognized directions. Unknown wording remains in place, and the result
  shows **Partial Translation — Review Retained Wording**. An incomplete insulin
  sliding scale still retains the complete source without partial scale output.
- Unrecognized units cannot fall through to an assumed tablet count. Gram powder
  doses retain their mass. Missing intervals do not acquire QD.
- Numeric dose/schedule phrases support number words, leading decimals, common
  written fractions and Unicode fractions. Ranges, negative doses and invalid
  fractions remain visible for review.
- Explicit sublingual, rectal, vaginal and ear routes are recognized before
  generic product-name assumptions. Suppositories, lozenges and ear drops use
  matching codes compiled from the root reference.
- Alternate days, meals and empty-stomach wording are preserved. A repeated oral
  solid direction is consolidated only when its quantity, route and interval
  agree; additional morning timing and maximum dose counts are retained.
- Simple noncontrolled, immediate-release tablet doses between one and two
  tablets can produce whole/fractional Paxit cards with TAW and the same total
  dose on each card. Controlled products, modified-release products, capsules,
  ambiguous schedules and dose-code overrides are not automatically split by
  this new rule. Existing differential-dose and titration handling is unchanged.
- For the reported albuterol 0.083% inhalation product, an explicit 3 mL dose can
  use its labeled one-vial presentation, with an applied-correction notice.
  Other measured nebulizer doses keep mL unless the presentation is verified.
- PEG bulk powder recognizes the reported GlycoLax 17 g dose and adds the local
  8 oz preparation proposal with a visible correction. Packet and bulk-container
  wording remain distinct. Source preparation instructions take precedence.

## Source-dependent decisions

The report's magnesium hydroxide product lacks concentration. Its 30 mL dose is
translated, with a missing-strength finding; 2400 mg is not assumed. Stated
1200 mg/15 mL and concentrated 2400 mg/10 mL products calculate independently.

The root `LOR1MG` expansion is `ADMINISTER 0.5 ML (1 MG)`. It is used only when
those quantities match a stated single-ingredient concentration. The code is
selected by its expansion, not by guessing a medication from its name.

The root `FNV` expansion uses **OR**. The report's **AND** remains `FNA AND FVOM`.
Slash-separated indications preserve their separators and use complete matching
indication codes. Diagnosis qualifiers such as **neck pain** remain written out.

## Product-reference checks

- [Albuterol 0.083% labeling: 3 mL unit-dose presentation](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=32377c09-da6d-331c-e063-6294a90a7a46)
- [PEG 3350 labeling: 17 g measuring cap and 4–8 oz beverage](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=cccbe459-813d-4668-8cd2-76be82906a32)
- [FDA GlycoLax approval: PEG 3350, multidose bottles and single-dose pouches](https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2009/090600s000ltr.pdf)
- [Magnesium hydroxide regular concentration](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dfede6bd-df37-4f0f-9944-49dc13c967de)
- [Magnesium hydroxide concentrated presentation](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2a99a1a8-a830-429f-9cfd-3f29c3d3547c)

Code expansions are generated from `Sig Codes (searchable) (1).docx`; run
`python scripts/generate-clinical-code-reference.py --check` to verify them.
