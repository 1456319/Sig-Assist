# Lovable functionality audit — November 18, 2026

Status: active. Root owns pharmacy Git writes. Earlier audit results were reviewed, not discarded; verified repairs remain in prototype. New independent reviews use the same existing lab threads in Max mode.

Baseline sent: `11fa35b767cf221cefc81837486ee47f602a1c34` (runtime `45ecfa4`), v0.1.11 build `3f5d71dba6b8`. All three labs were explicitly told that their old checkout is obsolete and supplied the completed-audit and dataset handoffs. Requests use public code and synthetic examples only; no patient text, captures, Drive documents or credentials.

| Lab | Account selector | Project | New user message | State |
|---|---|---|---|---|
| clinical | link_6a6e0563fc9881918dd6ac2cf7b6bcc0 | 766dd189-ff18-4f49-b2d7-f97e8726f577 | umsg_01m7q9vkg6ekpt6khzptngpp9j | accepted; review pending |
| engineering | link_6af9b0f8e2e481919a094b9a969aab3e | 22a38ec9-2439-4854-a171-b32ba96dd019 | umsg_01m7q9vv3cfv19t0gs1kpt9wms | accepted; review pending |
| qa | link_6af9aee8f8f08191bbe5f2f684b3ce59 | f6775d54-18d5-4a10-8619-e419ba04dea2 | umsg_01m7q9vwq1eaa8dpwe6h5grxer | accepted; review pending |

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

