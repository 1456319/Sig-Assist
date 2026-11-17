# Recovered Lovable translation QA

Baseline: prototype commit 6fed8ca. This report and corpus describe the released v0.1.8 baseline, not the unfinished local improvements. Lab timing figures were not independently rerun after the execution workspace became unavailable. Code meaning must be checked against the bundled reference; the report marks several such interpretations as hypotheses. Raw passthrough can satisfy a source-fact check without counting as successful translation.

# Sig-Assist functional translation QA — handoff (baseline `6fed8ca`)

Independent, read-only lab. Source: public tarball of `1456319/Sig-Assist@6fed8ca`, in a scratch folder only. The pharmacy repo was not edited, pushed, or published. All inputs are synthetic and contain no PHI.
Lab files are in `sig-qa-lab/`:
- `corpus.ts` — 12 cases, each with source facts and a list of things that must not be invented.
- `run-corpus.ts` and `perf-adversarial.ts` — the two runners.
- `baseline-6fed8ca-*.json/tsv` — measured output.

Run: `SIG=<snapshot dir> bun sig-qa-lab/run-corpus.ts`

**Method.** Each case checks whether source facts were *preserved or surfaced*, never an exact output string. Snapshots would bake today's bugs into the tests. The 12 cases are 12 distinct grammar shapes, not permutations of one sentence.
Caveat: a fact counts as "covered" even when the engine just passes the raw prose through. The `incomplete_sliding_scale` flag tells you which cases did that. Code-meaning claims marked **(H)** are hypotheses.

## Headline: why treatments and scales rarely translate
1. **The scale grammar is all-or-nothing.** `parseSlidingScale` (`clinical/slidingScale.ts`) calls `fail()` on the first thing it doesn't support. The whole order then falls back to raw uppercase prose. This happened for 5 of the 6 scale shapes:
   - S02: `mg/dL` after each range. The `body` "rest" check rejects `MG/DL`, and the `/\d\s*MG\b/` volume/mass guard also fires on `200 MG/DL`.
   - S03: postfix comparators (`300 OR GREATER`, `LESS THAN 70` + `HOLD AND FOLLOW…`).
   - S04: a fixed dose plus a scale. Rejected on purpose (L57, "fixed dose precedes the scale").
   - S05: a `RECHECK BS IN 2 HOURS` action.
   - S06: two schedules with different scales.
   Each fallback is safe but yields no useful draft. The desired behaviour is a **technician-confirmed partial draft**: the bands that did parse, plus an exact unparsed span list.
2. **Treatments are matched against one fixed clause template** (`treatmentOrderEngine.ts`). Clauses that don't fit the template are dropped (see T02).

## High-severity regressions (silent loss or invention)
| ID | Engine | Input shape | Observed | Expected |
|---|---|---|---|---|
| S01 | clinical | `Inject per scale …: 150-200 = 2 units …, >300 call MD` (literal "scale", no "sliding") | `INJ SQ TIDAC. CALL MD`. **Every dose band is lost.** No `incomplete_sliding_scale` flag, and TIDAC is asserted. | The scale trigger should also fire on `PER SCALE`, `CORRECTION SCALE`, or "≥2 range=dose pairs", and fall back or draft partially when it does. |
| S01 | classic | same | `INJ 2 UN AC`. **The first band's dose becomes a fixed dose.** | Never emit a band dose as a fixed dose. |
| T01 | clinical | cleanse/apply/cover with **no frequency** | Ends in `… COVER W/FOAM DRESSING QS`. Every-shift is **invented**: `treatmentOrderEngine.ts` L295 `routineFreq \|\| (hasPrn ? 'PRN' : 'QS')`. | Leave the frequency empty and add an `uncorrected_gap` "frequency not stated" finding. |
| T02 | clinical | `… daily for 14 days. Notify MD if signs of infection` | `… COVER W/DRY GAUZE QD`. **The 14-day duration and the notification are dropped, with no finding raised.** | Keep the duration token and append the supplemental instruction, or flag it. (Classic did keep `X14D`.) |
| F01 | clinical | `every Monday and Thursday. Hold if SBP less than 100` | `1T PO QDDAY14 SBP100`. **(H)** `QDDAY14` may be the code for Mon/Thu. But `SBP100` drops the comparator `<`, so the direction is ambiguous. | Keep the comparator (e.g. `HOLD SBP<100`), or confirm in `sigCodeReference.ts` that `SBP100` means "<100". |
| P01 | both | Drug is a pen, prose says `APPLY 0.25 mg subcutaneously` | Clinical: `APPLY 0.25 MG SQ …` plus a partial flag (acceptable). Classic: `INJ 0.188ML (0.25MG) SQ`, **with weekly/Sunday dropped**. | A product route of injection overrides "apply". The frequency must never be dropped silently. |

