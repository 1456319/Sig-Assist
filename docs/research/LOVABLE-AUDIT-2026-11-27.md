# Functionality audit — November 27, 2026

Status: in progress. Authoritative fetched prototype baseline is
`1a0105c435da70bb5bb45dd20200e3dca189527e`, v0.1.16, build `1ba9dbed1a9b`.
The morning handoff, session-2 review, November 18 README, November 24
implementation review and recent messages in all three existing labs were read.
Earlier lab plans are already integrated; they are not patches to reapply.

## Resumed external reviews

All requests use the existing `main` threads with Max mode enabled. Each was
told to inspect pinned current public source in a fresh scratch checkout,
distinguish executed tests from static claims, and use only synthetic evidence.
No private recording, screenshot, clinical log/export, identifier, Drive link,
credential or workstation path was shared. No purchase or upgrade is authorized.

| Lab | Project | User message | Focus |
| --- | --- | --- | --- |
| Clinical | `766dd189-ff18-4f49-b2d7-f97e8726f577` | `umsg_01m8efjdejf0kb5a12vspaa8nt` | Scale/treatment qualifiers, useful drafts, regression/performance |
| Engineering | `22a38ec9-2439-4854-a171-b32ba96dd019` | `umsg_01m8efjbg8es9tt59h9xjybmjw` | Actual provider/event compatibility and bounded entry points |
| QA | `f6775d54-18d5-4a10-8619-e419ba04dea2` | `umsg_01m8efjffcevvtjgwbfavj1qcc` | Optional rating/report durability and dataset provenance |

At this checkpoint requests are accepted/running, not completed audits.
Workspace profiles expose Max mode but not remaining balances; acceptance is
not a claim of measured available credits. Poll these exact requests; do not
duplicate a slow audit. Account selectors remain in the November 18 README.

## Evidence update

Two subsequent private discrepancy-case exports were read and compared. Both
contain the same seven reports across v0.1.13/v0.1.15, including original and
generated SIGs, technician corrections/comments, saved policies and feedback
histories where applicable. They supply the context missing from the recording
alone. They are not included here or supplied to external labs. Do not treat
seven reports as seven additional session-2 failures or infer successful native
capture from these separately exported browser reports.

## Required completion

Independently reproduce supported findings, checkpoint coherent repairs with
matching page/BUILD/ZIP, verify remote preservation and CI, and record decisions
and remaining workstation checks here. FWDirect remains excluded. Retain
technician review and temporary intensified-logging HIGH-removal markers.

## Engineering response and first repair

The engineering turn completed with `out_of_credits`. It inspected the pinned
source and reported two baseline-failing mocked observer tests, but did not run
Windows, apply a candidate or write its requested report. Root independently
reproduced both failures (9 existing controls passed) before repairing them.

- **Accepted:** a failed UIA subscription used `provider_unavailable`, causing
  JavaScript to kill the whole sidecar, including working WinEvent hooks. The
  helper now reports `uia_unavailable` when at least one Windows hook survives;
  the observer retains the listener and reports `windows_events`.
- **Accepted:** the injected subscriber wrapper treated every unknown event as
  fatal. Unknown events are now ignored, matching the actual JSONL decoder.
- **Regression:** a test-only native flag forces UIA subscription failure; the
  Windows smoke test requires a subsequent real WinEvent field change while
  the helper remains alive. JavaScript regressions verify continued capture and
  actual provider failure/reconnect behavior. Native execution is pending CI.
- **Deferred, static:** top-level owned popup Invoke coverage, Win32 invoked
  fallback, rich-editor patterns and the visible-PON miss need concrete provider
  fixtures/workstation evidence. No event is promoted to proof of a saved Rx.
  The current smoke test still does not prove Invoke-event arrival.

The initial runtime repair is v0.1.17, build `8305676344df`; local observer and
journal tests and portable package identity checks pass. Broader final checks
and external clinical/QA dispositions follow in later checkpoints.

## Clinical and QA decisions

Both turns finished and their reports/candidates are preserved in
`lovable-audit-2026-11-27/`. They used fresh pinned source and synthetic data,
but did not read every requested handoff or execute Windows. Their reported
suite counts differ; root's full checkout and CI are the validation authority.

- **Accepted treatment-course loss:** PRN reason capture swallowed a trailing
  duration, leaving the routine card without its course. Root reproduced five
  failures plus one passing numeric-reason control. Rather than adopt a new
  negative-lookahead regex, the existing course extraction now runs before PRN
  extraction, after the sequential-phase guard. Both cards retain the action's
  course; separate procedures remain scoped. Tests include days, weeks, an
  up-to limit, a reason containing a number and a PRN clause with no reason.
- **Accepted cold-reload rating loss:** root reproduced `[3]` instead of `[3,10]`
  when a low rating existed only in the durable outbox. A ten now waits for
  pending evidence to load before deciding whether it is a fresh ten that
  should create no discrepancy. Earlier evidence and the revised score survive.
