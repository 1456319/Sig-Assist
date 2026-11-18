# Lovable functionality audit — November 18, 2026

Status: complete. All external responses were reviewed, selected fixes were integrated and the final runtime passed local and Windows/Linux validation. No audit job remains pending. Root owns pharmacy Git writes. Earlier audit results were reviewed, not discarded; verified repairs remain in prototype. New independent reviews use the same existing lab threads in Max mode.

Baseline sent: `11fa35b767cf221cefc81837486ee47f602a1c34` (runtime `45ecfa4`), v0.1.11 build `3f5d71dba6b8`. All three labs were explicitly told that their old checkout is obsolete and supplied the completed-audit and dataset handoffs. Requests use public code and synthetic examples only; no patient text, captures, Drive documents or credentials.

| Lab | Account selector | Project | New user message | State |
|---|---|---|---|---|
| clinical | link_6a6e0563fc9881918dd6ac2cf7b6bcc0 | 766dd189-ff18-4f49-b2d7-f97e8726f577 | umsg_01m7q9vkg6ekpt6khzptngpp9j | reviewed; candidate decisions below |
| engineering | link_6af9b0f8e2e481919a094b9a969aab3e | 22a38ec9-2439-4854-a171-b32ba96dd019 | umsg_01m7q9vv3cfv19t0gs1kpt9wms | reviewed; candidate decisions below |
| qa | link_6af9aee8f8f08191bbe5f2f684b3ce59 | f6775d54-18d5-4a10-8619-e419ba04dea2 | umsg_01m7q9vwq1eaa8dpwe6h5grxer | reviewed; candidate decisions below |

Thread for each: `main`. Poll the existing message using get_message; never duplicate a slow request. A top-level accepted/running user-message status is not completion: inspect the agent response status and any awaiting-input/error. No autonomous recurring credit-spending task was created.

## Prior findings rechecked

The completed disposition is in [the November 17 handoff](../../FINAL-AUDIT-HANDOFF-2026-11-17.md); raw reports/candidates remain in the adjacent final-audit-2026-11-17 folder. They are evidence, not patches to reapply. On today's baseline, 105 targeted regressions across eight files pass, covering monitoring clauses, treatment phases, half-scale scope, comma/route boundaries, AC/HS, dictionary races, exact PON retry/matching counts and named meals.

Previously unverified native backoff/traversal hypotheses and shared dictionary retry/delete/rename concerns remain investigations, not established repairs. The new passive dataset reader, nonblocking exact-PON enrichment, clipped-provider rejection, durable exports and default-template validation were developed after the previous lab contact and passed Windows/Linux integration.

## Current scopes

- Clinical: realistic treatment/scale residuals; fixed basal plus independently scheduled correction scale; source/qualifier retention; both entry points; useful partial progress; named-meal and repeated-route wording.
- Engineering: finish passive current-PON/SIG and observer investigation against the actual new implementation; cancellation/ownership/backoff/throughput and provider boundaries; runnable Windows evidence for native claims.
- QA: collection/confirmation/export durability and pairing, retries/reload/dedup/context, technician feedback and remaining dictionary synchronization behavior.

Prioritize 1–3 reproduced high-value functionality issues per lab, exact current/expected behavior, a minimal candidate, baseline-failing/fix-passing meaningful tests and limitations. No new security/approval architecture, production schema changes, speculative rewrite, deployment or purchases. FWDirect remains excluded; controlled orders are observation/identification only.

The requested lab output is `docs/FUNCTIONAL-AUDIT-2026-11-18.md` with optional `audit-2026-11-18/` candidates. Review and transplant selectively, test locally, rebuild ready-to-run downloads and commit each coherent runtime increment. Preserve reports and record accepted/rejected/deferred decisions here before completion.


## Reviewed decisions and integration