Lower: T04 indication renders as `FRD OR FOR MOISTURE`. That is a mixed code and literal, and **(H)** FRD is probably "for redness". T03 weekday treatment got a correct partial draft. That is the model to follow.

## Classic `sigEngine` vs `clinicalEngine`
- **Trigger.** Classic only enters scale mode on `/sliding[\s-]+scale/`. Otherwise `parseDose` takes the first `N units` it sees (S01). Clinical routes through `resolveFrequencyAndSchedule`, and a scale without "sliding" goes down the generic dose path.
- **Failure mode.**
  - Classic keeps partial structured fields (dose, route, frequency) and records missing ones as `issues` (warning or blocking). It drops what it can't see: frequency in P01, the procedure in T01.
  - Clinical either renders a full code string or falls back to the raw prose and adds an abnormality.
  - Neither one gives a span-level account of which source text was consumed.
- **Units.** Classic does mg↔mL math from the drug name (P01: 0.188 mL). Clinical keeps the stated mass.
- **Duration.** Classic keeps `X14D` (T02). Clinical's treatment path loses it.
- Recommendation: put one shared **source-span coverage** check on both engines. Every non-filler token span must be either consumed by a field or listed as unparsed. A translation with unconsumed, clinically meaningful spans must not be presented as complete.

## Regex efficiency (measured, not guessed)
Inputs of 1k, 4k, and 16k characters across 7 adversarial generators; full results in `baseline-6fed8ca-perf.tsv`. Only two cases grow quadratically:
1. **Long whitespace runs → `paxitEngine.evaluatePaxitPackaging`**: 25 ms at 4k, 378 ms at 16k. The whole clinical translation took 446 ms at 16k.
   **(H)** The likely cause is the `titrationRegex` (`paxitEngine.ts` around L192). It has adjacent optional `\s*` groups (`\s*(?:(?:BY\s*MOUTH|PO)\s*)?(?:\s*(…`). The clinical path does not collapse whitespace before this runs.
2. **Long digit runs → classic `parseDose`**: 383 ms at 16k for the regex alone. The pattern is unanchored, and `(\d+(?:\.\d+)?|\d+\/\d+)\s*(unit…)` rescans the whole run from every starting position.
Everything else stayed under 3 ms at 16k, including the notify chains with nested `conditionList`. Realistic sigs (<500 chars) are not affected, so this is robustness work, not a hot path.

Minimal fixes:
- Cap the prose length at the engine entry (e.g. 4 kB → manual review).
- Run `.replace(/\s+/g,' ')` before paxit.
- In `parseDose`, put `(?<!\d)` before the number and bound it to `\d{1,6}`.
Longer term: tokenize once into `{kind, text, start, end}` (number, unit, comparator, range, keyword, punct). Run the grammar over tokens, so cost is bounded at O(tokens), and source-span coverage falls out for free.

