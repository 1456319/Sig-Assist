# Technician feedback

Feedback is available in the header from the first screen and throughout the app. It does not require an order, a PON, a server connection, or a translation error. It never approves or changes an order.

The header now displays the release version and a short build ID, for example `v0.1.10 · 07254f23`. Include both when describing a problem: two prototype downloads can share a release version while containing different source updates. Feedback reports already include the complete build ID automatically. The packaged `BUILD.json` records the same identity for troubleshooting an extracted download.

The technician can choose **Yes** or **No** to “Was the result acceptable?” or leave it unrated for general feedback. Yes has two meanings that are recorded separately: **Worked as shown** and **Acceptable after a correction**. Comments are optional on either answer. An unrated report needs a comment so it contains useful feedback.

Reports also capture topic, impact, when the issue was observed, and optional estimated minutes lost. Topics cover general experience, translation, E-DCs, customizations, connection/setup, and performance. Impact ranges from positive feedback through inconvenience, slowed/blocked work, and a possible incorrect order/action. Acceptance and impact remain independent: an acceptable corrected result can still reveal a serious problem in the original draft.

## Save and export

Save writes `feedback.json` in the connected working folder, with browser storage as a fallback. The app confirms the destination. A disconnected or unreadable folder is not overwritten; a report can be retained in browser storage and merged by report ID once that folder is readable. Concurrent saves are serialized. An unreadable browser archive is preserved and reported as an error instead of replaced with an empty list.

Failed saves retain the form and offer retry or **Download this report**. **Export saved feedback** exports the local archive with original answers and comments. Every report and export identifies its version/build. No feedback is sent to a server automatically. Free-text comments are included verbatim and must be reviewed before sharing. A current report can be downloaded even if persistence fails.

Closing the dialog preserves an unfinished comment for the current app session. New feedback explicitly starts a fresh report after a successful save. Browser-only reports belong to the same origin; changing port/address or clearing browser data can make them unavailable. Export before doing either.

## PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION

The optional troubleshooting attachment contains only allowlisted metadata:

- App version/build, screen, capture/observation times and timezone offset.
- Page protocol/port, secure-context flag and storage mode.
- Local dictionary/rule/expansion counts and whether those stores were readable, absent, invalid or unavailable.
- Up to 80 recent screen, customization count, dictionary save, connector response and desktop response events, with fixed result codes, timings and counts.

It never automatically copies clinical text, PONs, resident names, SIG code contents, hostnames, passwords, cookies, or raw errors. The preview shows the attachment before export, and the technician can exclude it. This is a separate metadata recorder; ordinary trace/connector exports still have their existing broader contents.

Customization count observations can show a change such as 80 to 0 while the metadata checkpoint remains available. They do not recover deleted codes, infer why they disappeared, or retain a checkpoint after browser storage itself is cleared. Port/build/storage context helps investigate those cases without guessing a cause.

Before a production release, review retention, disable or remove experimental recorder hooks if no longer needed, and keep useful technician feedback plus an appropriate operational audit. Search for `PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION` to locate this boundary. The label is a review marker, not an automatic build-time exclusion.

## Applying “trust the technician” to E-DC automation

The technician's explicit yes/no decision should resolve questions that the technician can observe directly. Show the source E-DC and target request together, describe the concrete action, and allow an optional comment on either answer. An advisory or incomplete historical lookup should not force the technician into IT troubleshooting when a direct comparison answers the question. Record whether the result worked as shown or required correction, with impact and timing.

Separate the technician's identity/eligibility decision from the application's execution result. If automatic read-back is unavailable, show **Did the refusal/save complete correctly? Yes / No** and record a yes as **technician-confirmed**, rather than claiming machine verification. A no or unknown result remains visible for recovery. This permits capable operation while keeping the actual observed result honest. No additional confirmation is needed for routine reversible preparation already authorized by the technician's decision.

This release adds feedback and diagnostic groundwork. The clinical E-DC refusal and DocuTrack association/note/PV1 write adapters still require the installed-client validation described in the E-DC audit. This release does not enable those actions.

## Optional per-translation stars (v0.1.15)

Queue, Workbench and split cards offer ten optional stars directly below the
automatic suggestion. An unrated translation remains unknown; it is not labelled
perfect. A new ten creates no discrepancy record. Scores 1–9 immediately retain
the source, baseline/presented suggestion, current draft, drug/PON, complete
exclusion policy, available translation diagnostics and version/build. Each
subsequent rating, explanation, copied correction, verified field transfer and
retranslation is an additional event; earlier evidence remains intact. Changing
a previously negative score to ten retains its existing history.

Scores 6–9 offer **The error is obvious** and **I will briefly explain the error**.
Scores 1–5 additionally offer no explanation, an in-depth explanation and explain
later. No explanation blocks processing. Brief/detailed comments save after a
short pause, on leaving the text box and when moving to another order. **Save
explanation** marks the explanation complete.

The discrepancy archive includes a deferred explanation queue. It shows the
original evidence and can retranslate the saved source with the current engine
and original preferences, storing the result as another iteration. It does not
replace the original or assume a live PON lookup still identifies that order.

Failed writes remain in a separate local IndexedDB outbox when available and
retry periodically; the feedback banner offers retry and evidence download. If
all local persistence fails, keep the page open or download before closing.
The independent SIG dataset still collects permitted samples; a ten/unrated
translation merely creates no new discrepancy report.
