# Prototype 0.1.15 — automatic observation and translation feedback

The recorder observes normal prescription work across consecutive orders without
per-order checkpoints. Click **Start automatic recording**, reuse the selected
Framework window or choose it once, then process normally. Optional manual
markers remain under advanced recording controls.

## Automatic observation

- A persistent Windows/UI Automation event listener triggers bounded field
  snapshots after changes settle; periodic polling covers missing events.
- Readable PONs, wizard pages, directions modes, distinct SIG roles, drug,
  quantity, days supply, dates, batches, package type and administration times
  are retained with available evidence. Unknown values are not invented.
- Button invocation events are recorded as intent, never as a verified save.
  The observer does not scroll, navigate, invoke controls or write orders.
- Clinical frames are synced to the configured local recording folder before
  acknowledgment. Recording continues while the browser reloads or closes,
  while the same connector/session stays active.
- The browser also adds role-labelled observations to the independent local SIG
  dataset. PON equality alone is not a verified source match. Observations are
  unpaired and unrated until independently confirmed.
- One native read runs at a time, technician desktop requests have priority,
  stalled reads back off, listeners reconnect and old callbacks are rejected.
  Native overflow and browser replay gaps are separate, visible diagnostics.
- A metadata-only recording cannot replay a prior clinical session's frames.

Clinical text stays local. No clinical recording is automatically uploaded to
external services. The HIGH-priority temporary intensified logging removal marker
remains visible in the UI, source and packaged files. Private recording-path and
site configurations remain outside this public repository and are preserved by
workstation updates.

## Optional translation feedback

Queue, Workbench and split cards offer optional 1–10 stars. An ignored rating
stays unknown; a fresh ten creates no discrepancy. Scores 1–9 immediately retain
the source, baseline and presented suggestions, current draft, exclusions,
available parser/translation diagnostics, and version/build. When available,
recording-session references connect a report to its local recording.

Scores 6–9 offer an obvious-error or brief-explanation choice. Scores 1–5 also
support no explanation, an in-depth explanation and explain later. Comments save
on pause, blur and order changes. No rating or explanation blocks processing.
Deferred cases can be revisited and retranslated with the current engine and
original preferences; every iteration preserves the original evidence. Corrected
copies and verified field transfers append to existing negative-rating histories.
Failed writes remain pending, with retry and evidence-download controls.

The shared sliding-scale estimate now includes the MSI-confirmed ordinary
PreviewSig separator ` ; ` between entered parts. The estimate still requires
comparison with the site's actual Framework expansion.

## Preserved release and validation

Runtime source and the matching page, manifest and ZIP are preserved in
`d343a387526ffb003a438a2944e6f0b60cccaad1` on `prototype`.

- Version: **0.1.15**.
- Build: `1e465879babbe90cf3f39466b0e556adbec673bab9c3db827200c046c226c9e5`.
- 1,427 tests across 100 files passed locally; timeouts were not increased.
- Lint, type checking and the 388-code reference check passed.
- Portable page/manifest identity and every ZIP entry matched current source.
- Both Windows and Ubuntu MVP jobs passed; prototype publication succeeded:
  https://github.com/1456319/Sig-Assist/actions/runs/45778773168
- Native Windows observation and the separate packaged Edge recorder job passed:
  https://github.com/1456319/Sig-Assist/actions/runs/45778773163
- The Edge scenario verifies one-time selection, three consecutive orders
  without checkpoints, browser reload, six SIG dataset samples, button-event
  evidence, optional manual markers, configured-root fallback, local bundle
  export, excluded private fields, legacy diagnostic migration, actual browser
  localStorage exhaustion, discrepancy report recovery, reload and export.

These are synthetic fixture results, not a claim of live DevExpress coverage,
a transactional prescription-save API, or unattended dispensing.

## Next workstation check

1. Extract the new build into the existing installation, preserve its private
   configuration files, close the old connector, and launch the new one.
2. Start recording once and fill several non-control E-RXs normally. No Detect
   E-Rx or checkpoint action is required for the recorder itself. Detect E-Rx
   still loads an order into the separate translation/review workflow.
3. Check that observed PONs/pages/fields advance, then stop and save a review
   bundle. Inspect missing-field and gap notices. Review/deidentify clinical
   text before any external sharing.
4. Compare the capture with actual Framework actions, particularly Save,
   product/directions transitions, split SIG edits and missing PONs. The current
   reader can miss separate preview dialogs, offscreen/virtualized controls and
   brief intermediate states; it never treats these as successful actions.

Further reader adjustments should use that evidence. FWDirect remains excluded.
