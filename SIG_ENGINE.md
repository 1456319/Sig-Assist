# Structured SIG engine handoff

The engine in `src/lib/sigEngine.ts` is deliberately not a list of complete
input-to-output substitutions. It has a stable boundary that later work should
preserve:

1. `normalizeSigText` normalizes nurse-entered prose.
2. `parseSigOrder` extracts order facts into `ParsedSigOrder`.
3. Validation adds explicit warnings or blocking issues; it never silently
   fills a clinical gap.
4. `renderSig` is the only stage that decides output ordering/formatting.

## Adding a feature

Add general language variants to the relevant extractor. Add a medication
default as a template/data record which consumes structured facts. Do not add a
new exact-input condition that returns a finished SIG string.

The next implementation slices are: medication template data (powders,
diclofenac, APAP products), the complete indication vocabulary, multiple-SIG
rendering for site-dependent products, and a review UI that blocks clipboard
copy when `issues` has a blocking item.

## Tests

`npm test` runs fast local regression tests. Each additional behavior needs a
test with a varied input, not merely the exact wording from `TESTS.txt`.
