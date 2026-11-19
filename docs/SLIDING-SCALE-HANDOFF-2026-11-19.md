# Insulin sliding-scale handoff — November 19, 2026

Verified runtime checkpoint: `86ad02ee64cef6dce5358446688e5b39fcb2b21f` on `prototype`. Package **v0.1.13**, build **63550207f9198242917df0f25f087de5a52db8462cd762f9a129f66a1317a9a2**. Source, ready-to-run page, BUILD.json and portable ZIP were pushed together. Earlier contract and partial implementation checkpoints remain in branch history.

## Implemented contract

The [site formatting rules](SLIDING-SCALE-FORMAT.md) now drive clinical and classic translation. Every scale draft starts CBS/frequency/SS, using the ordered literal-code concessions when necessary. An unresolved schedule is visibly marked `[FREQUENCY]`; unresolved dose wording is retained for editing.

- Conditions and correction doses retain their bounds, inclusivity and U units. A late low-glucose clause moves with its own actions. No absent low band or missing correction dose is invented.
- Call/notify recipients normalize to CALL MD. Protocol, site-specified `1ML GLUCAGON IM`, high-band rechecks, conditional notifications and critical-result recording remain distinct actions. Glucagon normalization is reported; its rescue volume is not read as an insulin dose.
- A fixed additional dose follows the scale as PLUSnU, with its own schedule when different and its own hold/other qualifiers. A bedtime fixed dose no longer leaks bedtime into a before-meals correction scale or supplies an absent correction frequency. A call followed by a dose within a band cannot become an unconditional fixed dose.
- Prose IF/THEN/ranges, provider aliases, the supplied CALLD/NP typo and distributed clauses are supported. Contradictory doses, mass/volume correction doses and unrepresentable band-specific schedules retain source wording and a review finding. Prose-header courses use the existing duration resolver; additional monitoring qualifiers remain visible with review findings.
- Concessions apply to the combined entered parts: spacing, diagnosis, literal S.S., then literal C.B.S., stopping as soon as sufficient. A read-only unified preview is not counted again. Review counters follow technician edits. Length alone does not prevent approval/copy, and no instruction is truncated to satisfy the limit.

## Supplied synthetic example

```text
C.B.S. WMHS S.S. <70=HYPOGLYCEMIC PROTOCOL;150-200=4U;201-250=6U;251-300=7U;301-350=10U;351-400=12U;450+=14U&RECHECK 2H&CALL MD IF STILL HIGH.PLUS3U(H IF NOT EATING)
```

This is **165 typed characters / 203 estimated expanded characters**. All four concessions are reported, followed by the prominent over-budget notice. The source also lacks a 401–449 correction band; it is flagged without supplying a dose. The additional 3U is separate from the 14U high-band dose, and the no-food hold stays with the fixed dose.

The expansion estimate uses the bundled dictionary and technician-supplied CBS/SS meanings. Actual site dictionary expansion and Framework Preview Sig remain to be compared when the technician returns. The estimate is not a live Framework response. No new workstation capture is required this week to preserve or test this implementation.

## Validation and continuation

Local final validation passed **1,368 tests in 92 files**, including 38 new tests for this contract, prose mutations, concession boundaries, combined part budgets, qualifier retention and editable over-budget copying. TypeScript, ESLint, the 388-code root-reference check, production build, source fingerprint and every packaged ZIP entry passed. Existing treatment, storage, dataset, native bridge policy and queue tests remain included.

Older scale expectations were updated for the new site contract. Original discrepancy inputs were retained; only reviewed expected outputs/suborder outputs changed. An ambiguous source remains ambiguous even though its retained draft now receives the mandatory header and applicable concessions.

Final runtime [CI run 44520674617](https://github.com/1456319/Sig-Assist/actions/runs/44520674617) **passed Windows, Linux and automatic prototype publication**. This includes DocuTrack synthetic controls, multiple Framework instances/virtualized grids, desktop detection/transfer, Windows launchers, direct UNC/file workflows, Edge clipboard, Iguana intake and pilot file recording. The earlier synthetic DocuTrack readiness timeout did not recur in the successful runs. The committed page, BUILD.json and ZIP match source build `63550207f919`; no runtime checks remain pending for checkpoint `86ad02e`. This final results note changes documentation only.

Next workstation check: use dummy records to compare ordinary CBS/SS and dotted literal previews, confirm the shared part budget and expanded frequency wording, and verify the highlighted output against the target PON. Preserve the technician's final edits/feedback using the existing local dataset and discrepancy workflow. FWDirect remains excluded. No capture or dataset was sent to an external model during this change.
