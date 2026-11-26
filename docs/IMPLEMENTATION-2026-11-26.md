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
ring frames are reported; acknowledged frames remain in the local files. Native
write-backlog overflow has a separate persisted capture-gap record/counter.
Incoming/order, linked, default, structured and draft SIGs are never interchangeable.
Observed PONs are not independently verified source identity. Button invocation,
including Save, is intent evidence and never an automatic claim of completion.

Both the source and packaged prototype are checkpointed together. The temporary
intensified logging removal marker remains HIGH priority. Do not upload clinical
recordings to external audit services or commit them to this repository.

Remote preservation: `9ff5afb53ada8d76d6d5e8aae147501a25288b4f` contains the
automatic recorder and packaged prototype; `25c9e88881da385d03e49b4eb760b84bcd642b18`
corrects its native test script. The latter passes the native Windows fixture
(distinct SIG/field reads plus actual change-event reception) and all Linux MVP
checks. Its Windows startup fixture omitted the new observer module; that fixture
copy is corrected in the next checkpoint. Real DevExpress coverage remains an
on-site validation task.

Subsequent refinements add automatic comment draft saving on pause/blur/order
change, recording-session references in rating diagnostics, listener reconnect
after failure, rejection of old-listener callbacks, read timings, visible native
overflow diagnostics, and the MSI-confirmed ordinary-preview ` ; ` split delimiter
in shared sliding-scale character estimates. The 157-check targeted run passed;
the expanded full suite passed 1,423 checks and identified two old test assertions
still counting a one-character delimiter. Those expectations are corrected to
the vendor contract; final full regressions and Windows startup execution are
pending. This is an explicit intermediate checkpoint, not a claim of verified
end-to-end prescription automation or a transactional save API.

## Final verification in progress

`dcb649f7f275ede72fcf126867657505efe1f8a3` preserves the refined source,
documentation and packaged v0.1.15, build `d2fe7592d876`. All 1,427 tests across
100 files pass locally, with no increased timeouts (four workers). Lint, type
checking, the 388-code reference, package manifest and ZIP/source comparison pass.
The Ubuntu CI job also passes. The packaged-browser recorder smoke now exercises
automatic selection, three consecutive observed orders, page reload, dataset
replay, optional manual markers, local bundle export and existing quota/report
recovery. Windows startup and that expanded Edge scenario are still running.
