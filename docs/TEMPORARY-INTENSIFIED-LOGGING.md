# TEMPORARY INTENSIFIED LOGGING — REMOVAL PRIORITY: HIGH

**TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH**

Prototype v0.1.7. Remove or substantially reduce this recorder once the E-Rx investigation has supplied the required evidence. The investigation may span many releases; this marker has no automatic expiry date. Review it before every production release. Preserve useful technician feedback and an appropriate operational audit when removing experimental capture.

## Record a session

1. Extract the workstation update over the existing Sig-Assist folder. Its existing `iguana-site.json` is preserved. Close the old connector, then use `Start-Sig-Assist.bat` (or `Start-Iguana-Connector.bat`).
2. Open **Temporary intensified logging** beneath the app header. Choose the Framework entry window, or reuse the window already selected through Find E-Rx. Explicit selection uses the existing eight-second window-choice workflow and can perform the normal active PON read. Once selected, periodic observation is passive.
3. Click **Start pilot recording**. Check the displayed recording folder and observer status. Each recording gets a new dated/unique child folder under the configured root. A recording can collect browser/connector events before a Framework window is selected; `SELECTION_REQUIRED` explicitly identifies that gap.
4. Work normally, optionally using checkpoints and the existing Feedback button for comments. A checkpoint such as Saved is the technician's observation, not machine verification of a prescription save.
5. Click **Stop and save recording**, wait for the pending browser count to reach zero, then **Save review bundle in recording folder**. The bundle is written beside that session's log parts, not to the browser's Downloads folder. Check any failure/drop notices before sharing.

The amber panel identifies temporary logging everywhere in the app, including while recording. Red notices report file failures, limits, dropped events, unavailable browser backup, and unsaved events. Logging starts only on explicit request. It does not resume automatically after a connector restart.

## Destination — configured roots only

The supplied workstation update includes a private `pilot-log-location.json` containing the technician's requested UNC root followed by its mapped-drive alternative. The connector tries them in order, creates a session subfolder under the first writable existing root, and displays the exact selected path. It never silently redirects to AppData, TEMP, the source checkout, or Downloads when those roots are unavailable.

Mapped drive letters must exist in the same Windows/Citrix session as the connector. An unavailable UNC path does not establish that its mapped alternative is mounted. Actual share permissions and drive mapping require the workstation check; CI validates the configured-root/failure behavior with temporary synthetic directories.

Generic deployments can configure `directories` in `pilot-log-location.json` beside the connector or set `SIG_ASSIST_PILOT_LOG_DIR` before starting it. Do not put patient identifiers into paths or configuration. Workstation-specific path configuration stays outside the public repository. An unconfigured generic build leaves Start disabled with an explanation.

## Information collected

- A manifest with session/build, runtime/platform, start/stop state, limits, saved/drop counts, and the temporary removal marker.
- Separate workflow and translation JSONL files. Live trace subscribers capture metadata before the old 1,000-event display ring can discard events. A burst in one stream cannot consume the other stream's file budget.
- Browser screen changes, button/input interaction types, non-password value lengths, visibility/lifecycle/error occurrence, customization counts, and pilot feedback-save metadata. No raw DOM labels, values, exception messages, URLs, input keys, or clipboard data are captured by this recorder.
- Translation layer/component/severity, per-page anonymous trace references, counts/flags, and relevant string lengths. Original directions, output SIG strings, drugs, PONs and ordinary raw trace details are excluded from the new journal.
- Local connector and desktop operation boundaries, timings, safe outcomes, uncertainty/read-back flags, and keyed PON references when the existing operation supplies a PON. Recording never starts another Iguana query.
- Approximately every three seconds, a passive snapshot of the remembered Framework window's currently exposed control tree: known control IDs, type/family, hierarchy, focus/enabled/read-only/toggle/selection state, pattern counts, advertised grid dimensions, string lengths and keyed change tokens. Subsequent snapshots contain changed/removed controls plus a summary.

Exact field names/values, unknown automation IDs and window titles are not written. Unknown names/values are represented by per-recording HMAC tokens using a key kept only in connector memory. Tokens allow change detection and are not patient identifiers or a complete anonymization claim. They cannot reconstruct a SIG or validate its meaning. Tokens differ across new recordings. Review exports before sharing. Regular Trace Logs, feedback comments, desktop diagnostic exports and PSR files retain their separately documented broader contents.

## Passive observation boundaries

The new `observe` action validates the remembered process start/window identity. It never discovers a different window on failure, reads other Framework instances, moves focus, activates a window, scrolls, realizes virtual cells, changes accessibility settings, invokes a control, or writes a field. Password controls and descendants are skipped. Native snapshots are bounded to 800 captured controls, 1,600 visited nodes, depth 24 and a 1.2-second cooperative budget. The helper has an eight-second outer timeout. Unsupported providers, busy clinical operations, unavailable windows and partial snapshots are reported.

Only descendants of the selected window are read; separate top-level dialogs and offscreen/virtualized content may be absent. This first observer is a state sampler, not a complete click recorder or event subscription: changes between samples can be missed. PSR and technician comments remain useful. No claim of a completed clinical save is derived from a changed screen or value token.

## Durability and limits

Each stream rotates at 2 MB and retains up to 64 MB per recording. A recording has an eight-hour monotonic duration limit; start another to continue. Neither rotation nor starting another session deletes older files. Keep recordings as long as the investigation needs them, then remove them deliberately.

File appends are serialized; accepted browser batches are synced before acknowledgment. Retries use a persisted batch ID, which the connector acknowledges once during that session. Export/bundle operations take a consistent snapshot of acknowledged files. A combined bundle groups log parts; use the global `seq` field to reconstruct cross-stream order. UTC times, timezone offsets and monotonic elapsed times distinguish midnight and wall-clock changes.

The browser keeps separate bounded pending queues (10,000 events per stream) and backs up pending batches at flush/page-hide boundaries. Acknowledgment failures retain the same batch for retry. Reloading the same browser origin while the same connector remains running restores that outbox. A forced process/browser termination before backup/flush can lose the newest pending events; this is not reported as durable file capture. A full browser store or corrupt outbox is preserved and flagged. A per-stream file limit drops further events in that stream with explicit counters. Translation overflow cannot evict workflow files.

Do not close an old connector before stopping/saving/exporting its recording. A forced connector exit may leave a manifest marked active; synced JSONL parts remain in the displayed folder. Previous-session folders are not auto-reopened or auto-deleted by the next connector. The emergency **Download pending browser events** action uses the browser's save location; explicitly select the recording folder for that manual fallback.

## Removal work

Search source and artifacts for `TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH`. Review/remove the UI panel, live trace subscription/outbox, bridge journal endpoints/timer, native observer, private destination configuration, file retention/bundles, packaging additions and associated pilot checks. Removing this recorder must not remove ordinary SIG translation, reviewed field transfer, technician feedback, or normal error reporting. The marker is deliberately prominent; it is not a build-time production exclusion.