- **Accepted scope clarity:** split-rating text and explanation labels name
  the actual card. Group evidence is retained; this does not claim the technician
  intended to rate a different card or require extra interactions.
- **Withheld glucagon candidate:** the lab proposes preserving non-one doses
  while treating any numeric one (MG or ML) as the site's 1ML IM template.
  That is not an independently established product/dose/volume contract, and
  changing the user's explicit rescue template requires a site decision. No
  candidate dose conversion is installed; this finding remains unresolved.
- **Rejected attribution:** the QA report conjectures that `browser_cache`
  proves an unsaved rating-outbox case. It does not: browser_cache is a report
  persistence outcome. No link to those four recorded saves is established.
- **Deferred:** classic treatment-path parity, independent basal/scale rendering,
  actual rich-editor/Invoke coverage and supported vendor service contracts.
  Preserve source drafts and uncertainty; no guessed endpoint is activated.

The event checkpoint `19a12fa7240dafb6d5eb6971389cf3f05b89c892` passed the native
Windows/packaged Edge workflow in run 45999496654, including forced UIA failure
with subsequent real WinEvent field changes. It does not establish live coverage.

## Private discrepancy replay and additional supported repair

Root downloaded the seven-case export privately and replayed its source with
each captured exclusion policy. Raw cases and replay results stay outside Git
and external labs. A combined current preview is not directly comparable to a
report's selected split-card suggestion; this is not an accuracy benchmark.
Some reports also concern formatting choices already represented by overrides.
No claim is made that all seven technician observations are resolved.

One clear qualifier-loss case was independently reproduced with a different
synthetic medication and course: `FOR UP TO 5 DAYS` became fixed `X5D` in the
clinical path; classic could also absorb the bounded course into the indication.
The shared duration resolver now retains the literal upper-bound course.
Classic stores/renders it separately from a fixed day count and indication.
Equal numeric bounded/fixed courses no longer silently collapse to one token.
Three new checks fail on baseline and pass after the repair; an exact-course
control still passes. The existing duration test that expected `FOR UP TO 10
DAYS` to lose its qualifier was corrected, not relaxed.

Remaining source-to-tablet conversion, oral-gel amount annotation, sequential
tablet-taper cards and exact part-level punctuation/policy effects merit focused
follow-up. Do not silently apply taper-specific per-card limits to insulin-scale
groups, whose shared 199-character budget remains unchanged. Two additional
synthetic wound/punctuation controls exercise the actual typed-product path;
they do not prove that every historical policy/wording variant is resolved.

## Runtime checkpoints and integration check

- `19a12fa7240dafb6d5eb6971389cf3f05b89c892`: independent event degradation.
- `d09be1cff3092459de2ad8ccc7d826fc5b22cf79`: treatment course, rating durability,
  split scope labels and preserved lab reports/candidates.
- `6ace0036f213486253460bcb2b703f3924069044`: bounded-course repair and final
  matching v0.1.17 downloads, build `3ed40918e4df`.

Every checkpoint was fetched and its changed file contents verified against the
remote branch. The final local suite passes **1,445 tests in 104 files**;
full lint, typecheck, 388-code reference and archive/source checks pass. The
working tree was aligned only after content verification. Final Windows/Linux
CI and publication are pending at this documentation checkpoint.

Clinical and QA were given the final pinned runtime for one focused independent
integration pass within any remaining credits (no purchase/upgrade). Requests:
clinical `umsg_01m8eggt59er5r5fjwfv4w592n`, QA
`umsg_01m8eggqssewyr6p32rtbmg06k`, in the same projects/threads above.
Engineering's allocation was exhausted, so no duplicate request was sent there.
Poll these requests before declaring the audit fully completed.

### Independent QA integration and adjacent root regression

QA completed its focused follow-up: 16 checks at `6ace003` passed, covering
low-to-ten reload, unchanged original evidence, split isolation, storage
recovery and idempotent retries. It withdrew its browser_cache attribution.
Its report and controls are preserved beside the first reports. Root ran the
two added controls too, correcting their cleanup to use the actual BrowserRecords
API (there is no `clear` method) and checking the edited draft explicitly.

Root then tested an adjacent case outside that lab's check: an earlier queued
3 followed by a new **8** after reload was saved as `[8,3]`, so the older score
incorrectly won. Loading only on ten was insufficient. Every queued persistence
operation now loads older durable jobs before merging; immediate in-memory
failure/correction capture is retained. Both low-to-low and low-to-ten histories
are ordered correctly; actual failed writes still remain retryable.

This next v0.1.17 package has build `ff9daa2db152` and supersedes the earlier
same-version fingerprints. The 1,446-test full local run and two extra recovery
controls pass; a final combined run and CI follow. No new clinical write action
or mandatory technician prompt was added.
