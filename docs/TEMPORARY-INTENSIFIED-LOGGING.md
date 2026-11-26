# TEMPORARY INTENSIFIED LOGGING — REMOVAL PRIORITY: HIGH

**TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH**

Prototype v0.1.15. Remove or substantially reduce this investigation recorder
once the required workflow evidence has been collected. It has no automatic
expiry. Preserve translation, technician feedback, ordinary error reporting and
the separate local SIG dataset when removing experimental capture.

## Record normal work

1. Extract the update into the existing Sig-Assist installation, preserving its
   private `iguana-site.json` and `pilot-log-location.json`. Close the old
   connector and launch the new `Start-Sig-Assist.bat` / connector launcher.
2. Click **Start automatic recording**. The connector reuses the Framework window
   already chosen in Find E-Rx. If none is selected, the app asks you to click
   inside the intended entry window once. Check the recording folder and status.
3. Process prescriptions normally, including opening orders, choosing products,
   editing SIGs and other fields, previewing and saving. No per-order checkpoint
   or Detect E-Rx click is required for the recorder. Detect E-Rx remains the
   separate way to load an incoming order into the translation/review tool.
4. Click **Stop and save recording**, wait for pending browser events to save,
   then open **recording controls** and **Save review bundle in recording folder**.
   Inspect drop/failure notices before sharing a bundle. Bundles can contain
   clinical text: review/deidentify them before external sharing.

Advanced controls retain optional manual markers. Mark these after the observed
action; Saved means the technician observed completion. They do not submit or
verify a prescription. A general feedback button and optional translation stars
capture explanations without making them a prerequisite for processing.

Logging starts only on explicit request. Native recording continues while the
browser page reloads or is closed, while that connector and session stay active.
A connector restart requires starting a new recording. Forced termination can
leave the last manifest marked active; already synced JSONL parts remain intact.

## Destination

Only configured recording roots are used. The workstation configuration tries
the requested UNC root and mapped-drive alternative in order, creates a unique
session subfolder under the first writable existing root, and displays its path.
It never silently switches to TEMP, AppData or Downloads. Generic builds need a
`pilot-log-location.json` with absolute `directories` beside the connector, or
`SIG_ASSIST_PILOT_LOG_DIR`. Private paths/configurations stay outside this repo.
Mapped drives must exist in the same Windows/Citrix session as the connector.

## Automatic evidence

The observer binds to the selected window/process/start time. A persistent
Windows accessibility/UI Automation listener triggers bounded snapshots after
bursts settle (normally 500 ms; at least one second between reads). Five-second
fallback polling covers providers without events. One snapshot runs at a time;
technician-requested desktop operations have priority. A stalled read is killed
after eight seconds and background reads back off for 10–60 seconds. Stopping
releases subscriptions; a watchdog kills a listener that stops responding.

Explicit local clinical observations retain:

- PON when uniquely visible, current wizard page and selected directions mode.
- Separate `message_sig`, `order_sig`, `draft_sig`, `linked_sig`, `default_sig`
  and `structured_sig` fields when exposed and read consistently. These roles
  are not interchangeable, and an observed field is never a verified save.
- Drug, quantity, days supply, batch, dates, package type and administration
  times when readable. Missing, duplicate, changing or truncated fields are
  unavailable, not guessed. Hidden/password values are excluded.
- Actual UIA button-invocation events where supported, with static action/control
  identifiers. Unknown labels become `button`; arbitrary patient labels are not
  recorded. Invocations are intent evidence, not proof that a handler or save
  completed. A later read remains a separate observation.

This is passive observation: no clicking, typing, scrolling, accessibility
recovery or prescription submission. The initial explicit window selection uses
normal detection. Separate top-level dialogs, virtualized/offscreen fields,
unsupported providers and very brief intermediate states can be missed. Native
Windows fixture checks do not establish coverage of the real DevExpress screens.
The current observer does not capture the expanded text of separate preview
modal dialogs. Ordinary and structured preview expansion remain different paths.

The ordinary browser/connector metadata stream still excludes raw field text,
PONs, input keys, clipboard contents and raw exception messages. The new explicit
`framework.observation` records contain clinical text in the local translation
stream; session manifests label `rawClinicalText`. No clinical recording is sent
to external services automatically. Recording starts no additional Iguana query.

The browser reads an acknowledged 300-frame ring without triggering native
scans and adds role-labelled observations to its separate local SIG dataset.
These are `framework_observed` / `unpaired`, never automatically acceptable or
technician-confirmed training examples. Its independent five-second collector
pauses while automatic recording runs. Dataset capture can be paused separately.
On reload, old frame IDs deduplicate. Ring gaps are shown explicitly; use local
files for frames that aged out. Native write-queue overflow has a separate gap
record/counter: it means capture really missed actions, not just browser replay.

## Durability and limits

Workflow and translation streams rotate at 2 MB, with 64 MB per stream and an
eight-hour monotonic session limit. Rotation and new sessions preserve old files.
File writes are serialized and synced before acknowledgment. File failures stop
capture and remain visible. Exports/bundles snapshot acknowledged files; sort by
`seq` to reconstruct order across streams. UTC, timezone offset and monotonic
elapsed times support midnight/wall-clock investigations.

Browser metadata has separate 10,000-event queues and an IndexedDB retry outbox.
Repeated batch IDs are acknowledged once per session. Pending data, drop counts
and failed backups are visible. Keep the page open until pending data is saved,
or use the emergency download before closing. Page-hide backup is best effort.
Do not clear browser storage to address quota errors: reports and custom codes
must be preserved. Browser data belongs to the same profile/address/port.

## Removal work

Search for the HIGH-priority removal marker in source and packaged files. Review
`IntensifiedLogging`, metadata subscribers/outboxes, `framework-observer.mjs`,
bridge journal routes, the native WatchEvents/WorkflowSnapshot paths, local file
retention/bundling and packaging. Preserve shared helpers required by the
independent dataset reader. This marker is not a build-time production exclusion.
