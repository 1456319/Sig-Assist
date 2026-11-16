# E-Rx observation review — 2026-11-16

Reviewed the three supplied PSR archives, both Sig-Assist diagnostic JSON exports, and the initial Framework screenshot. The recordings span late November 15 through early November 16 in the technician's local time. This is an evidence review, not a clinical rule or write-adapter release.

Original recordings and JSON remain outside the repository. They contain identifying screen text and clinical/order values. This document retains counts, application control identifiers, summarized workflow observations, and engineering implications only.

## Capture completeness

| Supplied recording | Recorded steps | Embedded screenshots | Technician comments | Screenshot coverage |
| --- | ---: | ---: | ---: | --- |
| TEST RUN | 145 | 25 | 0 | Steps 121–145 only |
| TEST RUN2 | 55 | 55 | 5 | Steps 1–55 |
| TEST RUN3 | 267 | 267 | 16 | Steps 1–267 |

Totals: 467 steps, 347 screenshots, 21 comments. Each archive contains an MHT with readable HTML and an embedded XML action stream. Counts above come from that XML and the actual image MIME parts, not the ZIP size or viewer thumbnails.

Each PSR session reports zero missed actions. That means PSR did not report a drop; it does not establish that every field change or business outcome was recorded.

The first recording retains exactly the final 25 screenshots; its earlier action text and UI stacks remain available. This is consistent with screenshot retention wrapping, not disabled capture. Both later recordings include an image for every recorded action/comment. Their files demonstrate that screenshot capture works.

## What PSR establishes

The action stream names FrameworkLTC.exe rather than only a remote-desktop client. Framework UI stacks expose AutomationId, ClassName, ControlType, FrameworkId, bounding rectangles, and some labels. This is useful actual-client evidence for the planned Windows UI Automation mapping.

Examples include:

| Control identifier | Observed use |
| --- | --- |
| ERxQueueButton | Open the E-Rx workflow |
| DirectionsView / paneRichEdit | Directions page/editor ancestry |
| RxEntryViewControl | Prescription entry form |
| RxEntryPrescription_QtyEdit | Quantity |
| RxEntryPrescription_DaysSupplyEdit | Days' supply |
| RxEntryPrescription_ProfileOnly | Profile-only control |
| ProductSelectionView / CompoundAutoSuggestEdit | Product and compound selection |
| RxBatch / MoveRxBatchUserControl | Batch selection/change |
| PatientViewControl / chkPatientProfileReviewed | Patient/profile review |
| WorkQueueView | Queue screen |

These are selector candidates, not established write contracts. Generic IDs such as PART_Editor, Value, or PART_OkButton need their containing screen/control ancestry. Fixed screenshot coordinates should not become the execution strategy.

PSR records the clicked element's ancestry, not a complete live control tree, available automation patterns, every textbox value, or durable order status. It does not replace the connector's runtime read/write/read-back work or establish an API endpoint.

## Workflow knowledge added by the comments

| Source | Observation to retain | Automation implication |
| --- | --- | --- |
| Run 2, steps 30/39/43 | Allergy information and profile review can require explicit reconciliation. | Represent this as a technician decision with the relevant source context; an unknown state must not be interpreted as no allergies. |
| Run 2, step 52 | Processing ahead into a future batch affects dispensed/delivery/start dates; one-time doses are described as an exception. | Model batch date separately from wall-clock date and incoming effective/start dates. Resolve the exception from procedure/examples before applying a universal formula. |
| Run 2, step 53 | The demonstrated PAXIT quantity/day-supply decision depends on the three-day window, delivery timing, on-site stores, and future profile-only handling. | Simple daily-dose multiplication is insufficient. Convert the explained cases into explicit fixtures and reconcile the window anchor with the existing packaging references. |
| Run 3, steps 49/51 | A product substitution preference is described; inventory behavior is cited as a technician clue. | Preserve the product preference as site guidance. Inventory alone does not establish the product match; retain the technician's choice and the product identifiers/strength/form actually selected. |
| Run 3, step 69 | A particular SIG-active popup is intentionally dismissed. | Identify that exact dialog. Do not generalize the instruction to all warnings. |
| Run 3, step 81 | A wrong batch is recognized and a post-save correction is planned. | Include correction/recovery paths, and distinguish intended correction from a verified completed correction. |
| Run 3, steps 117/121 | The sweeper route is selected and persists across subsequent E-Rxs. | Read the current route/batch state for each order; do not assume a new order resets it. |
| Run 3, step 89 | The demonstrated non-controlled workflow skips DocuTrack association; the comment reserves association for controls. | Preserve this scope in this automation path; do not enable association as a default step. |
| Run 3, step 166 | Bulk/topical packaging has distinct quantity, days' supply, and package-type handling. | Separate product/package policy from SIG translation; retain the demonstrated package-size case. |
| Run 3, steps 177/182 | Compound selection and a concentration/dose-volume difference require deliberate handling. | Surface the relevant inputs and calculation for technician confirmation; do not silently copy the incoming volume across different concentrations. |
| Run 3, step 201 | The technician distinguishes ordinary save-review content from a highlighted allergy warning. | Capture the warning's structured/text state when available, plus explicit technician resolution. Color alone is insufficient. |
| Run 3, step 210 | A CancelRx advisory causes the technician to leave the order unprocessed and look for its E-DC. | Include this exception branch. This is not evidence that a refusal or DocuTrack save completed. |
| Run 3, steps 253/257 | Directions and selected formulation conflict, and the technician corrects the SIG. | Record the original, corrected draft, reason, and technician acceptance separately. Do not infer an intended formulation correction from prose alone. |