All three original requests returned. Clinical and Engineering reported exhausting their available credits. QA completed its requested scope; its remaining balance was not measured. Engineering’s short checkpoint is preserved separately from its fuller final response; its unverified native claims were not treated as passing Windows tests.

Raw lab reports and candidate patches are preserved here before integration (evidence checkpoint `1b6e6f1`). The executable tests and final implementations live under the normal application paths, not in these candidate artifacts. Unrelated lab compiler-flag relaxations were rejected.

| Finding | Coordinator disposition |
|---|---|
| TIMES DAILY read as QD | Implemented BID/TID/QID grammar repair, including scale schedules. |
| Leading scale HOLD assigned to prior dose band | Implemented candidate’s qualified leading-action carry; exact low-band/dose assertions retained. |
| Classic loses later doses, monitoring or prohibitions | Implemented retained later clauses, then corrected the candidate to scope route, duration, indication and holds to the primary clause. New tests reject borrowing a later route or course. |
| Differing dose with repeated by-mouth/PO/orally or second administration verb | Coordinator reproduced dose loss; extended existing Paxit grammar. Classic’s single-dose schema retains an unrepresentable whole regimen with review feedback. A lightweight keyword guard preserves long-digit performance. |
| Split confirmation loses actual edits / mixes comments or rating | Implemented independent part responses and selected-part suggested-text provenance in Queue/Workbench and verified transfers. |
| Delayed source lookup after same-PON collision appears | Implemented live Queue/source-stamp rechecks before caching and pairing. Unpaired observations remain available. |
| Generic dictionary success after rejected shared save | Implemented device-only, shared-unconfirmed and shared-acknowledged feedback. Existing edit/save retries retain identity. |
| Repeated passive helper launches after timeout | Implemented shared 10/20/40/60-second backoff, distinct statuses and selection-change recovery. Technician operations bypass backoff. |
| Dataset poll conflicts with recorder | Implemented waiting behind bounded recorder reads while preserving technician priority. |
| Native frozen-window hint | Implemented with process/handle ownership validation and optional-API fallback. Coordinator added an actual Windows fixture freeze and recovery; focused run 44306754326 passed. |
| Routine course THEN PRN collapses into concurrent PRN | Coordinator reproduced three failures plus a passing control, then retained the later PRN phase separately without moving the initial course duration. 69 targeted temporal/boundary regressions pass. |

The baseline regression replay reproduced four Engineering failures plus its passing priority control; the first Clinical/QA/repeated-route replay had 15 failures and five controls before repairs. The original full local integration passed **1,314 tests in 86 files**, lint/typecheck, the 388-code reference and current package checks. Source, page, manifest and ZIP were checkpointed together as **v0.1.12** at `fe0281c`. After the subsequent THEN-PRN repair, the full local suite passes **1,318 tests in 87 files**, with lint/typecheck and package freshness verified again. The current build is `238629a7024c`.

### One focused QA integration follow-up

The existing QA thread was informed that the candidates were implemented and given exact source `fe0281cc3ea037035e840b498677ebbd6230c8f0`, including the coordinator’s clause-scope/performance improvements. Accepted message: `umsg_01m7qb04x5es7rfabq6h9ka957`, thread `main`, same QA project/account above. Completed and reviewed; do not resend. It was asked for only a concrete functional integration regression or a bounded source-lookup retry, within remaining daily credits and without purchases.

### Deferred or unverified

- Do not automatically replay all dictionary pending IDs: legacy merge-protection rows and explicit new writes share that marker. Automatic replay could overwrite a colleague’s update. This increment reports local/shared status and preserves a deliberate manual retry instead; no shared delete or rename-schema proof was invented.
- Separate basal-dose-plus-scale partial rendering remains a future component-rendering change; current complete source and review finding remain intact.
- Native offscreen-wrapper/accessibility-view/label-read hypotheses need a runnable fixture and actual installation evidence. No speculative field associations were added.
- Real Framework bindings still need the short dummy workstation check. Polling and observed text do not prove Rx save or complete per-order capture.
- Shared backoff, dataset capture and cache primitives must remain if temporary diagnostic recording is later removed; intensified-logging removal markers stay active.

