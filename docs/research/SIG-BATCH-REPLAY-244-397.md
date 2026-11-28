# SIG batch replay, observations 244–397

The corrected private export contained 154 source observations. Each had a nonempty SIG. The export contained no technician confirmations, policy snapshots or policy references. The release replay used the collected drug, directions and any available default template. It generated 160 nonempty cards across 154 observations, with zero skips, parser issues or translator exceptions.

There were 137 distinct directions and 142 distinct drug/directions pairs. Of the pairs, 134 also occurred in the preceding batch and eight were new. They are separate observations even where the clinical text repeats. Replaying both batches together yielded 357 observations with zero duplicate observation records. Neither the new batch alone nor the combined replay supplied an eligible whole-order accepted final.

## Repair and checks

Two observations of the same treatment used an explicitly daily application schedule. The v0.1.19 treatment parser put the schedule inside the site label and raised a missing-frequency finding. The application now separates the complete daily phrase from the site and passes it to the existing schedule resolver. The regression cases include numeric and written daily wording, weekday/time qualifiers, a daily-to-PRN transition, and a one-time-only control. Five assertions failed before the change. All nine new regression cases pass.

On v0.1.20, only those two observations changed their draft or review flags across the combined 357. The prior batch retained its existing drafts. An independent comparison of the two explicit sliding scales in the corrected batch checked all eight ordered lower bound, upper bound and unit-dose triples as well as their frequency prefixes. Both scales passed those checks.

| Corrected-batch check | Result |
| --- | --- |
| Source observations translated | 154 / 154 |
| Nonempty printable cards | 160 / 160 |
| Observations with a potential error or uncorrected gap | 23 (22 distinct drug/directions pairs) |
| Printable cards above 199 literal characters | 2, both flagged |
| Eligible technician-confirmed answers | 0 |

Most frequent outstanding flags were missing frequency (8 observations), partial translation with retained wording (8), and additional instructions (6). Categories overlap. A clean execution or an unflagged draft cannot establish a clinical accuracy percentage. Review the flagged drafts against their originals and, where possible, capture the technician's accepted text on the same card. Free-text source directions, case-level outputs and identifiers are excluded from this repository.

The full local suite passed 1,500 tests in 109 files. Lint, typecheck, the 388-code reference and source-to-portable archive checks passed. The packaged prototype is v0.1.20, build `c8940f3cf7c9`.
