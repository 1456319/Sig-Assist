# v0.1.9 workstation capture review

Review in progress. Private source files and screenshots remain outside the
repository. This report contains aggregate evidence and generic workflow stages;
it contains no PONs, patients, drugs, screenshots or workstation paths.

## Recorder integrity and field reach

The recording runs 05:36:06–05:47:29 Eastern on November 17, 2026, using the
released v0.1.9 app build. All 823 sequence numbers are present exactly once:
751 workflow events and 72 translation events. All four browser/file drop
counters are zero; there are no parse errors, file errors or reached limits.
The recorder stopped by technician request and kept recording after observation
failed. The 102 `browser.overflow` events all report zero drops; their event name
does not mean data loss occurred.

There are 219 desktop snapshots: 200 readable, 14 BUSY during active desktop
operations, and five terminal OBSERVATION_FAILED results. Readable samples have
median 102 captured controls and 186 visited nodes; median native duration is
1,201ms. 198 are partial and two complete. Site evidence now includes quantity,
days supply, package type, SIG, preview SIG and administration-related labels,
including the known quantity/days-supply editor IDs. A start-date label was not
observed; other date labels do not prove start-date coverage.

The last readable snapshot is 05:46:34.995. Five failures follow from
05:46:44.581 to 05:47:20.583, nine seconds apart. This is consistent with the
eight-second helper timeout plus polling cadence, but v0.1.9 collapses exceptions
to OBSERVATION_FAILED and therefore cannot prove timeout or identify PSR as the
cause. Earlier BUSY samples are temporary contention, not the terminal failure.

## Technician checkpoints and recoveries

| Attempt | Observed boundaries | Evidence and disposition |
|---|---|---|
| 1 | 05:36:20–05:37:47 | Open/product/SIG/fields/Saved checkpoints; no Detect request in this interval. Useful manual workflow evidence. |
| 2 | 05:37:52–05:39:07 | Detect found one PON; HTTP 200 lookup; SIG/fields/Saved checkpoints. |
| 3 | 05:39:11–05:40:04 | Product then problem/abandon checkpoints; Detect took 23.1s and found zero PONs. Keep as an exception, not a clean completion. |
| 4 | 05:40:17–05:41:32 | Reopened attempt; Detect found one PON; HTTP 200 lookup; product/SIG/fields/Saved checkpoints. |
| 5 | 05:41:42–05:42:51 | Detect found one PON; HTTP 200 lookup; product/SIG/fields/Saved checkpoints. |
| 6 | 05:42:56 onward | User identifies this as controlled-substance work. Detect found one PON and lookup returned HTTP 200; problem/product/SIG/fields checkpoints follow, without a Saved checkpoint. Observation-only example, excluded from automatic-processing targets. |

Saved checkpoints are technician observations; the journal is not a persisted
Framework prescription audit. Mistimed checkpoints/backtracking do not invalidate
the other attempts. A successful helper call with zero PONs is distinct from a
successful PON match. HTTP 200 is distinct from a matching parsed order.

## PSR and PON investigation

PSR contains 255 actions over 05:35:08–05:46:57 and 25 screenshots, attached only
to actions 231–255. Earlier actions retain descriptions/UIA metadata but have no
screenshots. Most retained images therefore concern the late example, not the
earlier clean orders. PSR and recorder times overlap in this recording; align
specific actions conservatively rather than treating a checkpoint as the exact
time of a completed UI operation.

Native detection, browser state, URL encoding, XML parsing and queue identity
preserve colon/underscore punctuation. A synthetic compound PON survives the
local path and existing regressions cover colon handling. This does not establish
the upstream Iguana filter grammar or prove the failed live lookup's cause.
No speculative prefix/suffix stripping or character escaping is justified.

The current passive recorder publishes keyed value tokens rather than PON text.
Scheduling full Detect automatically would perform its accessibility recovery,
scrolling and binding-reset behavior. A future automatic identification feature
should use a separate passive current-PON read and retain technician review.

Further review: reconstruct field transitions and the late PSR screenshots;
preserve a structured, PHI-free helper failure reason so the next failure is
actionable. No controlled-substance automatic processing is being enabled.
