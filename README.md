# Sig-Assist

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-anlnsuwh)

## SIG engine foundation

`src/lib/sigEngine.ts` uses three separate stages: `parseSigOrder` extracts
structured facts, validation records warnings/blocking issues, and `renderSig`
builds the concise SIG. Add medication-specific defaults as data/templates
around this engine; do not add final-output substitutions to the UI parser.

Run the regression tests with `npm test`.
