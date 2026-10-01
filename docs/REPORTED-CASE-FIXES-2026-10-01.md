# Reported translation failures — 2026-10-01

The four original reports are preserved in
`tests/fixtures/reported-discrepancies-2026-10-01.json`. Reports 1 and 2 describe
the same nebulizer input. Technician suggestions are retained as submitted;
they are not automatically treated as verified expected answers.

| Case | Cause | Result after the fix |
| --- | --- | --- |
| Nebulizer, reports 1–2 | All measured liquids entered the oral-liquid branch; a volume-first direction was also mistaken for a drug name. | `ADM 3ML NEB Q6H PRN FSOBW`. Explicit inhalation is resolved before oral liquids. |
| Ketoconazole shampoo, report 3 | Unsupported formulations defaulted to a tablet, and only Sunday schedules were recognized. Application and handling clauses were dropped. | Topical application to scalp, Saturday during evening shift, diagnosis, five-minute contact time, rinse and subsequent shampoo/condition instructions are retained. |
| Scheduled tablet plus PRN-dose clause, report 4 | Any PRN mention changed the main regimen; later actions and maximum-dose instructions were discarded. | The TID dose remains scheduled. The complete supplemental PRN clause, 1000 mg combined dose and 3000 mg/24-hour limit remain in the output. |

The bundled **Sig Codes (searchable).docx** defines `NEB` as via nebulizer,
`FSOBW` as shortness of breath or wheezing, `QDDAY6` as Saturday and `QDDAY7`
as Sunday. The shampoo report's proposed day-7 correction was therefore not
copied into the expected answer. Its source specifies an evening *shift*,
which remains explicit text rather than being replaced with a clock time.

The engine now separates later actions and limits from the primary dose and
frequency. Supplemental instructions are retained verbatim in uppercase and
flagged **Additional Instructions Require Review**. Unsupported dose/route/
frequency combinations retain the original directions with a manual-translation
warning instead of inventing `1T PO QD`. This covers the tested branches;
it is not a guarantee that every free-text clause is understood or preserved.

The APAP limit code `3GME` is applied only to an explicit 3000 mg/3 g daily or
24-hour limit. Other amounts or time periods remain literal text. The existing
institutional `3GM` default for recognized APAP drugs remains unchanged when
no explicit limit is present.

Validation includes the original cases plus nearby route, weekday, PRN scope,
missing-dose and alternate-limit regressions. Windows Edge smoke checks replay
all four reports through the shipped Workbench and verify the actual clipboard
contents, in addition to the existing Queue/case-export workflow.

These changes support supervised evaluation. They do not verify prescriber
intent, site-specific macro expansion or clinical accuracy. Existing saved
drafts and reports are not rewritten automatically. Review approvals are tied
to the build fingerprint, so an upgrade requires fresh review before copying
while preserving the technician's draft edits. Re-enter the original
directions in the updated Workbench to evaluate the new translation.