## Suggested acceptance criteria for the new treatment/scale grammar
- S01–S06: every range=dose pair shows up either in `bands` or in an explicit unparsed-span list. No band dose ever becomes a fixed dose.
- S04/S06: a fixed dose plus a scale, or multiple schedules, gives 2 sub-orders (or 1 draft plus a review flag), never one merged scale.
- `mg/dL` and postfix comparators (`OR GREATER`, `OR LESS`, `AND ABOVE`) parse as conditions.
- `RECHECK…` and `NOTIFY…` are kept as band actions or supplemental text.
- T01: no frequency token, plus a gap finding. T02: duration and notification are kept.
- The product route (pen or injection) wins over the verb "apply". The hold comparator is kept.
- A partial draft has to be confirmed by a technician, with the unconsumed spans highlighted. All-or-nothing fallback stays only for unit/volume conflicts and reversed ranges.

## Why 1030 passing tests miss these
The existing suites mostly check fixed outputs for shapes already supported, plus fallback for rejected ones. A fallback counts as a "pass", but it never checks that every source fact made it through. Add the fact-coverage assertions from `corpus.ts` as a separate suite. Keep them failing (`it.fails`, or a report) until they're fixed, rather than snapshotting today's output.


## Recovered synthetic corpus

Reference material, not installed application code or a passed test suite.

