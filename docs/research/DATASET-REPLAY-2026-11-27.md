# Incremental SIG dataset replay — November 27, 2026

Starting prototype checkpoint: `ea14e70`, version 0.1.17. Implementation is
in progress; the following inspection is complete, not a translation-accuracy
claim.

The newly supplied private JSONL batch contains 206 nonblank lines: one batch
header, two exclusion-policy snapshots and 203 observations (200 source_received,
three technician_confirmed). Its declared sequence interval contains exactly
203 observations. All captures identify erx_source. Raw data, opaque identifiers,
clinical examples, source links and replay output remain outside Git and are
not forwarded to external labs.

The current collector exports JSONL but has no reusable offline import/replay
command. Add one for subsequent batches, preserving saved exclusion policies,
separating observations by provenance and reporting malformed lines or missing
policy references explicitly. Overlapping downloads must not inflate counts.
Source observations measure execution/coverage, not correctness. A final text
on one split cannot be compared with the combined generated group as if it
were a whole-order answer. Passive matches remain unverified.

Existing November 27 Lovable reviews have already been completed and integrated;
the engineering and clinical allocations were exhausted. Do not duplicate those
turns. A focused replay review may use any remaining QA credits without a
purchase or upgrade, using public source and synthetic examples only.

Next: implement parser/replay plus synthetic regressions, run this private batch,
record aggregate results and supported repairs, regenerate matching prototype
downloads for runtime changes, and verify remote checkpoints and CI.

## Implementation and independently reproduced repair

The offline parser/replay and `npm run dataset:replay` command now accept complete
incremental JSONL exports. Twenty synthetic tests cover schema validation,
policies, BOM/CRLF, range/truncation checks, overlapping batches, conflicts,
provenance, split comparisons and a 10,000-observation import. The private batch
replays all 203 observations with zero parse issues or translator exceptions.
Its 200 source observations contain 134 distinct drug/prose pairs and 135 opaque
order identities. They must not be described as 200 unique source examples.
No confirmed final qualifies for a whole-source literal comparison under the
strict provenance/split checks; there is no accuracy percentage to report.

One narrow functional defect was reproduced using three fresh synthetic
inhaler examples: explicit oral inhalation/puffs generated a swallowed `PO`
route. The inhaler path now keeps explicit inhalation/puff wording as
`BY INHALATION`. A genuine oral-tablet control retains its original behavior.
The three new route checks fail on the original implementation and pass with
the repair. The tablet control was corrected to include its existing calculated
strength annotation before validation. The known oral-only legacy inhaler
correction is outside this narrow change.

Primary labeling context: [DailyMed Albuterol Sulfate HFA](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=77d34a3c-ccc6-420a-ad31-a1af55f7de76)
specifies oral inhalation. This supports preserving the stated inhalation route;
no new dose recommendation or product conversion was introduced.

At this checkpoint 101 focused tests pass, and typecheck plus targeted lint
pass. Full validation, matching portable downloads, independent QA review and
final remote status follow below. Remaining retained/manual wording is a review
queue, not proof of a mistranslation; this run does not resolve all treatment,
oral-gel, taper or rescue-template cases identified by the earlier audit.

The first full run found two older regression snapshots that expected `PO`
for explicitly inhaled puffs. Only their expected route strings (including the
matching split snapshot) were corrected; their original source text was retained.
Full lint and the 388-code reference check pass. The matching v0.1.18 portable
page, BUILD.json and ZIP have been generated and archive/source identity passes.

Final local run: **1,486 tests in 109 files pass**. Typecheck, full lint,
388-code reference, production build and portable archive/source checks pass.
Version 0.1.18 build `3fba289f3e19` includes the offline replay and route repair.
Remote Windows/Linux CI and focused external QA are pending at this checkpoint.

## Focused external QA and final integration

The v0.1.18 runtime and matching downloads were remotely preserved at
`df5e2f4ae0525b031476f51fc914377e94d780ee`; all fifteen changed blobs were
compared against the fetched branch. Read-only Git transport could not push, so
the authenticated GitHub connector wrote the same validated tree with a branch
head lease. No unrelated remote documentation was overwritten.

The existing QA Lab completed one Max review, message
`umsg_01m8ej76aee6qttg802ft1njt8`, lab commit
`a63af06b0af33eb78c005fe4ee8b15c79c244a07`, reported cost 3.4 credits.
Its report and uninstalled candidate are retained beside the other November 27
lab evidence. No private batch/clinical example was sent, no purchase was made,
and no further review request is pending.

- **Accepted DR1:** changed confirmations of the same source sample/revision
  inflated literal-comparison counts. Root reproduced this using two distinct
  final strings, without assuming that identical re-saves create new records.
  Only the latest confirmation is now comparable; full observation history
  remains intact. Root uses the collector's monotonically increasing sequence,
  rather than the candidate's timestamp-first ordering, so a clock rollback or
  reversed input files cannot revive an old answer. New rejection/unrated cases
  also suppress earlier accepted answers. These four checks fail on v0.1.18.
- **Adjacent parser repair:** root reproduced conflicting definitions of one
  policy identity in separate, non-overlapping batches. The lab's positive
  overlap check did not cover this case. A global definition conflict now
  excludes all affected samples, while ordinary policy references remain scoped
  to their own batch. This fifth new check fails on v0.1.18.
- **Route review:** the lab executed synthetic oral-inhalation probes and found
  no new route defect. Its capsule-to-puff concern is a pre-existing legacy
  rule, outside this change. The lab did not run the CLI, full suite or Windows;
  its review does not establish real workstation functionality.

The 25 replay tests plus four inhaler controls pass after these repairs.
The actual CLI replay of a duplicated private batch also verified 406 input
observations become 203 unique observations with 203 duplicates and no parse
issues. Console output contains aggregate summary only; raw replay output is
outside Git. Final v0.1.19 validation and CI status follow below.

Final local validation: **1,491 tests in 109 files pass**. Full lint,
typecheck, 388-code reference, production build and portable archive/source
identity checks pass. The private batch again replays all 203 observations
without parse issues or translator exceptions. Version 0.1.19 build
`f58da0989477` includes the integrated audit repairs and matching downloads.
Remote Windows/Linux CI remains pending until recorded below.
