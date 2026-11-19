# Site sliding-scale contract — November 19, 2026

The technician supplied these rules directly. They supersede older scale-output spellings; source directions remain unchanged.

- Every insulin scale draft starts `CBS <frequency> SS`, subject to the dotted-code concessions below. SS already supplies the insulin injection/SQ instruction, so a redundant trailing SQ is omitted.
- Use `lower-upper=nU;next=...`, with no padding around comparisons, equals signs, semicolons or ampersands. Preserve source bounds, inclusivity, doses and absent bands. Do not add a low-glucose band when none was supplied.
- Sort condition/action pairs by glucose bound, even when a low-glucose clause appears late in the directions. Conditions retain their own actions.
- CALL/NOTIFY recipient variants use `CALL MD`. Known verbose requests for further instructions are part of that notification, not a new dose.
- Retain a stated hypoglycemic-protocol action. A glucagon rescue clause uses the site-specified `1ML GLUCAGON IM`; record this normalization for technician review. IM stays with glucagon, not the insulin scale.
- Retain a recheck interval, conditional follow-up, and any distinct clinical action. Shorten known wording rather than guessing a missing dose or silently deleting an unresolved instruction.
- A separately supplied fixed insulin dose remains distinct from correction doses; preserve its schedule and hold qualifier. Never fold it into every glucose band.

## Shared character budget and concessions

Entered SIG parts share one 199-character budget. A read-only unified preview is not counted a second time. Because adding punctuation makes a typed code longer while preventing its expansion, the operative budget is estimated expanded text, with typed length shown separately. The estimate uses the bundled code reference and the technician's CBS/SS meanings; the actual site dictionary/Framework Preview Sig remains the authority.

Apply these steps in order, stopping as soon as the whole group fits:

1. Remove unnecessary spacing; keep essential word boundaries.
2. Remove the diagnosis/indication, retaining doses, conditions, timing and actions.
3. Replace standalone SS with literal `S.S.` to prevent expansion.
4. Replace standalone CBS with literal `C.B.S.` to prevent expansion.

Report applied concessions. If the best effort still exceeds 199, retain the best translated draft and show a prominent editable-over-budget notice. Length alone does not add a new approval gate or silently truncate instructions.

## Required regression evidence

Use synthetic variations of the technician's example: prose ranges, IF/THEN, reading-is thresholds, a late low-glucose clause, provider aliases/typos, a fixed additional dose, meal/bedtime timing and a no-food hold. Cover low-clause permutations, glucagon/protocol/call combinations, recheck follow-up scope, missing bands, ambiguity, each concession boundary and combined part budgets. Treatment behavior and existing technician edits remain covered by the full suite.
