# Site sliding-scale contract — November 19, 2026

The technician supplied these rules directly. They supersede older scale-output spellings; source directions remain unchanged.

- Every insulin scale draft starts `CBS <frequency> SS`, subject to the dotted-code concessions below. SS already supplies the insulin injection/SQ instruction, so a redundant trailing SQ is omitted.
- Use `lower-upper=nU;next=...`, with no padding around comparisons, equals signs, semicolons or ampersands. Preserve source bounds, inclusivity, doses and absent bands. Do not add a low-glucose band when none was supplied.
- Framework expands whole SIG codes separated by whitespace. At most one trailing punctuation mark is allowed before the next space. Keep the numeric tiers as a single unspaced string. A join such as `U;1` or `2U;150` remains literal and counts as typed.
- Sort condition/action pairs by glucose bound, even when a low-glucose clause appears late in the directions. Conditions retain their own actions.
- CALL/NOTIFY recipient variants use `CALL MD`. Known verbose requests for further instructions are part of that notification, not a new dose.
- Retain the prescribed glucagon dose, unit, route and relationship to the protocol, including an explicit choice between the two. An unspecified dose or route requires pharmacist clarification.
- Retain a recheck interval, conditional follow-up, and any distinct clinical action. Shorten known wording rather than guessing a missing dose or silently deleting an unresolved instruction.
- A fixed insulin clause with a different schedule uses a separate editable draft. It keeps its own hold qualifiers. A fixed dose with a known schedule does not supply a missing correction schedule.

## Shared character budget and concessions

Entered SIG parts share one 199-character budget. A read-only unified preview is not counted a second time. Because adding punctuation makes a typed code longer while preventing its expansion, the operative budget is estimated expanded text, with typed length shown separately. The estimate uses the bundled code reference and the technician's CBS/SS meanings; the actual site dictionary/Framework Preview Sig remains the authority.

Apply these steps in order, stopping as soon as the whole group fits:

1. Remove unnecessary spacing; keep essential word boundaries.
2. Remove the diagnosis/indication, retaining doses, conditions, timing and actions.
3. Replace standalone SS with literal `S.S.` to prevent expansion.
4. Replace standalone CBS with literal `C.B.S.` to prevent expansion.

Report applied concessions. If the best effort still exceeds 199, retain the best translated draft and show a prominent editable-over-budget notice. Length alone does not add a new approval gate or silently truncate instructions.

## November 22 compound-order review

The Lovable review supported separate timing, explicit tiers and the existing length warning. Its proposed high-range compression and protocol substitution changed the original directions. The regression keeps the bounded `400-450` tier, the separate repeat-reading condition `>400`, the recorded follow-up instructions and the glucagon-or-protocol choice. The correction draft is ACHS and the separate fixed-dose draft is AC. An omitted middle band stays absent and displays the exact gap in a red pharmacist-clarification alert. The yellow length notice remains separate.

The automated checks exercise the clinical and classic entry points, the editable review interface and the portable build. Live Framework Preview Sig and downstream packaging acceptance still need verification on a dummy order, including the expanded timing, units and complete follow-up text.

## Required regression evidence

Use synthetic variations of the technician's example: prose ranges, IF/THEN, reading-is thresholds, a late low-glucose clause, provider aliases/typos, a fixed additional dose, meal/bedtime timing and a no-food hold. Cover low-clause permutations, glucagon/protocol/call combinations, recheck follow-up scope, missing bands, ambiguity, each concession boundary and combined part budgets. Treatment behavior and existing technician edits remain covered by the full suite.
