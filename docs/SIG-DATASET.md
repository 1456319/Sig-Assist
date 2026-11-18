# Local SIG refinement dataset

The collector is designed for incremental collection toward10,000–50,000+ source/processed SIG examples. It stores observations individually in a separate local IndexedDB database, not in the queue, diagnostic outbox, or localStorage. No dataset text is uploaded automatically. SIG text and optional comments may contain sensitive information; local collection is not automatic deidentification.

## Collection

The **SIG dataset** controls are available beneath the app header. Incoming queue sources collect automatically while collection is enabled; known demo rows are skipped. Successful reviewed copies and exact read-back transfers record their own stages with the source, drug/strength context, generated and presented suggestions, final text and applied exclusion policy. Copying or transferring does not establish that Framework saved a prescription.

Workbench reviewed copies collect their manual source/context as well, including split parts. The same final-SIG confirmation section is available there after processing; it accepts an actual Framework correction without treating an earlier clipboard copy as a prescription save.

To include orders processed entirely in Framework, start the localhost connector in the same Windows/Citrix session, choose the entry window once through Find E-Rx, then choose **Start passive Framework SIG collection**. The collector polls every five seconds after each request finishes, without active Detect, scrolling, recovery, selection or writes. It accepts only a unique PON and semantically labeled SIG in one visible entry view, rereads the PON around the SIG, and refuses ambiguous/incomplete reads. When possible, a unique exact-PON source is read from the current queue or Iguana's one-day/seven-day windows. An unavailable source stays explicitly unpaired.

This produces **framework_observed** records. Field observations save immediately; slow Iguana source lookup runs separately so it does not block subsequent native reads. A later exact source match creates an enriched observation; an unpaired observation remains explicitly labeled. Intermediate edits can be observed. A field observation is not a machine-verified prescription save, and polling cannot guarantee every short-lived order is captured. Real installation coverage of PON and SIG together still needs a short workstation check; an unavailable binding is reported rather than replaced with a guessed source.

After Framework finishes saving, open the selected order's **Finished in Framework?** section. Correct the actual final SIG if it changed there, optionally answer Yes/No and comment, then choose **Saved in Framework — record final SIG**. This labels a **technician_confirmed** example. The technician remains the source of that completion claim. It does not process or refuse an order. Controlled-order examples are observation data only; no controlled-substance processing is automated.

## Data and export

Every record identifies its capture stage, source kind, application version and full build ID. Original source prose, the drug/strength context, default SIG template, generated draft, presented suggestion and human final remain distinct. Reviewed examples retain stable finding categories/titles rather than identity-bearing finding IDs. Patient/facility names and plaintext PON/order identities are not copied into structured dataset fields; local identity inputs are salted hashes. Clinical prose itself is retained verbatim and may still identify someone. Repeated exclusion snapshots are stored once and referenced by policy ID.

Identical complete observations deduplicate across page reloads, while changed final SIGs, comments, ratings, source/context or exclusion policies are retained. Observation counts are not unique-order counts or a translator success rate. Use technician-confirmed pairs for accepted-output evaluation; sources alone and passive observations belong to separate evaluation cohorts.

Choose **Download next 1,000 samples** to export bounded JSONL batches. Each batch includes metadata and the exclusion policy records it references. The export position is saved in IndexedDB and resumes across sessions; new rows remain available after earlier exports. No export deletes stored records. A download request cannot prove that the browser saved the file: check the download before closing. **Reset export position** durably returns to the beginning for downloading earlier batches again. A failed position write leaves the previous position intact and reports an error; retrying may download the same batch again.

Keep the same browser and localhost address while collecting. A different origin, clearing browser data, browser storage eviction or workstation disk failure can make local data unavailable. Export batches regularly. Clearing the order queue does not delete the separate dataset. On a failed write, the UI does not report success: samples remain pending for retry or emergency download, and the final-text/comment form remains intact. Keep the page open until pending samples are saved or downloaded.

## First workstation check

Use a few dummy orders first. Verify the original text, actual Framework SIG, stage and exported JSONL agree; include a manual Framework edit and an order processed without using Detect again. Check that ambiguous/hidden/unreadable screens show an unavailable status instead of an unrelated SIG. Then expand collection incrementally. Collecting a large number of unlabeled drafts alone will not establish correct translations.
