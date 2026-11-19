# Insulin sliding-scale handoff — November 19, 2026

Runtime checkpoint: `30a0bb058d13e8dc8eeb919f9f824e8345fefc17` on `prototype`. Package **v0.1.13**, build **d4cc532bd3a0f02d56954c4684e0ff5d02e9ea836a595fb11ca1281a2d6d99d1**. Source, ready-to-run page, BUILD.json and portable ZIP were pushed together. Earlier contract and partial implementation checkpoints remain in branch history.

## Implemented contract

The [site formatting rules](SLIDING-SCALE-FORMAT.md) now drive clinical and classic translation. Every scale draft starts CBS/frequency/SS, using the ordered literal-code concessions when necessary. An unresolved schedule is visibly marked `[FREQUENCY]`; unresolved dose wording is retained for editing.

- Conditions and correction doses retain their bounds, inclusivity and U units. A late low-glucose clause moves with its own actions. No absent low band or missing correction dose is invented.
- Call/notify recipients normalize to CALL MD. Protocol, site-specified `1ML GLUCAGON IM`, high-band rechecks, conditional notifications and critical-result recording remain distinct actions. Glucagon normalization is reported; its rescue volume is not read as an insulin dose.
- A fixed additional dose follows the scale as PLUSnU, with its own schedule when different and its own hold/other qualifiers. A bedtime fixed dose no longer leaks bedtime into a before-meals correction scale. A call followed by a dose within a band cannot become an unconditional fixed dose.
- Prose IF/THEN/ranges, provider aliases, the supplied CALLD/NP typo and distributed clauses are supported. Contradictory doses, mass/volume correction doses and unrepresentable band-specific schedules retain source wording and a review finding. Prose-header courses use the existing duration resolver; additional monitoring qualifiers remain visible with review findings.
- Concessions apply to the combined entered parts: spacing, diagnosis, literal S.S., then literal C.B.S., stopping as soon as sufficient. A read-only unified preview is not counted again. Review counters follow technician edits. Length alone does not prevent approval/copy, and no instruction is truncated to satisfy the limit.

## Supplied synthetic example

```text
C.B.S. WMHS S.S. <70=HYPOGLYCEMIC PROTOCOL;150-200=4U;201-250=6U;251-300=7U;301-350=10U;351-400=12U;450+=14U&RECHECK 2H&CALL MD IF STILL HIGH.PLUS3U(H IF NOT EATING)
```

This is **165 typed characters / 203 estimated expanded characters**. All four concessions are reported, followed by the prominent over-budget notice. The source also lacks a 401–449 correction band; it is flagged without supplying a dose. The additional 3U is separate from the 14U high-band dose, and the no-food hold stays with the fixed dose.

The expansion estimate uses the bundled dictionary and technician-supplied CBS/SS meanings. Actual site dictionary expansion and Framework Preview Sig remain to be compared when the technician returns. The estimate is not a live Framework response. No new workstation capture is required this week to preserve or test this implementation.

## Validation and continuation

Local final validation passed **1,367 tests in 92 files**, including 37 new tests for this contract, prose mutations, concession boundaries, combined part budgets, qualifier retention and editable over-budget copying. TypeScript, ESLint, the 388-code root-reference check, production build, source fingerprint and every packaged ZIP entry passed. Existing treatment, storage, dataset, native bridge policy and queue tests remain included.

Older scale expectations were updated for the new site contract. Original discrepancy inputs were retained; only reviewed expected outputs/suborder outputs changed. An ambiguous source remains ambiguous even though its retained draft now receives the mandatory header and applicable concessions.

GitHub Windows/Linux run **44517805463** passed for preceding runtime `5d14bb84d5d807731937709b158bd28c8a2d4219`, including native controls, browser, UNC and pilot checks. An earlier synthetic DocuTrack fixture readiness timeout did not recur. The final pure-TypeScript header-qualifier fix was then rebuilt and passed all 1,367 tests locally; its complete GitHub run is pending at this documentation checkpoint. Native integration code did not change. Record the final runtime CI result below before closing the task.

Next workstation check: use dummy records to compare ordinary CBS/SS and dotted literal previews, confirm the shared part budget and expanded frequency wording, and verify the highlighted output against the target PON. Preserve the technician's final edits/feedback using the existing local dataset and discrepancy workflow. FWDirect remains excluded. No capture or dataset was sent to an external model during this change.
