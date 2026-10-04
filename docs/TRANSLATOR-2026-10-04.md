# October 4 translator and discrepancy-list update

The 06:15:59 export contains 40 reports, including the preceding 17 reports and repeated corrections of the same order. The regression fixture retains only drug names and original directions; identifiers, report notes and desktop/Iguana context are excluded. Each report is replayed, including overlaps, so an older fix cannot silently disappear.

## Rejected packaging codes

These site-reported restrictions are separate from the root dictionary. A code's presence in the dictionary does not establish that the site's packaging workflow accepts it. This is an expandable list of known restrictions, not a complete vendor list.

| Rejected output | Replacement behavior |
| --- | --- |
| `INH` | Oral inhaler puffs use the reported `PO` convention; nebulizers use `NEB`. An unresolved coded `INH` is written as `BY INHALATION`. |
| `FNA` | `FNAU` for nausea alone. |
| `FVOM` | `FOR VOMITING` for vomiting alone. The site-approved combined nausea/vomiting code is `FNV`. |
| `Q23H` | A literal prescribed **23-hour interval** remains `EVERY 23 HOURS`. An already coded `Q23H` expands to **EVERY 2 TO 3 HOURS**, its root-dictionary meaning, with an applied-correction notice. |
| `PNA` | `FPNE` for an unqualified pneumonia indication; `PNEUMONIA` within a qualified phrase such as aspiration pneumonia. |

`FNV` is used for the report's nausea **and** vomiting wording by explicit site convention. Because the root expansion says nausea **or** vomiting, that alias is displayed as an applied correction for review. Source directions remain unchanged.

The policy runs after complete assembly, including retained supplemental text, default templates and every split card. Copy and Framework transfer also reject these tokens if a technician reintroduces them. Longer words and permitted codes, such as `INHALE`, `FNAU` and `FPNE`, are not blocked.

**Saved exclusions → Exclude code** now affects generation. The app uses an entered replacement or a verified dictionary expansion. If no permitted expansion exists, or replacements form a cycle, it withholds the suggestion and requests a complete manual translation rather than deleting part of the order. Existing edited drafts remain available for correction; they are never silently overwritten. Restrictions persist with the review preferences. Built-in restrictions cannot be undone from the UI.

Numeric hourly codes are checked against their actual root expansions: literal 34, 36, 46 and 68 hours also must not become codes that mean 3–4, 3–6, 4–6 or 6–8 hours.

## Recognized patterns

- Explicit G/PEG/J/NG tube routes outrank “Oral” in the drug name, for solids and measured liquids. ODT dissolution is added only for the oral route.
- Related-to indications retain their complete diagnosis wording and drop ICD codes. Qualified pain and aspiration-pneumonia descriptions stay specific.
- Evening schedules, paired day/night shifts, every-30-day schedules and single-administration courses are recognized. One administration becomes `X1 ONLY`, without a conflicting `QD`. Multiple administrations remain a dose count.
- Bilateral nasal sprays use `1SP`/`2SP ENOS`; explicit injected units use `INJ … UN SQ`. “Before meals” uses the reported `TIDAC` convention with a visible correction notice; an explicit daily/twice-daily frequency is preserved.
- PEG 3350 17 g bulk powder recognizes `GM/SCOOP`, enteral routes, and explicit 4–8 oz water/juice/liquid preparation. Source dilution overrides an optional default template. Unsupported dilution instructions remain visible for review. Added preparation defaults remain labeled as additions.
- Sliding scales are parsed as complete instructions, including later dose actions. The reported scale preserves `<70` hypoglycemia **and** MD notification, all four bands, inclusive `350+=10U&CALL MD`, `ACHS`, `SQ` and `FDM1`. Unrecognized conditions, notification recipients or schedules retain the complete source scale instead of suggesting an incomplete scale.
- `UNTIL FINISHED` remains in antibiotic instructions. An explicit daily 4000 mg acetaminophen ceiling uses the verified `NTE4`; it is not added as a new default. The existing 3000 mg caution behavior remains.

The reference is generated from `Sig Codes (searchable) (1).docx`; `python scripts/generate-clinical-code-reference.py --check` verifies that the shipped subset matches it. Submitted corrections are reviewed against original directions, rather than automatically treated as correct: for example, the G-tube order remains `GT` despite `PO` in the submitted correction.

## Start a fresh discrepancy list

1. Use **Export discrepancy cases** to keep your current report file.
2. Click **Archive current reports**. The current count becomes zero and subsequent exports contain new active reports only.
3. Older reports remain saved. **Export archived reports** retrieves them; **Restore archived reports** puts them back in the current list.

Archiving is reversible and does not clear the order queue, change original evidence, or mark reports fixed. New reports saved concurrently are preserved. A failed storage write leaves the current list intact. Old reports without archive metadata remain active by default. Reports remain local until exported; clearing browser storage can still remove cached data.

Regression checks cover all 40 supplied occurrences, nearby route/interval/preparation/scale cases, generated and manually edited exclusions, cached results, split cards, UI preference persistence, and archive/restore/failure/concurrent saves. Windows Edge replay adds the 21 distinct new inputs to the prior 41-case workflow and verifies actual clipboard output, exclusions and archival export.
