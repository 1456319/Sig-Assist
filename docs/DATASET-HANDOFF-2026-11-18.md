# Dataset and prototype-download continuation — November18

Status: active validation. Root owns Git writes. Runtime changes and ready-to-run downloads are checkpointed together; no Actions-skip directives.

## Download repair — completed and demonstrated

`ecf21ce` refreshed the compiled page and ZIP as v0.1.10, added a visible source build ID, BUILD.json and freshness verification, and added automatic publication after Windows/Linux CI. A deliberate source-only guide update at `50b006a` passed CI run44246573500; its publisher actually committed refreshed downloads as `2fa54f3`. This proves branch ZIP downloads update on prototype rather than only receiving a CI attachment. The publisher skips stale source heads and uses normal non-forced pushes. All November17 source fixes remain in the branch ancestry.

## Dataset implementation

- `7a6cc7c` introduced v0.1.11 collection, local IndexedDB storage, five distinct capture stages, normalization of repeated exclusion policies, bounded sequence-based JSONL export, pending-write recovery and optional technician comments/ratings.
- Raw incoming source, default template, drug/strength and structured dose/route/schedule context, untouched generated suggestion, presented suggestion and actual final text remain distinct. Identity inputs are hashed with a durable local salt; no dataset text is uploaded automatically. Text/comments themselves may still identify someone.
- Queue sources collect automatically; known demo rows are skipped. Workbench plain/split reviewed copies also retain their manual source/context. Successful reviewed copies and exact read-back transfers have separate labels. A human can record the actual final SIG after Framework saves in Queue or Workbench; this is technician-confirmed, not machine save verification.
- Passive `dataset-snapshot` is separate from the existing hashed recorder. It uses the remembered window, a unique visible order container, associated PON/SIG, exact semantic field labels and Value/Text patterns without active Detect, recovery, scrolling, invocation or writes. It refuses ambiguity/unavailability and does not infer a saved prescription. Production binding still needs a short dummy workstation check.
- Field observations save immediately. Background exact-PON source enrichment cannot stall subsequent native captures; a regression holds the source lookup pending while the next PON/SIG is collected. Native-only SIGs remain explicitly unpaired if original prose is unavailable.
- `bfbdccd` retained rich-text paragraph content and nonblocking enrichment. Subsequent context preservation includes default templates and stable finding titles for replay; completion of those checks is pending at this checkpoint.

## Exclusion evidence and limited repair

The complete supplied list, with Undo ignored, is preserved in `docs/research/EXCLUSION-PATTERNS-2026-11-18.md`. It distinguishes already-covered clinical patterns, missing aliases and product-dependent dose/container substitutions. No blanket mL-to-vial, mg-to-patch or IU-to-capsule replacement was installed, and saved exclusions were not deleted.

A reproduced omission of dinner from “with breakfast and dinner” was fixed in clinical and classic translation. Both named meals remain beside the stated frequency; no absent BID is invented. Eight of ten new cases failed before repair; all ten and90 related regressions passed afterward. Safe indication-alias candidates remain documented for later corpus-backed work.

## Verification and current blocker

- Full local suite at7a6cc7c:1274 tests/80files passed. Atbfbdccd:1275/80passed, including the nonblocking enrichment regression. Lint/typecheck/build/package freshness checks pass.
- Storage tests committed10,000 synthetic rows incrementally and verified durable reopen, concurrent dedup, preserved corrections/comments/policies, stage counts, errors and1000/5000/4000 row pages. This is storage/architecture coverage, not a measured real technician translation success rate.
- First Windows focused run44250671214 compiled the new reader and passed association checks, then exposed a rich-provider terminal CR; corrected without stripping internal newlines or weakening the length limit.
- Follow-up44251988622 passed rich single/multiline and4000/4001 boundaries, then found the plain-control4001 test unexpectedly returning OK after a visibility switch. Diagnostics in44253022566 proved stable provider clipping: actual fixture length4001 but both first/later ValuePattern results were2000. The native reader now requires independently complete TextPattern coverage for ValuePattern results at that boundary; otherwise it returns SIG_UNAVAILABLE. The exact refusal assertion remains and a plain1999 positive was added. No cap was increased or failure assertion weakened. Windows rerun is pending.
- Full Windows/Linux source checks and focused native reruns are required before declaring this pilot validated. No claims of complete real Framework order coverage, saved-order detection, production binding, or PHI deidentification are made.

Next: verify the focused Windows provider-clipping repair, retain exact assertions, run final suite/CI, then update this handoff. Workbench tests cover plain and split reviewed copies and a separate human final confirmation. An additional repeated-route wording variant was noticed while preparing tests but was not established as a new source bug or patched; use the corpus to assess it independently. First live use should compare a few dummy original/final pairs and exports before large incremental collection. Keep collection local and export batches regularly from a stable browser/origin. FWDirect remains excluded; controlled substances are observation-only.
