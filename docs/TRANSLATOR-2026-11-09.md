# November 9 translator integrity update

Implementation branch: `prototype`. The installer/reference branches were not merged. This update focuses on the October 29 and November 3 discrepancy exports, especially sliding-scale insulin, PEG/MiraLAX preparation, and packaging-compatible dose codes.

## Report coverage

The two exports contain 138 report occurrences and 101 distinct drug/direction inputs. The new fixture, `tests/fixtures/reported-discrepancies-2026-11-03-reviewed.json`, records each unique input, all its source file/row references, reviewed expected output, split-card output, and outstanding review notes. It excludes PONs, patient context, report identifiers and reporter notes.

The fixture distinguishes 83 translated inputs, 14 inputs needing source/product review, and four partial/template follow-ups. “Translated” means the tested suggestion retains the assessed source meaning; it is **not** a measurement of live packaging-machine acceptance or an assertion that every word has a SIG code. Qualified diagnoses and supplemental instructions can remain literal.

Submitted corrections were compared with the original directions and the root code reference. Where corrections conflict with the original dose, route, laterality or course length, the original information remains available for the technician to resolve.

## Sliding scales

- A shared parser now supplies both the clinical queue and the Workbench's free-text scale rendering.
- Recognizes hyphen/en-dash/“to” ranges; `>=`, `> or =`, `≥`, “greater than or equal(s) [to]”, and `350+`; inclusive low thresholds are also preserved.
- Preserves every numeric band, zero doses, shared low/high notification conditions, recipients, and combined dose/protocol/notification actions.
- Handles AC/ACHS, bedtime-only, TID, QID and hourly schedules without forcing every scale to mealtimes.
- Normalizes the reported `UNIS`/`UNITES` typos and bare numeric doses in a stated scale, with visible correction findings.
- Flags gaps and overlaps without changing a boundary or inventing a missing dose. A source ending `350-399` then `>400` still requires a decision about glucose 400.
- A malformed band, unknown action, conflicting repeated dose, fixed dose preceding a scale, or a band after the schedule retains the full original scale. It cannot silently disappear from a partially matched suggestion.
- Removes the old mL-to-unit relabeling. A volume is not treated as the same numeric count of insulin units.

Example of the formerly dropped final band:

```text
Source ending: Greater than or equals 350, give 5 units ... before meals and at bedtime
Rendered band/schedule: CBS ACHS SS ...;350+=5U SQ ...
```

## PEG/MiraLAX

- Applies the supplied 17 g packet/bulk preparation convention to recognized single-ingredient products, including Mix-In Pax, packet, scoop and capful wording.
- Recognizes “mixed”, “dissolve”, beverage lists, fluid of choice, parenthetical preparation text and the reported `120 to 240 mL` format.
- Keeps explicit liquid, amount and units. `120-240ML` is not rewritten as ounces; an unsupported explicit 2 oz direction remains visible rather than becoming the default 8 oz.
- Keeps holds, PRN intervals, course lengths and stop instructions after preparation extraction. Duplicate mixing punctuation no longer prevents `FCON` matching.
- Does not apply the 17 g template to electrolyte combinations, different stated packet/scoop strengths, multiple packets or unresolved conflicting preparations.
- The source preparation outranks a conflicting optional default template. Added defaults remain identified through the existing review findings.

## Other corrected discrepancy patterns

