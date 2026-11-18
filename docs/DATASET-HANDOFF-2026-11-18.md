# SIG dataset and prototype handoff — November 18, 2026

Status: implemented and synthetic validation passed. Workstation pilot remains to be checked with dummy records. Runtime source, compiled page, BUILD.json and portable ZIP are committed together at `45ecfa4e9540d6df723ebee97354caf8a12cd9f2` on `prototype`.

## Download and preservation

Current package: **v0.1.11**, build **3f5d71dba6b8b9a0a1fb93c9737acbba98d3651e3708485f1fa84157603d756b**. The header displays the version and short build ID. The ready-to-run page and `windows-demo/Sig-Assist-Windows-Demo.zip` match current runtime sources. All November 17 source fixes remain in branch ancestry (`1a72d9f` is an ancestor).

`ecf21ce` repaired the stale v0.1.9 downloads, added source fingerprints, freshness checks and CI publication. A deliberate source-only guide update at `50b006a` passed CI run 44246573500; the publisher committed refreshed downloads as `2fa54f3`. At the final runtime checkpoint, publication passed and the branch remained at `45ecfa4`, with no generated-file changes needed. This verifies branch downloads, beyond a CI attachment.

Continue to run `npm run prototype:package` before runtime pushes and commit the page, BUILD.json and ZIP together. Keep remote checkpoints incremental, use one Git writer and never restore old generated downloads or skip Actions. The publisher is a fallback for source-only pushes after successful Windows/Linux checks, and skips superseded heads with non-forced writes.

## What collection records

- Separate IndexedDB storage commits individual observations, normalizes shared exclusion policies and hashes identity inputs using a durable local salt. No dataset text is uploaded automatically. Raw SIG prose and comments can still identify someone; this is not automatic deidentification.
- Incoming Queue sources collect automatically, with known demo rows skipped. Queue and Workbench reviewed copies, including split parts, retain source/context and their actual copied text. Verified transfers require successful read-back. A separate human confirmation records the actual final SIG after Framework saves, with optional Yes/No assessment and comments.
- The five stages remain distinct: `source_received`, `reviewed_copy`, `verified_transfer`, `technician_confirmed`, and `framework_observed`. Observation counts are not unique completed orders or a translation success rate. Copies, transfers and field presence do not prove a prescription save.
- Raw incoming prose, drug/strength and structured dose/route/schedule context, default template, generated suggestion, presented suggestion and final text remain distinct. Stable finding titles/categories and exclusion policies support replay without saving identity-bearing finding IDs. Default templates now pass stored-record validation and survive reopen/export; a regression covers that path.
- Bounded JSONL exports include referenced policies. The export position persists across sessions and can be reset without deleting records. It advances only after its IndexedDB transaction completes. A failed position write reports an error and allows the same batch to be downloaded again. Browser download requests still require checking the downloaded file.
- Failed sample writes remain pending for retry or emergency download. The actual-final/comment form retains entries after failure. No memory or localStorage fallback is presented as durable storage.

## Passive Framework path

Start the new localhost connector in the same Windows/Citrix session, choose the entry window once through Find E-Rx, then select **Start passive Framework SIG collection** below the app header. This optional reader is separate from the existing hashed pilot recorder. It reads the remembered window, a unique visible recognized order container and associated PON/SIG using exact semantic labels and Value/Text patterns. It rereads the PON around the SIG, without active Detect, recovery, scrolling, selection, invocation or writes.

Field observations save immediately. Exact-PON source enrichment runs in the background, using a unique loaded Queue source or Iguana's one-day/seven-day query windows. Slow enrichment cannot stall the next five-second native poll. Unavailable/ambiguous sources remain explicitly unpaired. Polling cannot guarantee every short-lived order is captured or detect prescription completion; real installation binding remains unproven until the dummy workstation check.

Windows provider testing found a rich-edit terminal paragraph marker and a plain ValuePattern provider returning 2,000 characters for a 4,001-character control. The reader preserves internal newlines, normalizes one terminal paragraph marker and rejects overlength/incomplete content. ValuePattern results at the ambiguous boundary require independently complete TextPattern coverage. Exact 4,000/4,001 rich-text checks, the 1,999 plain positive and the clipped-plain refusal remain enforced. Fixture mode changes recreate control handles, so transfer tests now detect the current field after passive fixture tests. No failure assertions were weakened.

## Exclusions and translation

The complete supplied exclusions, with Undo ignored, are normalized in `docs/research/EXCLUSION-PATTERNS-2026-11-18.md`. The report distinguishes existing clinical coverage, missing aliases and product-dependent substitutions. Saved exclusions were preserved. No blanket mL-to-vial, mg-to-patch or IU-to-capsule replacement was added.

The reproduced loss of dinner from “with breakfast and dinner” was repaired in clinical and classic translation. Both named meals survive beside the stated frequency; no absent BID is invented. Eight of ten cases failed before the repair; all ten and 90 related regressions passed afterward. Further indication aliases remain documented for corpus-backed work. A repeated-route split-order wording variant noticed during test preparation remains a separate corpus investigation, not a claimed repair.

## Completed verification

- Full local suite: **1,282 tests in 81 files passed**. Lint, TypeScript checks, the 388-code root-reference comparison, build, archive/source comparison and package freshness passed.
- Storage coverage includes 10,000 synthetic observations written incrementally, reopen, concurrent deduplication, corrections/comments/policies, stage counts, abort/quota/corruption paths and bounded 1,000/5,000/4,000-row pages. This is synthetic storage coverage, not 10,000 collected real SIGs or a clinical accuracy measure.
- [Focused Windows native run 44256334895](https://github.com/1456319/Sig-Assist/actions/runs/44256334895): passed.
- [Complete MVP run 44256334877](https://github.com/1456319/Sig-Assist/actions/runs/44256334877): Windows, Linux and prototype publication passed for `45ecfa4`. Windows coverage includes synthetic DocuTrack reading, Framework instances/grids and desktop transfer, user-only Node/bootstrap, PowerShell/UNC launchers, Edge localhost/direct-file clipboard workflows, Iguana import/bridge and pilot file recording.

## Next workstation check and next development step

Use a few dummy orders first: include one manual Framework edit, one order processed without using Detect again and an unreadable/ambiguous screen. Compare the original and final text, capture stage, context and downloaded JSONL. Reopen the app and verify the next export resumes. Use the same browser/origin; clearing the queue leaves the dataset intact, while browser data removal or a changed origin can make it unavailable. Export regularly.

If native binding is unavailable, record the returned status and relevant field labels rather than guessing a SIG association. Until live binding is demonstrated, use Queue/Workbench captures and technician-confirmed finals to collect useful labeled pairs. Keep sources, copied drafts, passive observations and confirmed finals as separate evaluation groups. Prioritize treatment orders, sliding-scale insulin, missing indication aliases and actual technician corrections in the next refinement pass.

FWDirect remains excluded. Controlled-substance data is observation-only; processing/refusal was not automated. Intensified diagnostic logging retains its explicit temporary-removal priority, separately from this dataset feature. No new Lovable/Figma audit or external clinical-data upload was performed in this increment.
