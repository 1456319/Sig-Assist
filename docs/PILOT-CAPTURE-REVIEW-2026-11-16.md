# E-Rx pilot capture review — 16 November 2026

Reviewed the complete v0.1.7 session manifest, workflow part, eight translation parts and two review bundles supplied by the technician. This report contains aggregate findings only; raw captures and workstation configuration remain private.

| Evidence | Result |
| --- | --- |
| Session duration | Approximately 15 minutes; technician stopped normally |
| Saved records | 33,118: 1,114 workflow and 32,004 translation |
| Integrity | Final bundle matches the parts; unique sequence numbers 1–33,118, no gaps |
| Earlier bundle | 33,096 records; final bundle adds the last 22 workflow records |
| Checkpoints | 31 |
| Passive snapshots | 294 attempts: 288 readable, 6 busy |
| Snapshot completeness | All 288 readable snapshots marked partial |
| Browser interaction records | 106 clicks, 34 changes |
| Connector queries | 18, all HTTP 200 |
| File writer drops | Zero reported |
| Browser translation drops | 30,634 explicitly reported before the file writer; zero browser workflow drops |

## What this establishes

The files are useful workflow evidence. Repeated E-Rx queue, directions, patient-order, product-selection and prescription-entry views appear in the sampled control metadata. Checkpoint timing uncertainty does not spoil these independent automatic observations. For future sessions mark checkpoints after the action finishes and the screen settles; Saved is the technician's observation after a completed Framework save.

The final review bundle contains all saved parts and is sufficient for normal review. The earlier bundle and loose parts duplicate most of it; retain them locally for recovery.

## Limits of this capture

All readable native snapshots hit the bounded observer's partial-result condition. Median observation time was approximately 1.2 seconds, with a median of 117 captured nodes. The data exposes several view changes but does not expose the quantity, days-supply, package and start-date controls needed to map a complete prescription-entry workflow. Periodic sampling also cannot establish every click, a successful clinical save, or the semantic correctness of an order. This capture does not establish a usable write endpoint.

Zero file drops must not be read as zero total drops. Browser overflow records report four translation bursts totalling 30,634 discarded events. The accepted files and final bundle are internally consistent; discarded events never reached them. Existing raw files must not be described as a complete translation trace.

## v0.1.8 response

The previous recorder persisted pending diagnostic buffers in localStorage, competing with discrepancy reports and customizations for its small quota. This is a plausible explanation for the reported save regression; the capture alone does not prove the workstation's exact storage exception.

- Move diagnostic buffers to IndexedDB, migrating only recognized legacy diagnostic keys after a verified durable copy.
- Add a separate local database fallback for discrepancy reports, merging by ID and preserving older archives. A failed save retains the form and offers an individual report download.
- Avoid translating every waiting unapproved order during queue status calculation and persistence. A 1,200-order regression test checks that the selected order still translates without evaluating all waiting rows. Existing reviewed/split-order checks remain active.
- Include cumulative browser drop counts in the manifest separately from file drops, and clarify checkpoint timing in the UI and guide.
- Retain the conspicuous `TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH` marker.

The native reader's coverage still needs improvement before requesting another long capture. Its passive scope and cooperative budget are unchanged in this release. The supplied data is enough to identify this limitation; the technician need not repeat the session merely because the checkpoint timing was uncertain.
