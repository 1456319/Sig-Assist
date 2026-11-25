# Lovable audit review and implementation

Baseline was prototype commit `9304ba0f35b7ae04a3a8cb0dce71bac0bfa043ac`. The three lab plans inspected pinned source and supplied proposed tests. They ran no tests. Sol reproduced the defects with regression tests before applying repairs.

## Treatment clauses

The additional PRN clause could lose its application site, schedule and procedure. Distinct wording now stays on a separate card with a review finding. Plain repeated application headers collapse only when their normalized site and retained qualifiers agree. Combined output and the split finding include every card. Regression cases cover changed site and side, duration, constrained frequency, an additional dressing action and several explicit application clauses. The existing sacrum duplicate case keeps its expected output.

The lab proposed a new general descriptor parser. The repair uses the existing site normalizer and a narrowly recognized duplicate header. Uncertain wording remains available for review.

## Administration-time approval

Times review now binds to the selected part, its text, the order times and the detected times destination. Switching parts clears the entered time and match confirmation. Split entries start empty, with order-wide times available as reference. A changed part draft, order times or destination invalidates times approval. Rx Entry group state also resets with the selected part context. Single-part times still prefill.

The lab suggested field identifiers absent from the browser response and an unused part ID in the connector request. The implemented stamp uses the actual token and destination metadata. The native helper still requires a dummy-workstation check to establish which Framework split receives a times edit.

## Passive dataset attribution

Source candidates are no longer reused from a PON cache. Lookup can enrich only the latest observation while its field and queue context remain current. A changed field, unavailable read or conflicting queue invalidates the pending result. Lookup retries follow a fresh native read. The collector retains raw observations while a source service is stalled. A unique recent source must also survive the seven-day lookup. Source changes participate in observation deduplication.

The QA plan overclaimed certainty from a single PON candidate. New passive rows explicitly record `sourceMatch` as `pon_candidate` or `unpaired`. Export marks old passive rows without provenance `legacy_unverified`, preserving the stored originals. These rows require confirmation before accepted-output evaluation. The native response cannot establish patient, facility, incoming revision or split identity.

The QA plan also misstated the existing export hashing and confused a capture kind with a stage. Existing salted identity hashes and the five capture stages remain in use. Regression tests cover candidate provenance after database reopen, legacy export, PON reuse, source revisions, stalled lookups, conflicting queues, unreadable fields and seven-day collisions.

## Checkpoints and verification

The treatment and transfer checkpoint is remote commit `6cfe2b555da7d4dae2b7e4f2cc3e8d15a3bec885`. The dataset and final runtime checkpoint is `1603822c51f7db439bd55cd35b3b15fddb625846` on `codex/lovable-audit-fixes`. All 1,392 tests in 94 files pass locally. Full lint, type checking, production build, the 388-code root-reference check and portable package verification pass. The Windows package reports v0.1.13, build `18e6086f7efb`. GitHub Windows/Linux checks and prototype publication are pending at this documentation checkpoint.

The first CI checkpoint caught an overly broad patient-match reset when the technician edited a SIG. The final implementation preserves that order/part confirmation while independently invalidating time approval when its text or context changes. The normal compound-PON lookup/review/transfer test passes again.

On the dummy workstation, open split B, identify its times editor, enter and approve B's times, then compare the actual schedules for A and B. Also compare one same-site duplicated treatment and the retained right-elbow card against the original source. The earlier SSI changes remain on `codex/ssi-lovable-validation` and require an integration review before promotion.
