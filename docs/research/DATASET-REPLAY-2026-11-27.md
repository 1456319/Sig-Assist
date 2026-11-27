# Incremental SIG dataset replay — November 27, 2026

Starting prototype checkpoint: `ea14e70`, version 0.1.17. Implementation is
in progress; the following inspection is complete, not a translation-accuracy
claim.

The newly supplied private JSONL batch contains 206 nonblank lines: one batch
header, two exclusion-policy snapshots and 203 observations (200 source_received,
three technician_confirmed). Its declared sequence interval contains exactly
203 observations. All captures identify erx_source. Raw data, opaque identifiers,
clinical examples, source links and replay output remain outside Git and are
not forwarded to external labs.

The current collector exports JSONL but has no reusable offline import/replay
command. Add one for subsequent batches, preserving saved exclusion policies,
separating observations by provenance and reporting malformed lines or missing
policy references explicitly. Overlapping downloads must not inflate counts.
Source observations measure execution/coverage, not correctness. A final text
on one split cannot be compared with the combined generated group as if it
were a whole-order answer. Passive matches remain unverified.

Existing November 27 Lovable reviews have already been completed and integrated;
the engineering and clinical allocations were exhausted. Do not duplicate those
turns. A focused replay review may use any remaining QA credits without a
purchase or upgrade, using public source and synthetic examples only.

Next: implement parser/replay plus synthetic regressions, run this private batch,
record aggregate results and supported repairs, regenerate matching prototype
downloads for runtime changes, and verify remote checkpoints and CI.