```typescript
// Synthetic, PHI-free sig corpus for functional translation QA (baseline Sig-Assist 6fed8ca).
// Each case lists SOURCE FACTS that a translation must either preserve in its output
// or surface for technician review. They are not snapshots of current engine output.
// "mustNotInvent" lists tokens that must never appear unless the source supports them.
export type Fact = { id: string; desc: string; any: RegExp[] };
export type SigCase = {
  id: string; family: "scale" | "treatment" | "frequency" | "product";
  drug: string; prose: string; facts: Fact[]; mustNotInvent?: RegExp[];
  note: string; // why this is a realistic, distinct shape (not a permutation)
};
const f = (id: string, desc: string, ...any: RegExp[]): Fact => ({ id, desc, any });

export const corpus: SigCase[] = [
  { id: "S01", family: "scale", drug: "INSULIN LISPRO 100 UNIT/ML", note: "literal 'scale' without 'sliding'",
    prose: "Inject per scale before meals: 150-200 = 2 units, 201-250 = 4 units, 251-300 = 6 units, >300 call MD",
    facts: [f("b1","150-200→2U",/150-200=2U/), f("b3","251-300→6U",/251-300=6U/), f("call",">300 call MD",/>300=CALL MD|CALL MD/), f("ac","before meals",/\bAC\b|BEFORE MEALS/)] },
  { id: "S02", family: "scale", drug: "INSULIN ASPART 100 UNIT/ML", note: "mg/dL units after each range",
    prose: "Sliding scale subcutaneously three times a day: 151-200 mg/dL 2 units; 201-250 mg/dL 4 units; 251-300 mg/dL 6 units",
    facts: [f("b1","151-200→2U",/151-200=2U/), f("b3","251-300→6U",/251-300=6U/), f("tid","TID",/\bTID\b|THREE TIMES/)] },
  { id: "S03", family: "scale", drug: "INSULIN REGULAR 100 UNIT/ML", note: "postfix comparators ('300 or greater', 'less than 70')",
    prose: "Sliding scale SQ before meals: BG less than 70 hold and follow hypoglycemia protocol; 200-249 give 3 units; 250-299 give 5 units; 300 or greater give 7 units and notify provider",
    facts: [f("low","<70 hold/protocol",/<70=.*(HOLD|HYPOGLYC)/), f("b1","200-249→3U",/200-249=3U/), f("hi","300+ →7U & notify",/300\+=7U.*CALL PROVIDER|>=300.*7U/)] },
  { id: "S04", family: "scale", drug: "INSULIN GLARGINE 100 UNIT/ML", note: "fixed basal dose plus correction scale",
    prose: "Inject 10 units subcutaneously at bedtime. Plus sliding scale before meals: 201-250 = 2 units, 251-300 = 4 units",
    facts: [f("fixed","10U QHS kept",/10U?\b.*(QHS|BEDTIME)/), f("b1","201-250→2U",/201-250=2U/)], mustNotInvent: [/\b10U?\s*(AC|BEFORE MEALS)/] },
  { id: "S05", family: "scale", drug: "INSULIN LISPRO 100 UNIT/ML", note: "recheck instruction inside band",
    prose: "Sliding scale before meals and at bedtime: 251-300 give 4 units, 301-350 give 6 units, >350 give 8 units and recheck BS in 2 hours",
    facts: [f("b1","251-300→4U",/251-300=4U/), f("recheck","recheck in 2h",/RECHECK/), f("achs","ACHS",/ACHS|BEFORE MEALS AND AT BEDTIME/)] },
  { id: "S06", family: "scale", drug: "INSULIN ASPART 100 UNIT/ML", note: "two schedules with different scales",
    prose: "Sliding scale with meals: 150-200 = 1 unit, 201-250 = 2 units. At bedtime: 201-250 = 1 unit, >250 = 2 units",
    facts: [f("meal","meal scale 150-200→1U",/150-200=1U/), f("hs","bedtime scale kept separately",/BEDTIME|QHS/), f("hs2","HS >250→2U",/>250=2U/)],
    mustNotInvent: [/201-250=1U&2U|201-250=2U.*201-250=1U.*AC/] },
  { id: "T01", family: "treatment", drug: "SILVER SULFADIAZINE 1% CREAM", note: "no frequency stated — must not invent QS",
    prose: "Cleanse wound to sacrum with normal saline, pat dry, apply thin layer and cover with foam dressing",
    facts: [f("site","sacrum",/SACRUM/), f("cleanser","saline",/SALINE|\bNS\b/), f("cover","foam dressing",/FOAM/)], mustNotInvent: [/\bQS\b/, /\bEVERY SHIFT\b/] },
  { id: "T02", family: "treatment", drug: "SANTYL 250 UNIT/GM OINTMENT", note: "ordered clauses + duration + notification",
    prose: "Cleanse left heel with wound cleanser, apply nickel-thick layer to wound bed, cover with dry gauze daily for 14 days. Notify MD if signs of infection",
    facts: [f("site","LT heel",/LT HEEL|LEFT HEEL/), f("freq","daily",/\bQD\b|DAILY/), f("dur","14 days",/14\s*(DAYS|D)\b|X14D/), f("notify","notify MD infection",/NOTIFY MD|CALL MD|INFECTION/)] },
  { id: "T03", family: "treatment", drug: "ZINC OXIDE 20% OINTMENT", note: "weekday schedule",
    prose: "Apply to buttocks topically every Monday, Wednesday and Friday after bath",
    facts: [f("site","buttocks",/BUTTOCKS/), f("days","M/W/F",/MON|M\/W\/F|MWF/), f("after","after bath",/BATH/)], mustNotInvent: [/\bQS\b/, /\bQD\b/] },
  { id: "T04", family: "treatment", drug: "NYSTATIN 100000 UNIT/GM POWDER", note: "PRN with condition",
    prose: "Apply topically to groin folds twice daily as needed for redness or moisture",
    facts: [f("site","groin",/GROIN/), f("bid","BID",/\bBID\b/), f("prn","PRN",/PRN|AS NEEDED/), f("cond","redness/moisture",/REDNESS|MOISTURE/)] },
  { id: "F01", family: "frequency", drug: "LISINOPRIL 10 MG TABLET", note: "hold parameter + weekday",
    prose: "Take 1 tablet by mouth every Monday and Thursday. Hold if SBP less than 100",
    facts: [f("days","Mon/Thu",/MON|THU/), f("hold","hold SBP<100",/HOLD.*(SBP|100)|SBP\s*<\s*100/)], mustNotInvent: [/\bQD\b/] },
  { id: "P01", family: "product", drug: "SEMAGLUTIDE 2 MG/1.5 ML PEN", note: "product says APPLY but it is an injection",
    prose: "Apply 0.25 mg subcutaneously once weekly on Sunday",
    facts: [f("route","SQ",/\bSQ\b|SUBCUT/), f("dose","0.25 mg",/0\.25\s*MG/), f("wk","weekly Sunday",/SUN|WEEKLY|QWK/)], mustNotInvent: [/\bTPCL\b|TOPICAL/] },
];

```