These observations summarize the technician's demonstrated procedure. They do not enable writes or establish that every statement applies to every product/facility. The technician's observable decisions remain the source for the particular case.

The annotation pauses are substantial; PSR elapsed duration is not an estimate of normal processing speed.

## Diagnostic exports: an actionable retention gap

Both exports identify app version 0.1.5, browser-cache storage, and no connected working folder. They are the existing translation trace format, not continuous desktop-observer recordings or v0.1.6 feedback attachments.

Each export contains exactly the latest 1,000 events:

| Export | Retained event time span | Components |
| --- | --- | --- |
| First diagnostic export | 1.610 seconds | Translation/packaging engines plus one queue UI event |
| Second diagnostic export | 0.110 seconds | Translation/packaging engines plus one queue UI event |

The source logger has a 1,000-event ring. These files contain no retained desktop/connector workflow history; bulk translation events dominate the ring. This does not prove that earlier desktop activity never occurred or that the application reported no earlier errors.

The next observer needs its own bounded session/action journal, with explicit start/stop boundaries and dropped-event counts, so translation debug bursts cannot evict the useful workflow evidence. Use UTC time, local timezone offset, and monotonic elapsed time; one supplied recording crosses midnight. Keep the selected process/window and order transition boundaries explicit. The v0.1.6 metadata recorder is separate but is also not a complete workflow observer.

## Screenshot control and the next capture

PSR automatically captures images around recorded steps when enabled; it is not a manually timed screenshot button. Microsoft documents /sc 0 to disable screenshots, /sc 1 to enable them, and /maxsc to control recent-image retention. The precise reason the technician's GUI settings are unavailable is not established by these files. No need to change a policy or install a different recorder to explain the current evidence.

If a screenshot-free PSR trial is wanted, stop the current recording, then launch from Command Prompt:

    psr.exe /start /output "%TEMP%\ERX-steps-only.zip" /sc 0 /gui 1

Use a new output filename for each capture. Stop with the visible recorder controls. Disabling images does not sanitize action descriptions, UI names, comments, or command-line metadata.

There is no need to repeat these recordings just to make them useful. If another capture is convenient, a short recording per order, a comment after an important screen finishes updating, and a final outcome/correction comment will simplify comparison. Confirmed synthetic cases make complete value-level examples shareable without patient information.

## Next implementation

Use Run 2/3 as the current workflow references. Build passive observation into the existing local browser/Windows connector; do not continuously call the active scrolling PON detector. Start with selected-order transitions, screen-specific SIG/schedule mappings, and field read-back. Retain the technician's yes/no acceptance, corrected-versus-as-shown distinction, comments, and severity.

Build rule fixtures from the documented examples separately from UI execution. Preserve the allergy, cancellation, product/formulation, compound, future-date, packaging, and persistent-route branches. Use PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION for experimental observation hooks.

E-DC completion validation remains deferred. The cancellation branch seen here does not supply the missing full refusal/DocuTrack-write example.

Primary PSR reference: https://techcommunity.microsoft.com/blog/AskPerf/windows-7--windows-server-2008-r2-problem-steps-recorder/374398
