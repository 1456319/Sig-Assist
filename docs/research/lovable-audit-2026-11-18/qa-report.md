# Functional audit — 2026-11-18

Baseline: public `1456319/Sig-Assist@11fa35b767cf221cefc81837486ee47f602a1c34`, fetched into a fresh isolated `/tmp` directory; v0.1.11, build `3f5d71dba6b8` (runtime checkpoint `45ecfa4e9540d6df723ebee97354caf8a12cd9f2` per upstream handoff). The pharmacy repository and package were not changed or published. Only synthetic examples and mocked responses are used.

## Findings and isolated candidates

### QA18-01 — Split confirmation loses edits and mixes provenance (high)

- **Baseline:** `src/components/SigDatasetPanel.tsx:161–184` (`SigDatasetConfirmation`), `WorkbenchView.tsx:451–453`, `OrderQueueView.tsx:336–339`.
- **Trigger / actual:** Edit the morning part's actual text, answer No and add a comment. Switch to evening, record it, and return to morning. The evening record inherits the morning rating/comment; the morning correction has reverted to the app draft. In the real Workbench path, a reviewed copy of part 2 captured `1T PO QHS X5D` as its suggestion; confirming the same part captured the combined `2T (20MG) PO QAM AND 1T PO QHS X5D` instead. The Queue verified-transfer call also uses the combined suggestion by source inspection.
- **Expected / minimal fix:** Keep actual-text edits and optional feedback by part within the open order, and attach the selected part's presented suggestion separately from its edited draft. Pass that suggestion through Queue and Workbench; use the selected part's suggestion for verified-transfer metadata as well. No changes to translations, transfer behavior, save criteria, or prompts.
- **Evidence:** Two baseline failures in `auditNov18Dataset.test.tsx`, plus an added assertion in the existing Workbench workflow test. All pass with `01-dataset-pairing-and-split-confirmation.patch`. This does not persist unsubmitted form edits across navigation/reload. The Queue transfer metadata adjustment was typechecked; the reproduced end-to-end suggestion mismatch was in Workbench.

### QA18-02 — Late source lookup can attach a field observation after its PON becomes ambiguous (high)

- **Baseline:** `src/components/SigDatasetPanel.tsx:55–71,91–106`. Direct capture checks for same-PON Queue collisions; delayed enrichment checks only whether collection stopped, not whether the same PON is still unambiguous in the live Queue.
- **Trigger / actual:** With an empty Queue, capture a field for synthetic PON `SYN-X:01` and hold the source lookup. Load two Queue orders with that same exact PON at different facilities. Resolve the lookup to facility A. The dataset receives both the correct unpaired field observation and an additional paired observation for A even though the Queue now shows a collision.
- **Expected / minimal fix:** Keep the unpaired observation, and before caching or recording a delayed candidate, require that the current Queue either has no matching row or has exactly one row with the same source stamp. Recheck before each buffered pairing. The unique, uncontested late lookup still creates an enriched observation; the raw field capture and non-blocking lookup behavior are unchanged. This does not arbitrate across incomplete external source windows or retroactively correct exported observations.
- **Evidence:** The collision regression fails on baseline and passes with patch 01; the no-collision control passes on both.

### QA18-03 — Dictionary edit feedback omits an unsuccessful shared write (medium)

- **Baseline:** `src/lib/sigDictionaryService.ts:194–223` (`saveInserts`, `upsertSigEntry`), `src/components/DictionaryView.tsx:227–230`. A remote `{ error }` leaves a durable local correction, yet the UI emits the same generic success toast as it does for a shared acknowledgment. A subsequent successful `fetchAllSigEntries` does not resend the pending entry.
- **Trigger / actual:** Save `SYNTHQA` while the mocked shared upsert rejects, then reload the list with a successful empty shared response. The local code is visible and retains its ID; no second upsert occurs. Reopen and save the same entry: it reuses the ID and can be acknowledged remotely. No local code loss was observed.
- **Expected / minimal fix:** Keep the saved edit visible and distinguish device-only saves, unconfirmed shared saves, and acknowledgment; offer the existing edit/save path as the manual retry. Patch 02 is confined to single-entry saves and does not change import/delete behavior or infer shared visibility from an acknowledgment.
- **Why no automatic retry:** Legacy entries without sync history are marked pending (`sigDictionaryService.ts:45–54`), as are newer explicit edits. Blind replay from `fetchAllSigEntries` would treat the former as new writes and could overwrite a colleague's update; reading the dictionary also occurs automatically in Workbench. A follow-up should distinguish explicit retryable writes from legacy merge protection before adding replay. The no-error/zero-row-delete uncertainty remains: tombstones are untouched. Shared rename constraints and actual row visibility were not tested against a hosted service.
- **Evidence:** Three tests fail on baseline and pass with `02-dictionary-edit-save-status.patch`, including the actual dictionary editor's feedback and a repeat save using the original ID.

## Earlier findings and scope

| Finding | Disposition at this checkpoint |
| --- | --- |
| D1 stale local dictionary after remote failure | Fixed: all nine existing failed/malformed/thrown-response races passed. |
| D2 matching count and exact PON lookup | Fixed: existing Iguana panel regressions passed, including exact matching across the seven-day retry. The prior pilot-cause inference remains withdrawn. |
| N1/N2 clause and route boundaries | Fixed: the existing boundary suite passed; monitoring, ordered treatments and scale-scope suites also passed. |
| AC/HS header and footer independence | Fixed for tested aliases: all five schedule-alias regressions passed. |
| Shared dictionary pending edits / delete confirmation | No automatic resend reproduced; actionable single-entry feedback proposed above. No shared delete proof or schema claim. |

Reviewed IndexedDB validation, deduplication, pending drain and emergency download, pause gating, export cursor, passive source enrichment, and Queue/Workbench capture. Existing storage and panel controls for reopen, defaults, failed export-position writes, pending recovery, pause and split copy passed; no new storage/export-loss claim. No native changes or workstation run. Real PON+SIG binding and save behavior remain unverified; an observed field still does not prove a saved Rx. No FWDirect, controlled-order automation, data upload, or service interaction. Test counts are not clinical accuracy. Remaining credit balance was not measured; no purchases or account changes were made.

## Verification and transplant

- Seven new tests plus one strengthened Workbench assertion: **seven failures and one passing control on baseline**; all eight checks pass with the candidates. Focused final rerun: **12/12** across four files, including both modified upstream test files. Baseline and candidate application typecheck passed; targeted candidate lint passed.
- Final candidate run: **1,278 tests passed in 82 files** excluding `tests/prototypePackage.test.ts`. The original full baseline run hit four publication-test failures because the sandbox blocks `git init`; the packaging file has 11 tests total, of which seven unrelated checks passed on baseline. No packaging file, compiler flag, or pre-existing assertion was weakened.
- Apply the two `audit-2026-11-18/*.patch` files at the pharmacy checkout root with `patch -p1`, and copy both adjacent `auditNov18*.test.tsx` files into its `tests/` directory. Both patches passed a dry run against a second pristine extraction of the exact commit. Run the focused tests and upstream packaging/Windows checks in the authorized checkout before integrating.
