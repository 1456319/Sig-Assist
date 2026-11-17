# v0.1.9 workstation capture review

Review completed. Private source files and screenshots remain outside the
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
including the known quantity/days-supply editor IDs. Those two editors were
actually readable and writable: quantity has five positive observations and
days supply two. Package evidence is currently label text, not a confirmed
editable package-value binding. A start-date label was not observed; other date
labels do not prove start-date coverage. The whole-tree observation still uses
most of its 1.2-second budget; this capture establishes better field reach, not
a controlled before/after latency improvement.

These are positive changed-control records. A field absent from a partial
snapshot's changed list is not proof that it was absent from the screen.

The last readable snapshot is 05:46:34.995. Five failures follow from
05:46:44.581 to 05:47:20.583, nine seconds apart. This is consistent with the
eight-second helper timeout plus polling cadence, but v0.1.9 collapses exceptions
to OBSERVATION_FAILED and therefore cannot prove timeout or identify PSR as the
cause. Earlier BUSY samples are temporary contention, not the terminal failure.
Local OCR of the final PSR screenshot places Framework and Not Responding in the
same title-bar row. This corroborates an unresponsive window; it does not prove
PSR caused the hang. Workflow logging continues through technician Stop.

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

## Reusable workflow map

| Stage | Exposed controls/views seen in the recording | Next automation evidence |
|---|---|---|
| Open the next order | ERxQueueButton, ERxGrid, ERxPatientOrderGrid | Read one stable current PON without activating/recovering/scrolling the UI. |
| Choose the product | ProductSelectionView, CompoundAutoSuggestEdit, Next | Record candidate selection and the resulting product identity before filling dependent fields. |
| Review directions | DirectionsView, PrescriptionTabDirectionsView, paneRichEdit, SIG/preview labels | Existing reviewed SIG transfer remains separate from confirming the complete expanded preview. |
| Quantity and days supply | RxEntryPrescription_QtyEdit, RxEntryPrescription_DaysSupplyEdit | Real readable/writable editor identities are now established; verify the active order before later field writes. |
| Packaging and delivery | Package type, Rx batch, delivery ID/date and administration labels | Bind actual value controls and start-date identity; label presence alone is insufficient. |
| Finish/save | Next/confirmation interactions plus four Saved checkpoints | Add a specific post-save result read before later automation claims a completed order. |

The controlled final example contributes layout/identification evidence only;
its special rules are not a template for non-controlled order processing.

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

The last lookup has a different keyed PON reference from the preceding order,
and the late screenshots display the app's No matching orders/time-window
message plus its Search the last 7 days option. Three independently OCR-checked
screenshots also show Search complete: 0 logs / 0 added. Thus this is an empty
parsed-log result, not just a missing selected row. There is no subsequent
seven-day query in this journal. No translation was loaded for that last attempt; the six
recorded translation executions belong to three earlier non-controlled orders.
Consequently, their isControlled=false fields say nothing about recognition of
the last controlled example.

The remaining lookup possibilities include the time window, a different channel
or identifier namespace, an absent message, or parsing/filter behavior. The
journal deliberately omits response bodies and cannot discriminate these.
The smallest further evidence is an empty-result lookup's connector diagnostics
or a dummy/deidentified source entry for that same complete identifier, rather
than another long recording.

Vendor references reviewed:
- [Iguana Log API](https://help.interfaceware.com/web_api/) describes after,
  source, filter, refmsgid and message-type controls.
- [Using the Logs](https://help.interfaceware.com/v6/using-the-logs) documents
  indexed searches that can miss substrings and a slower `!` prefix in the log
  UI. This is a testable lead; the API documentation does not establish identical
  UI filter semantics on the installed version. No speculative API escaping or
  automatic broad scan was added.

The current passive recorder publishes keyed value tokens rather than PON text.
Scheduling full Detect automatically would perform its accessibility recovery,
scrolling and binding-reset behavior. A future automatic identification feature
should use a separate passive current-PON read and retain technician review.

## Source changes and next work

The prototype now retains fixed helper failure categories (timeout, invalid
output, process exit, startup failure, unknown failure) and bounded helper
duration in desktop snapshots. Classification originates at process execution
and parsing; raw error messages, paths, stdout and stderr are not copied into the
observer journal. Success, BUSY, selection requirements and technician operations
retain their existing behavior. This is a source change for the next build, not
a change to the already-delivered v0.1.9 ZIP.

Local verification: 1,111 tests across 66 files passed, including real synthetic
child-process timeout/exit/start failures, invalid JSON, redaction and subsequent
manual detection after a failed observation. Lint, TypeScript, build and packaging
verification passed locally. Both Windows and Linux passed
[integration run 44072365655](https://github.com/1456319/Sig-Assist/actions/runs/44072365655)
on commit `4a6179c`, including native desktop, browser/clipboard, UNC, Iguana and
pilot recording checks.

Next functional increment: separate passive current-PON identification, coalesced
lookup and explicit technician selection, followed by reliable bindings for
package/start-date controls. Avoid polling full Detect, which can move the UI.
Keep controlled examples for identification/layout evidence only. No
controlled-substance automatic processing is enabled or planned for this pilot.
