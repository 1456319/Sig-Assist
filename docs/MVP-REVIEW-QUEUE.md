# Local review MVP — September 18, 2026

This change implements the **manual PON → review → clipboard** portion of the
handoff. It is a local prototype for evaluation with synthetic/de-identified
examples, not a validated clinical system or live Iguana integration.

## Run and try it

Use Node.js 22.12 or newer (the test runner's dependency requires it).

```sh
npm ci
npm run dev
```

No environment variables are needed for local review. Open the localhost URL
printed by Vite. In **Order Queue**, select **Fill synthetic example**, then
**Add to review queue**. Compare the unchanged original directions with the
draft; edit the final SIG, check the review acknowledgement, then copy it.
The sample's expected draft is `1T PO BID X7D`.

The queue uses the manually entered facility/source, patient reference and PON
together. PON alone is not assumed globally unique. No Rx number or HL7 field
is silently relabeled as PON. These identifiers must be matched to Framework
by the technician.

- Re-entering exactly the same source leaves the existing review intact.
- Different directions under an existing identity require **Revise source**.
  Saving a revision preserves previous source text and clears corrections,
  approval and copy status. Starting a source edit also clears approval.
- Editing final output or changing exclusions invalidates approval. Undoing an
  exclusion still requires fresh review; old approval does not revive.
- Cancelled orders cannot be copied or revised.
- **Never use this SIG** excludes the entire final SIG. **Session exclusions**
  also accepts an individual code. Both actions are reversible and do not
  silently replace a code or remove a clinical instruction.
- The queue and workbench use the same review and clipboard policy. Copy is an
  explicit action and final output is uppercase. Automatic copying of flagged
  output has been removed. The workbench computes against current input, so
  there is no debounce interval in which an old SIG remains eligible to copy.

## Data lifetime and scope

Queue orders, revisions, corrections, review state and exclusions live only in
React memory for the current tab. Navigation preserves queue records; reload,
closing the tab or **Clear orders** removes them. Clear orders keeps the session
exclusions until undone or reloaded. No orders are sent to Supabase, stored in
localStorage/sessionStorage, or included in public diagnostic fixtures.
Clipboard contents are managed by the operating system and are not cleared by
clearing the queue.

This temporary scope deliberately leaves personal/facility/shared preference
policy and patient-data retention undecided. It does not provide durable
ingestion, restart recovery, user authentication or a production audit log.

## Dictionary and parser limitations

The queue uses the existing free-text engine. Its generated codes are not
validated against the site's current dictionary, and it does not consume
shared expansion/tech rules. The workbench retains its existing dictionary
facilities when Supabase is configured, but free-text transformation still
uses the structured engine. This change unifies **review, exclusions and final
copy**, not all transformation rules or obsolete-code substitutions.

The engine can omit unrecognized clauses, routes, special schedules, tapers,
or split regimens. The UI labels all output as a draft and requires comparison
with the original. A review checkbox is not clinical validation. Test approved
examples and Framework Preview Sig, including quantity, days' supply,
administration times and structured directions, before operational use.

A frequency bug was fixed: normalized `twice daily` was `2 daily`, which could
match the generic `daily` rule and become QD. Specific BID/TID/QID and interval
patterns now precede daily, with regression coverage. A second fix prevents
`for 7 days` from being emitted again as an indication while preserving real
indications before or after durations.

Raw HL7 mode remains a diagnostic view. Candidate RXO-6/RXE-7 extraction handles
CR, LF and CRLF, rejects multiple candidates/orders, and reports the profile
as unverified. It never uses ORC-7 or an entire unknown message as directions.
Copy is disabled for unverified HL7. Use manually verified original text in
the queue/free-text view until the actual incoming profile is established.

Optional shared dictionary configuration uses `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Without them, dictionary reads are empty and writes
report that the service is unconfigured; startup no longer crashes. No schema,
RLS policy or remote database was changed. Existing permissive policies in
`ISSUES.md` still need a separate authentication/authorization fix.

## Corrected HAR findings

The September 18 handoff's corrected capture was examined locally without
executing embedded JavaScript. No capture content, credentials, patient data,
order identifiers or vendor payloads were added to this change.

- The capture has 1,969 HTTP entries, including 281 `/log_entries` responses
  and 13 `/log_view_entry` responses. The latter contain 12 queue-commit status
  messages and one acknowledgement rather than a complete incoming order.
- Log-list responses contain JavaScript `addRow`/`addRowReverse` records and
  shortened message previews. They include multiple channels: the capture
  must be scoped by each record's channel, not just the visited page URL.
- Scoping those records to the selected inbound channel yields 31 distinct HL7 previews:
  27 `DFT^P11^DFT_P11` and 4 `ZPS`. Their headers name a **PAXITHL7** application as
  sender and **FrameworkLTC** as receiver. This corrects any blanket assertion
  that the newly supplied channel is outbound.
- The DFT previews end at ORC within the first five segments; they do not expose
  original nurse directions or a validated PON relationship. Other channels'
  Framework-originating RDE previews do not establish this channel's mapping.

These observations establish inbound traffic, **not** that the channel is the
required pre-entry medication-order feed. They do not justify an automatic
collector or guessed field mapping. Browser log polling is not a validated
durable ingestion interface.

## Remaining integration work

1. Inspect one complete de-identified incoming medication order paired with
   its PON in Framework; identify original nurse directions, source/facility,
   patient context, timestamps, revisions and cancellation relationships.
2. Establish the supported LAN feed/export and implement a profile-specific
   adapter with duplicate handling, ordering and resumable ingestion.
3. Validate the parser against technician-approved outputs and the current
   site's dictionary/Framework behavior; preserve unsupported instructions.
4. Agree preference scope and retention before adding durable storage.
5. Investigate active-order following/direct field insertion separately in the
   real workstation session. Clipboard review does not depend on it.

## Verification

- Existing baseline: 32 tests and typecheck passed before edits.
- Updated suite: 56 tests, including queue lifecycle, source preservation,
  composite identities, exclusions/undo, approval invalidation, clipboard
  eligibility, HL7 uncertainty and daily-frequency regressions.
- `npm run typecheck` and `npm run build` pass.
- ESLint passes for the new/modified review and parser files. Repository-wide
  lint retains five pre-existing errors in DictionaryView, UI components and
  use-toast; they are outside this change.

Browser verification passed using a local Chromium instance and synthetic
inputs: credential-free startup, uppercase corrections, review gating, actual
clipboard contents, whole-SIG exclusion/undo, source revision invalidation,
code exclusions shared with Workbench, queue survival across navigation,
cancellation, and clearing on reload. No browser page errors were recorded.
The cloud browser could not access localhost; the agent-browser daemon also
failed to start, so verification used the installed Playwright runtime with
an official Chrome for Testing binary instead.