## Final independent QA integration findings

The follow-up used exact source `fe0281c`; its complete report and two candidates are retained as `qa-integration-*` artifacts here. Its new nine checks reproduced five baseline failures and four controls in the coordinator checkout as well. No additional split-confirmation or helper-scheduling defect was demonstrated.

- Preserved an immediately preceding THEN with a classic later-dose clause; recognized numeric later injections without assigning bedtime to the earlier morning dose.
- Retained unsupported HOLD instructions. The coordinator strengthened the candidate: classic HOLD is a scoped action, and only an exact, unqualified known dual-threshold clause uses the compact token. A bedtime-qualified hold retains its own time; an extra condition is not silently treated as the known compact form.
- Added regressions for the reported inline “daily and not at bedtime” error in both entry points. The excluded time stays a negative supplemental instruction rather than becoming the dose schedule. This is scoped phrase handling, not a general negation grammar claim.
- Added one bounded source-enrichment retry after a thrown lookup, due after 30 seconds and driven by normal polling even when the field is unchanged. Ordinary misses are not retried; a second rejection stops automatic attempts. Live PON collision checks still apply. A durable enriched record updates the status without claiming prescription completion.
- Rejected no compiler settings or test coverage to obtain a pass. Raw artifact patches remain proposals, not the installed implementation; coordinator changes above are in normal source/tests.

All three original lab responses and the independent QA follow-up are now handled. No external audit request or recurring credit-spending task remains pending. Engineering’s static candidates and component-rendering follow-ups remain explicitly deferred above; no installation-level coverage is inferred.

### Final local validation

**v0.1.12, build `eaa14600b431`**: **1,330 tests in 89 files passed**, including real local nested-Git publication tests, bounded 10,000-row storage, prior and new clinical/feedback regressions, long-input controls, collision/retry tests and passive scheduling. Full lint/typecheck and package/archive freshness passed. Earlier `fe0281c` passed complete Windows/Linux matrix run [44306754234](https://github.com/1456319/Sig-Assist/actions/runs/44306754234) and focused frozen-window run [44306754326](https://github.com/1456319/Sig-Assist/actions/runs/44306754326). Native source is unchanged since that passing run. The final runtime at **`ab6adfdd45925365b237ac09c9d42c703e517478`** passed the complete Windows/Linux matrix and prototype publication in [run 44309040845](https://github.com/1456319/Sig-Assist/actions/runs/44309040845). This includes native DocuTrack/Framework fixtures, frozen-window recovery, Node/bootstrap, PowerShell/UNC launchers, Edge localhost/direct-file clipboard workflows, Iguana import/bridge, pilot/discrepancy persistence and archive/source verification. The ready-to-run page, manifest and ZIP are committed with that source.

## Completion and next work

All four Lovable requests are complete as agent turns, and every returned report/candidate has been reviewed. Engineering’s explicitly incomplete static research is preserved as such, rather than claimed finished. There are no pending external questions or scheduled audit checks. No private clinical export was supplied to Lovable.

A diagnostic export supplied during final validation was reviewed locally afterward. See [the aggregate diagnostic triage](DIAGNOSTIC-TRIAGE.md): it contains trace outputs, not discrepancy source/correction pairs. Two retained-output scale replays still need manual review in the current build; this audit does not claim all sliding-scale grammar solved. Next obtain **Export discrepancy cases** (and archived reports if applicable), preserve the original/corrected pair, and prioritize independently scoped basal/correction components and malformed threshold spans. The actual workstation binding check remains separate from synthetic Windows validation.

Keep incremental source and package commits on prototype. Preserve original user exclusions, local dictionary work and temporary logging removal markers. No FWDirect or controlled-order automation was added; no purchase, schema deployment or external clinical-data upload was performed.
