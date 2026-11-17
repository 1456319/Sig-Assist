# Sig-Assist v0.1.9 workstation build

Released November 17, 2026 from the reconstructed, cross-platform-validated
prototype. The versioned package passed its final Windows and Linux checks.

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

The versioned build passed all 1,096 tests on Windows and Linux, lint/type checks,
native DocuTrack and Framework fixtures, builds/packages, Windows launchers, UNC
paths, Edge clipboard/direct-file workflows, Iguana and pilot recording checks.
[Release CI 44054605684](https://github.com/1456319/Sig-Assist/actions/runs/44054605684)
validated commit `bfd2fb2d22f824a7109ad171d43d95fe34fd8da0`.

[Public generic demo ZIP](../windows-demo/Sig-Assist-Windows-Demo.zip).
The configured workstation update is distributed separately in the existing
Prototype builds folder; its private paths and connection profile are not in the
public ZIP. The configured upload was downloaded and verified byte-for-byte.
Its eight core files also match the Windows-tested CI artifact byte-for-byte.

- Configured filename: `Sig-Assist-Workstation-v0.1.9.zip`
- Size: 268,762 bytes.
- SHA-256: `bd57a72a267fa0df4f46b2967370aceb77578bfd9e63441853b12e68b5ce4ae3`
- App build ID: `0eb8cbb9c8821c4c1659a468a79af1be351bd70612de6c158f0d83a5485a0f78`
