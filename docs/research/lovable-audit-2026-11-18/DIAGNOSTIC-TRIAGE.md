# Privately supplied diagnostic export — November 18 triage

This review followed the completed Lovable code reviews. The private file was read locally by the coordinator; it was not supplied to Lovable or committed. No source identifiers, private Drive URL, patient data, original clinical text or captured outputs are reproduced here.

## What the file contains

- Diagnostic-export metadata labeled application version 0.1.5, without a source build fingerprint. That label alone cannot identify the exact source commit used.
- 1,000 trace events, including 201 translation starts and 198 rendered outputs; 195 distinct drug/output pairs were found in a chronological diagnostic pairing. These are trace observations, not unique processed prescriptions or validated source/target pairs.
- No discrepancy-case archive, original-directions text fields, accepted final SIGs or technician comments. Input traces store the length of original prose, rather than its text.
- Five distinct insulin-related outputs were identified; two retained substantial scale prose suitable for a limited replay.

## Limited retained-output replay

The two older outputs were replayed as inputs against current source `ab6adfd` (v0.1.12 build `eaa14600b431`). This is explicitly a replay of retained generated text, not recovery of the nurse's original directions or a technician-approved target.

| Retained shape | Current result | Next evidence/development target |
|---|---|---|
| Scheduled fixed dose combined with an additional correction scale, repeated dose annotations in the bands | Original retained wording, incomplete-scale review and field-length review; no useful structured scale produced | Separately represent the scheduled dose and explicitly additive correction; confirm repeated band annotations agree. The retained text also has a coverage gap, which must not be filled by inventing a dose. |
| Recognizable scale bands plus a malformed threshold fragment and unit spelling variation | Unit-typo finding plus incomplete-scale review; original retained wording | Preserve and expose the unresolved threshold span while translating independently understood parts. The intended comparison and target SIG require the original direction/correction pair. |

These cases demonstrate remaining functionality gaps; they are not claimed repaired by the general frequency, HOLD-scope or classic-retention work in this audit. Generated outputs alone must not become the expected answers in a regression corpus.

## Required next export

Use **Saved discrepancy cases → Export discrepancy cases**, and **Export archived reports** if the older cases were archived. That archive includes original directions, proposed text, corrections and notes needed to distinguish an already-fixed historical defect from a current failure. Remove patient identifiers before sharing; keep the clinically relevant wording, medication context and technician correction. There is no need for a HAR to inspect this archive.

Current SIG dataset collection records original and final observations separately for future refinement. The next insulin pass should prioritize source/correction pairs and useful partial drafts, retaining unclear spans for technician correction rather than guessing their meaning.