| Area | Result |
| --- | --- |
| Nebulizer solutions | Known reported 3 mL unit-dose presentations produce `1V NEB`; explicit vials also translate. Unknown presentations and fractional vial volumes keep their volume. HFA inhalers remain separate. |
| Routine plus PRN | Explicit second administrations retain their own dose, interval, indication and duration. Controlled-drug regimens remain on one card; eligible noncontrolled regimens use separate cards. |
| Wound procedures | Applying the medication and leaving the area open to air are both retained. A separate PRN procedure keeps its own instructions. Long suggestions are flagged rather than sliced at character 199. |
| Supplemental text | Repeat doses, call/notify instructions, do-not-crush wording, holds, alternate medications, hospice notes and mixing instructions remain after the translated core. |
| Product calculations | Supports stated liquid mass/concentration calculations, MEQ totals and explicit unit strengths printed on tablet labels. No inventory strength is guessed for missing metadata. |
| Formulations/routes | Preserves intramuscular wording, rectal applicators, eye ointment quantities/sites, patch counts, chewables and nasal laterality. |
| Drug-specific codes | `LOR0.5MG`/`LOR1MG` require lorazepam and the matching concentration; the haloperidol/generic-liquid mislabeling is removed. |
| Frequency/indications | Adds reported breakfast/food/with-meals conventions, STAT, every shift, afternoon and weekday single-dose handling, plus reported diagnosis aliases and code separators. |

The generated subset now contains 388 codes verified against `Sig Codes (searchable) (1).docx`. Minute codes are checked by expansion: `Q5M` means five minutes, but `Q2M` means two months and must not encode a two-minute instruction. Existing packaging exclusions still run after assembly and on every split card.

## Items still needing technician or product information

See the fixture's `reviewNote` for the exact source rows. The principal unresolved groups are:

- Malformed insulin text such as `^ units`, reversed/compressed conditions, and the uncovered glucose-400 boundary.
- Missing product strengths for tamsulosin, acetaminophen, levothyroxine, trazodone, B12 and ondansetron; these keep the prescribed mass or volume rather than inventing a tablet/capsule count.
- Conflicting correction values, including 37.5 MCG versus MG and 25 mg versus 15/12.5 mg; nasal laterality differences; and a source containing both every-two-minutes and QD.
- No interval supplied for a PRN packet order.
- Remaining template/condensation work: the Xeroform/Mepilex procedure, fentanyl placement/change wording, a vitamin unit-to-mass annotation, and automatic FOSAMAX/DNC suffixes. These are not counted as fully resolved.

Original report files remain intact. This update does not archive or mark reports resolved in technicians' local browsers, replace saved edits, or bypass review before copying.

## Verification and testing boundary

- 969 tests pass across 49 files, including the 101-input report replay, 108 range/threshold/schedule combinations, targeted source-preservation tests, queue-level insulin/MiraLAX editing and reviewed-copy tests, and runtime login-form discovery.
- ESLint, TypeScript checks, production/portable build, root-code reference verification and deterministic ZIP/source checks are run for this update.
- Browser smoke checks were attempted over localhost, directly as a file, and with the synthetic Iguana bridge. They could not start in this environment: the bundled-browser download was invalid and the installed Chromium was denied a process socket. These checks are **not locally passed**. Queue editing, approval and clipboard calls are covered by the passing DOM-level integration tests; the actual-browser checks remain in Windows CI.
- Live Framework/DocuTrack, Windows desktop transfer, Citrix, and packaging hardware are not available in this development environment. Windows-only checks remain in the repository's CI matrix; live acceptance still needs technician testing.

No package dependency was added or changed; the offline translator does not acquire a new Supabase dependency. Midnight date/quantity automation and new DocuTrack operations remain outside this update.

During publishing, automatic approval review rejected the portable HTML because the existing connector configuration embedded login values. The user clarified that these are intentionally shared LAN defaults and requested runtime discovery instead. The connector now reads the server-supplied login form before each API query, with manual entry available if the form is blank or populated only by JavaScript. Login values are absent from the app defaults and build; actual LAN discovery still needs testing. The subsequent [silent connection update](IGUANA-CONNECTOR.md) supersedes this manual fallback for the preconfigured LAN edition.

For the incoming deidentified eRx batch, retain source text and product strength, compare core dose/route/schedule and all supplemental actions separately, then record the desired Final SIG and whether its Framework preview and packaging output match. Reuse the exact-output fixture pattern for confirmed cases; passing these current fixtures alone does not establish accuracy on that unseen batch.
