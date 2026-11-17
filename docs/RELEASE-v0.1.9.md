# Sig-Assist v0.1.9 workstation build

Release candidate assembled from the reconstructed, cross-platform-validated
prototype. The versioned package is undergoing its final Windows release checks.

## Changes since v0.1.8

- Treatment translation retains ordered steps, duration, weekdays, PRN reasons,
  follow-up and unresolved wording. Missing frequency no longer invents QS.
- Sliding-scale translation recognizes headingless insulin tables, glucose-unit
  labels, postfix thresholds, additive doses and rechecks. Unfamiliar actions
  remain visible beside recognized bands for technician correction.
- Framework observation caches the active view's identities, prioritizes critical
  entry fields and reads values freshly. The Windows fixture verifies quantity,
  days supply, package and start date in a large control tree.
- Bulk dictionary imports preserve existing custom codes. Save failures show
  actionable errors and retain edits; partial remote results retain local codes.
- Clipboard failure selects the edited SIG for Ctrl+C. Drafts show their length
  against the 199-character destination limit. Long-input matching is faster.

## Update the workstation

1. Save open reports and stop/save any active pilot recording. Close the old
   connector and browser tab.
2. Extract the workstation update over the existing Sig-Assist folder. The update
   omits `iguana-site.json`, preserving the existing connection profile.
3. Run `Start-Sig-Assist.bat`. Confirm v0.1.9 in the app. The configured update
   carries forward the same two recording roots as the v0.1.8 update.

Use a short normal E-Rx session to check field coverage. Choose the entry window,
start pilot recording, work normally, and mark checkpoints after each action
finishes and the screen settles. Choose Saved only after Framework finishes
saving. Stop/save and create the review bundle in the recording folder.

**TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH** remains active. See
[temporary logging instructions](TEMPORARY-INTENSIFIED-LOGGING.md) for scope,
failure reporting and removal work.

## Verification and downloads

The repaired source passed 1,096 tests and the Windows/Linux integration pipeline
before versioning. Local versioned build/package verification also passed. Final
release CI and the verified download will be recorded here after completion.
The public repository ZIP is a generic demo. The configured workstation update
is distributed separately so private paths remain outside the repository.
