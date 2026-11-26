# Prototype 0.1.15 implementation checkpoint

The optional 1–10 translation rating and deferred-explanation workflow was
preserved remotely in `3e463fd89c91f7ac9c21a0efdded3429c171c17c`.

The automatic recorder now replaces compulsory manual checkpoints. Start once,
reuse the selected Framework window (or choose it once), then process normally.
The native listener emits UI Automation and Windows accessibility events. A
bounded reader captures visible SIG roles and order fields after event bursts,
with fallback polling and stalled-provider backoff. Manual markers remain in
advanced controls. Recording does not scroll, navigate, invoke controls or write
prescription fields.

Clinical observations are saved only in the configured local recording folder.
The browser reads acknowledged frames and adds separate, role-labelled samples
to its local dataset. Recording continues through page reloads. Missed browser
ring frames are reported; the local files remain the complete captured record.
Incoming/order, linked, default, structured and draft SIGs are never interchangeable.
Observed PONs are not independently verified source identity. Button invocation,
including Save, is intent evidence and never an automatic claim of completion.

Both the source and packaged prototype are checkpointed together. The temporary
intensified logging removal marker remains HIGH priority. Do not upload clinical
recordings to external audit services or commit them to this repository.

At this checkpoint: 17 targeted observer, local-journal and recording-UI checks
pass; the preceding rating checks (9) pass; portable build and ZIP/source identity
checks pass. Full regressions, native Windows fixture execution, real DevExpress
coverage, and final failure-path review are still pending. This is an explicit
intermediate checkpoint, not a claim of tested end-to-end prescription automation.
