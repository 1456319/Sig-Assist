# SIG-Assist MVP runtime audit

Reviewed 2026-09-19 against `main` at **`ba8e389169d4dc08e6e3be76eda13ee08306de3d`**.

## Verdict

**The application builds and its local manual-review prototype runs. It is not yet a working Iguana-to-FrameworkLTC companion for a technician.** There is no live collector, no automatic order matching, no packaged standard-user launch path, and no connection between the queue and the new persistence adapter. Several executable paths also produce incorrect directions or misleading review/copy status.

This is an audit-only change. It records fixes and acceptance criteria; it does not implement those fixes. No Iguana, Framework, DocuTrack, pharmacy database, or remote Supabase instance was accessed or modified. Iguana is LAN-only. Full access to an existing Iguana account would not supply the collector, mapping, or browser integration that the application currently lacks.

The prior no-writes-to-Iguana constraint remains part of the design: Sig-Assist must observe an existing source independently, with its own state outside Iguana. It must not become a forwarding/acknowledgement hop in the clinical transaction path.

### What passes now

| Check | Result and limit |
|---|---|
| Clean `npm ci --no-audit --no-fund` | Pass; 464 packages installed from the committed lockfile. |
| `npm test` | **118 tests pass in 14 files.** These do not establish full workflow or clinical correctness. |
| `npm run typecheck` | Pass; no current TypeScript compilation failure found. |
| `npm run build` | Pass; TypeScript and Vite production bundle complete. |
| Development server | Loopback startup and HTTP 200 verified, including the app entry point. |
| Optional Supabase absent | Local startup is supported. Missing Supabase credentials are not a boot blocker. |
| Component interaction probes | Six temporary probes exercised React event/state behavior and mocked clipboard/storage failures; confirmed the defects below. |
| `npm run lint` | **Fails: 21 errors, 5 warnings.** Current CI does not run lint. |

The execution environment was Linux, Node **24.19.0**, npm **11.9.0**, with no Supabase configuration. This is not a Windows standard-user/Citrix qualification. The README specifies Node 22.12+ and CI selects Node 22; that exact runtime was not exercised locally.

The cloud browser could not open localhost (`ERR_BLOCKED_BY_CLIENT`). React interactions were therefore checked with an isolated JSDOM harness, not a real browser clipboard or Citrix session. A separate attempt to bind Vite to all interfaces failed on this container's network-interface enumeration; loopback worked. Neither environment limitation is classified as a Windows application defect. Temporary harness dependencies and files are not added to the project.

### Milestone assessment

| Capability | Current state |
|---|---|
| Developer can install dependencies and start the app | Working in the tested environment. |
| Technician opens one app under ordinary user privileges | Deployment/launcher and actual session validation missing. |
| New orders appear without retyping their fields | Missing. Queue requires facility/source, patient reference, PON, and original directions. |
| Incoming XML becomes a complete, identifiable queue order | Partial extractor exists; end-to-end path missing and workbench dispatch is wrong. |
| Complete nurse directions survive translation | Not reliable; verified omissions and transformations below. |
| Reviewed copy and exclusions apply everywhere | Works substantially better in the original single-order panel; broken in split cards. |
| Order cache survives a chosen bounded lifetime | Queue is tab-memory only; persistence adapter is disconnected. |
| Preferences reduce recurring technician work | Session exclusions exist; persistent preferences are unused; dictionary/rules bypassed in normal free-text generation. |
| SIG can be pasted and previewed in Framework | Browser copy code exists; actual Citrix-to-Framework paste/preview not validated. |
| Automatically follows the selected Framework E-Rx | Missing; no verified external selection interface. |

## Evidence and repository state

- [PR #6](https://github.com/1456319/Sig-Assist/pull/6) is merged. Its later commits added the clinical engine, split cards, and storage module. The earlier Drive assessment of commit `0df7f23` cannot be treated as a description of current code.
- [PR #2](https://github.com/1456319/Sig-Assist/pull/2) and [PR #3](https://github.com/1456319/Sig-Assist/pull/3) remain open and are older alternative parser implementations. Their changed-file patches were inspected. They overlap current `parser.ts` and `WorkbenchView.tsx`; #3 introduces another `advancedParser.ts`. They are not evidence that main already has a working intake path. Reconcile their useful cases into the chosen engine rather than merging another competing execution path without regression review.
- Read the supplied [handoff folder](https://drive.google.com/drive/folders/1L0uCNKye7LfUFrgYLaRhzgbr2_AsRtjF), its start/update notes, `analysis-and-source.zip`, the corrected HAR, and the syntax-preserved de-identified XML. Reused archived installer tables, extracted manuals and managed metadata; did not execute vendor binaries or repeat the full installer extraction.
- Independently inspected the archived MessageBroker entry point and helper source. This was a targeted review, not an exhaustive audit of the approximately 6,000-file dump or all vendor assemblies.
- Framework installer metadata reports **ProductVersion 3.3.363** and `ALLUSERS=1`. This describes the vendor installer, not the permissions that a separate Sig-Assist companion must require. Do not make installing or registering these vendor payloads a prerequisite for Sig-Assist.
- Framework manual pages **141, 335–337, 966, 970** and data dictionary pages **715, 760** support the interface and SIG observations below. The retrieved .NET metadata confirms `LookupRoNoUsingPrescriberOrderNo(facilityId, patientId, prescriberOrderNo)` and message-level directions/PON properties; it does not establish a supported setter or observer for the currently selected SIG field.

All example identifiers and reproduction directions in this report are synthetic. No raw capture, patient record, credentials, internal hostnames, installer payloads, or proprietary manual extracts are committed.

## Findings

**P1** means a blocker for the intended operational MVP or a material defect in a reachable review path. **P2** means a supporting workflow/deployment defect, or a defect in code that must be fixed before that code is connected to the primary path. These priorities do not claim every issue prevents the initial page from loading.

### F01 — P1: No collector or low-effort order intake exists

**Evidence:** [OrderQueueView.tsx](src/components/OrderQueueView.tsx), lines 11–35 and 55–85; [orderQueue.ts](src/lib/orderQueue.ts), lines 31–41; [AppLayout.tsx](src/components/AppLayout.tsx).

The queue is populated only by its form or synthetic example. Facility/source, patient reference, PON and directions must be supplied manually; drug and default SIG are additional fields. There is no Iguana configuration, authentication/retrieval adapter, polling loop, source cursor, reconnect/backoff logic, or import-to-queue action. Nothing follows the technician's chosen route or selected E-Rx in Framework. `parseInboundOrder` is called by the workbench, not by a collector or the queue.

This increases data entry and matching work. Network access alone cannot make it automatic.

**Fix:** Implement a collector against one verified existing read interface/export, with channel filtering, incremental retrieval, deduplication, source revision handling and visible connection/staleness state. Populate identity, drug and directions from that record. Keep manual entry as a diagnostic fallback. Do not ask technicians to reconstruct each message in a second form.

**Acceptance:** A synthetic incoming order appears once with its full context, a redelivery creates no duplicate, and a later amendment/cancellation updates the same order and invalidates review. Normal use does not require entering PON, facility, patient and SIG again.

### F02 — P1: The capture still does not prove the live source-to-queue mapping

**Evidence:** corrected `iguCORRECTEDCHANNEL.har`; syntax-preserved XML; [MVP-REVIEW-QUEUE.md](docs/MVP-REVIEW-QUEUE.md), corrected-HAR section; archived MessageBroker `main.lua`, lines 52–79, and `MessageBrokerHelpers.lua`, lines 229–237, 362–365.

Independent HAR inspection confirmed **1,969 HTTP entries**, **281 `/log_entries`** responses and **13 `/log_view_entry`** responses. Twelve detail responses are queue-commit status text; one contains an acknowledgement. These detail records do not contain a complete nurse medication order. The existing repo analysis also distinguishes mixed-channel previews and inbound Paxit billing/status traffic from the desired pre-entry order source. Do not treat the chosen browser page or the word “inbound” as proof of the right clinical feed.

The newer XML sample does establish the following paths for that sample:

| Meaning | Observed path |
|---|---|
| Transaction/version | `/Message/Body/NewRx`; version attributes `20170715` |
| PON | `/Message/Header/PrescriberOrderNumber` |
| Original directions | `/Message/Body/NewRx/MedicationPrescribed/Sig/SigText` |
| Medication | `/Message/Body/NewRx/MedicationPrescribed/DrugDescription` |
| Structured comparison data | `Sig/Instruction/DoseAdministration`, `TimingAndDuration`, `IndicationForUse`, `IndicationClarifyingFreeText` |
| Separate matching context | Header sender plus NewRx facility and patient elements |

The archived broker creates an empty pseudo queue message, then logs the raw incoming HTTP request against its ID. A collector reading only that queue body may retrieve no prescription. It subsequently unwraps the HTTP body and SOAP/XML, with another path for encoded HL7. The helper also writes archived message/response/converted data through `MessageBroker.dbo.LogMessage`. This is an existing archival lead, **not a read API and not a procedure Sig-Assist should invoke**.

**Fix:** Prove where an existing read operation returns the complete original payload and its stable identity, and pair one de-identified message with the same visible Framework PON. Support the observed envelope instead of scraping a truncated preview. Determine transaction direction and lifecycle per record. An existing read-only archival view/export is another candidate, subject to actual availability.

**Acceptance:** A replay fixture contains the full verified source record and expected queue identity/directions. The collector has no ACK, queue-write, forwarding, resend or server-configuration operation. Live connectivity remains an on-LAN acceptance item.

### F03 — P1: Standard-user deployment is not implemented; ordinary LAN HTTP can also crash the workbench

**Evidence:** [package.json](package.json), [README.md](README.md), [vite.config.ts](vite.config.ts), [translationDiagnostics.ts](src/lib/translationDiagnostics.ts), lines 30–47; [WorkbenchView.tsx](src/components/WorkbenchView.tsx), lines 204–218; [App.tsx](src/App.tsx).

The documented launch procedure is developer setup (`npm ci`, `npm run dev`). There is no bundled runtime, desktop launcher, supported installed-app configuration, release deployment procedure, capability check, or failure screen. There is also no local collector service. A source archive is not a ready-to-launch application for a restricted Citrix user.

Separately, diagnostic creation calls `crypto.randomUUID()` unconditionally from a React effect. A browser without that secure-context capability throws when a high-risk/incomplete input triggers diagnostics. A component probe with `randomUUID` unavailable, then input `Apply cream`, produced **`TypeError: crypto.randomUUID is not a function` and an empty React root**. This affects a plausible non-loopback HTTP deployment even though localhost development works. The Web Crypto definition restricts that method to secure contexts. [Web Crypto specification](https://w3c.github.io/webcrypto/#Crypto-method-randomUUID)

Clipboard and directory access likewise have browser/context requirements. The app handles single-order clipboard rejection, but does not establish a usable deployment origin or test it at startup. [File System Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [Clipboard specification](https://www.w3.org/TR/clipboard-apis/)

**Fix:** Supply a prebuilt standard-user launch path. A per-user companion with bundled static UI and a loopback collector is a practical candidate if the Citrix session permits it. Alternatively use an already provisioned HTTPS intranet UI and an independently deployed observer. Include capability detection, guarded diagnostic IDs and a recoverable error boundary. Operators should not need npm, package installation, admin elevation, or changes to Iguana.

**Acceptance:** Launch as the actual standard user on the target Windows/Citrix arrangement, without a development toolchain or UAC prompt. Verify startup, reconnection, endpoint reachability, clipboard and error recovery. Distinguish a local workstation from a browser running inside the remote session; they do not share filesystem/network/clipboard assumptions automatically.

### F04 — P1: Workbench runs two engines and displays the wrong one for ordinary/XML orders

**Evidence:** [WorkbenchView.tsx](src/components/WorkbenchView.tsx), lines 180–201, 376–396; [OrderQueueView.tsx](src/components/OrderQueueView.tsx), lines 22–28.

`runParser(rawInput, ...)` and `translateClinicalSig(parseInboundOrder(rawInput))` execute separately. Clinical abnormalities are displayed, but a single-order result still goes to `WorkbenchReview` using `runParser`'s output. Only multi-order results display the clinical engine's suggested SIGs. Feedback nevertheless prefers `clinicalResult.primarySig`. The queue always uses the older `translateFreeTextSig` path.

**Confirmed UI reproductions:**

1. Drug `DICLOFENAC GEL 1%`, prose `Apply topically twice daily`: the banner claims a 2GM correction, while the editable final SIG is **`TPCL BID`**. The correction described to the technician is not in that draft.
2. Paste synthetic NewRx XML with drug `EXAMPLE 20 MG TABLET` and `SigText` of `Take 2 tablets by mouth daily` into Free Text: the displayed final SIG is **`INJ 20MG PO QD`**. The separately parsed clinical result is `2T (40MG) PO QD`. The normal engine parsed the drug-description strength from the XML document as if it were dose prose.

The presence of an XML extractor does not make the visible single-order UI consume its fields. There is no XML input mode or import-to-queue control to resolve this mismatch.

**Fix:** Decode and classify first, then pass only original directions plus explicit drug/context into one translation result used by the queue, workbench, warnings, review and feedback. Preserve XML itself separately. Do not just switch everything to the clinical engine before fixing F07–F10.

**Acceptance:** A paired XML and free-text representation generates the same draft; warnings describe that exact draft; imported drug/PON/context are visible and retained without retyping.

### F05 — P1: Split-order cards bypass exclusions and do not invalidate approval after edits

**Evidence:** [MultiOrderCards.tsx](src/components/MultiOrderCards.tsx), lines 16–57, 99–149; [WorkbenchView.tsx](src/components/WorkbenchView.tsx), lines 380–384; compare [SigReviewPanel.tsx](src/components/SigReviewPanel.tsx) and [reviewPolicy.ts](src/lib/reviewPolicy.ts).

Split cards do not use `useReviewSession`, `reviewStamp`, `copyBlockReason`, or `excludedMatches`. The parent supplies only `subOrders`, so they receive no cancellation/unverified-profile policy either. The normal shared panel is replaced by these cards when the clinical result splits.

`handleDraftChange` changes text without clearing `reviewedMap`. A component probe checked a card, edited `2T PO QAM` to `3T PO QAM`, and confirmed **the card remained reviewed and copy remained enabled**. Session exclusions are completely ignored on this branch. The card's initial state also uses incoming suggestion text verbatim, and the clipboard boundary does not uppercase it; current generated split suggestions happen to be uppercase, but the component does not enforce the promise.

**Fix:** Reuse the common review policy for every sub-order, keyed to stable parent identity/revision, sub-order content, dictionary/policy version and current draft. Any edit or source/policy change must invalidate review. Exclusions and unavailable-source status must be checked at the copy boundary, not only in button rendering.

**Acceptance:** Exclude a code in the queue, open a split workbench order containing it, and verify copying is blocked. Editing an approved split requires review again. Cancelled/unverified sources cannot obtain an eligible copy button through the split branch.

### F06 — P1: Split copy falsely reports success after clipboard failure

**Evidence:** [MultiOrderCards.tsx](src/components/MultiOrderCards.tsx), lines 35–56.

The clipboard exception is swallowed, and `setCopiedId` runs whether writing succeeded, failed, or the Clipboard API was absent. A mocked rejected write still displayed **“Copied!”**. This is especially disruptive where a technician expects to paste into a remote application: the existing clipboard contents could be mistaken for the reviewed SIG.

**Fix:** Set success state only after the write resolves; show the same explicit manual-copy fallback used by the single-order panel. Treat any optional callback separately from successful clipboard completion.

**Acceptance:** With a denied or absent Clipboard API, no success state appears, and the technician can select the reviewed text manually. Actual cross-session delivery must still be tested in Citrix; a successful browser API call alone does not verify the target field's contents.

### F07 — P1: Regimen splitting loses duration, later steps and the unified review view

**Evidence:** [paxitEngine.ts](src/lib/clinical/paxitEngine.ts), lines 20–62; [clinicalEngine.ts](src/lib/clinical/clinicalEngine.ts), lines 87–135; [WorkbenchView.tsx](src/components/WorkbenchView.tsx), lines 380–384; [MultiOrderCards.tsx](src/components/MultiOrderCards.tsx), lines 60–66.

Splitting synthesizes new prose from a few integer captures instead of preserving a structured sequence of all source clauses. Examples verified by execution:

| Synthetic original directions | Clinical output | Lost/changed content |
|---|---|---|
| `Take 2 tablets by mouth every morning and 1 at bedtime for 7 days` | `2T (20MG) PO QAM AND 1T PO QHS` with a 10MG product | Seven-day duration disappears from both sub-orders. |
| `Take 2 tablets by mouth daily for 3 days then 1 tablet twice daily for 4 days then stop` | `2T (20MG) PO QD X3D THEN 1T PO QD` | Second frequency changed; second duration and stop discarded. |

The second tapered sub-order carries no delayed-start field. Independently entering the two SIGs could lose their sequential relationship. `primarySig` only combines the first two sub-orders. More complex schedules have no complete representation.

The latest engine computes a unified `primarySig`, but the workbench does not display that unified result when rendering split cards. The card notice says it is preserved above; the visible engine trace is the other engine's output. There is no primary unified draft/review control on this branch.

**Fix:** Represent all regimen phases, timing relationships, durations and stop conditions before rendering. Keep the original prescription as the primary record. Render linked entry suggestions only where the site's actual packaging workflow requires them, with explicit timing context and a visible unified review.

**Acceptance:** Every original phase and condition is either retained or explicitly marked unsupported. The technician can review the complete original regimen before using any linked entry suggestion.

### F08 — P2: New dose/frequency helpers can invent or misread instructions

**Evidence:** [doseCalculator.ts](src/lib/clinical/doseCalculator.ts), especially lines 90–131, 204–263; [frequencyEngine.ts](src/lib/clinical/frequencyEngine.ts), lines 151–178.

These are confirmed defects in the newer engine. Many single-order results are currently hidden by F04; they become directly operational if that wiring is fixed without these fixes. The engine already supplies split results and feedback.

| Synthetic input/context | Observed clinical result | Cause |
|---|---|---|
| 10MG tablet; `Take 1.5 tablets by mouth daily` | `5T (50MG) PO QD` | Integer regex matches the suffix after the decimal point. |
| 10MG tablet; `Take 3/4 tablet by mouth daily` | `4T (40MG) PO QD` | Integer regex matches the denominator. Only selected half-tablet forms have special handling. |
| 10MG tablet; empty directions | `1T PO QD`, no abnormalities | Defaults supply dose, route and frequency without source evidence. |
| `Inject 1 ml subcutaneously one time a day`, 10MG/1ML product | `INJ 1ML (10MG) IM QD` | `includes('IM')` matches **TIME**, overriding the explicit subcutaneous route. |
| `Take 1 tablet by mouth every 8 hours` | `1T PO QD`, no abnormalities | Unknown interval falls back to daily. |

Further source-level gaps: injectable amounts are rounded to one decimal; a 0.25ML dose becomes 0.3ML. Unit-based injections have no equivalent dose parser in this helper. Several liquid/solid paths force PO, rather than carrying an explicit route from source. The morphine special case rounds the calculated mg to an integer. Numerical parsing must also reject non-finite/zero-denominator results instead of generating text from them.

**Fix:** Use shared quantity/unit arithmetic and boundary-aware token parsing, preserve precision needed by the input, and represent missing/unsupported dose, route or schedule as unresolved. Remove unconditional clinical defaults. Do not infer a medication instruction from a dosage-form name alone.

**Acceptance:** Fractions/decimals, unit doses, route words, unknown intervals and missing fields all have explicit regression cases. No valid-looking default is emitted for absent instructions.

### F09 — P1: The primary queue engine can silently discard source clauses

**Evidence:** [sigEngine.ts](src/lib/sigEngine.ts), lines 37–115; [OrderQueueView.tsx](src/components/OrderQueueView.tsx), lines 22–28, 119–126.

`ParsedSigOrder` supports one dose/frequency, a narrow route union, and a limited hold pair. There is no accounting for all consumed/unconsumed source clauses. Once it recognizes a dose, route and frequency, it can report no issues even after losing clinically meaningful text.

Confirmed examples:

| Synthetic input | Primary queue engine result |
|---|---|
| `Take 1 tablet by mouth daily; hold if SBP < 100` | `1T PO QD`, **no issues**; hold omitted. |
| `Take 2 tablets by mouth every morning and 1 at bedtime for 7 days`, 10MG tablet | `2T (20MG) PO QHS X7D`, **no issues**; combines the first dose with the later schedule and loses the other dose. |
| `Take 2 tablets by mouth daily for 3 days then 1 tablet twice daily for 4 days then stop`, 10MG tablet | `2T (20MG) PO BID X3D`, **no issues**; merges facts from different phases. |
| `Take 2 tablets by mouth daily`, product `EXAMPLE 5-325MG TABLET` | `2T (650MG) PO QD`; one ingredient's strength is presented as an unqualified total. |
| `Take 1 tablet by mouth every 8 hours` | `1T PO`; only a missing-frequency warning, with the original interval absent from output. |

Unsupported routes such as inhaled/ophthalmic/otic and additional schedules/treatments are not represented by the current type unions. `doseToken` also renders a raw mg/mcg quantity as `INJ` irrespective of an oral route. Explicit stop-date removal sets a Boolean/warning but does not retain the parsed date in a typed field for later entry.

**Fix:** Track source coverage and structured regimen steps; retain unsupported clauses and distinguish incomplete translation from a complete suggestion. Keep ingredient-specific strengths separate. Pass stop dates into the order model even when they are excluded from the copied SIG. A review checkbox should not have to compensate for invisible omissions.

**Acceptance:** Every example above is preserved correctly or blocked as incomplete, with the missing clause identified. Fixes must exercise the queue's actual engine, not just an unused helper.

### F10 — P1: Abnormality detection and template blending are not complete

**Evidence:** [frequencyEngine.ts](src/lib/clinical/frequencyEngine.ts), lines 51–109, 180–194; [sigEngine.ts](src/lib/sigEngine.ts), lines 86–103, 115; [clinicalEngine.ts](src/lib/clinical/clinicalEngine.ts), lines 43–58; [TESTS.txt](TESTS.txt).

- The newer sliding-scale function gathers/sorts ranges but never checks gaps or overlaps. `uncorrected_gap` and `potential_error` renderers/tests do not demonstrate the engine produces those findings. The older `validateScale` checks gaps only between closed ranges, not overlaps, low/high-action boundary coverage, or full intended coverage.
- The newer helper relabels ML as U in scale ranges with an “applied correction”; it has no concentration-based conversion or verified intended-unit check. The older engine instead flags insulin ML input as blocking. Those disagreeing policies must not depend on which UI branch ran.
- The queue accepts a `defaultSig` field and passes it to `translateFreeTextSig`, but that implementation never uses it. A packet example produced `1PKT PO QD` identically with and without `MIX IN 8 OZ WATER AND GIVE PO`.
- The newer template branch appends frequency only when the template ends in PO; it does not reconcile quantity, frequency, PRN, duration or holds. Its early return can drop those parsed fields. Template text is returned without the final uppercase normalization used by the ordinary branch.

**Fix:** Implement explicit template slots and conflict handling within the single chosen engine. Implement and test abnormalities through the actual parser-to-UI path. Preserve unresolved ambiguity; do not treat a missing bracket or a unit change as a formatting-only operation.

**Acceptance:** Missing/overlapping scale ranges are shown, and template blending retains all original dose/schedule/PRN/duration/hold content. Branch-specific output cannot silently adopt a different policy.

### F11 — P1: Inbound parsing and the three order contracts cannot support reliable matching/lifecycle

**Evidence:** [clinical/inboundParser.ts](src/lib/clinical/inboundParser.ts), lines 30–95; [clinical/types.ts](src/lib/clinical/types.ts); [orderQueue.ts](src/lib/orderQueue.ts); [citrixStorage.ts](src/lib/citrixStorage.ts), lines 3–26.

The XML regex extracts the first matching tag without validating envelope, namespace, transaction version/type, or medication scope. Prefix-qualified XML yields `UNKNOWN_PON`, `UNKNOWN DRUG`, and empty directions in a probe. Numeric character references, CDATA and encoded envelopes are not handled as XML. Any XML with closing tags is labeled `ncpdp_xml`; cancellation/change/response traffic is not distinguished from a new order. Falling back from PON to generic `OrderNumber` discards identifier meaning.

Manual multiline input without the special `USER ENTRY:` convention keeps only the last line as prose; a probe with directions followed by a hold retained only the hold. Normalization also changes raw prose before it is stored in `InboundOrder`.

Every parse produces a timestamp/random ID. Two parses of the same message had different IDs. There is no preserved transport message ID, revision timestamp or supersession relationship.

| Concern | UI `QueueOrder` | `InboundOrder` | `StoredQueueOrder` |
|---|---|---|---|
| Matching | Facility + patientRef + PON | PON; random ID; no facility/patient context | ID/PON; no facility/patient context |
| Directions/drug | `directions`, `drug`, `defaultSig` | `rawProse`, `drugName`, `defaultSigTemplate` | `rawProse`, `drugName` |
| Review | Content/policy-linked `approved` stamp and `copied` stamp | Absent | Boolean `isReviewed` |
| Lifecycle | Revision/history and cancellation | Absent | pending/completed/skipped; no cancellation/history |
| Structured instructions/dates | Absent | Mostly discarded; optional indication only | Absent |
| Split-parent relationship | Absent | Absent | Absent |

There is no mapper/validator between these contracts. TypeScript passes because they are not connected, not because they form a compatible pipeline. Blindly serializing one as another would lose identity and review invalidation semantics.

**Fix:** Define one versioned canonical order/event model, keep original and normalized content separately, parse XML with namespace-aware tooling, and validate external data. Represent transaction action and all matching context explicitly. Use durable source identity rather than random parse-time IDs. Add deliberate adapters only at boundaries.

**Acceptance:** Equivalent repeated messages deduplicate; different facilities/patients with the same PON remain separate; amendments and cancellations invalidate the right review; round-trip storage preserves all identity/lifecycle fields; malformed/unsupported input is visible as such.

### F12 — P1: Dictionary and preference work does not affect the normal generation path

**Evidence:** [parser.ts](src/lib/parser.ts), lines 261–303; [OrderQueueView.tsx](src/components/OrderQueueView.tsx), lines 22–28; [ReviewSession.tsx](src/components/ReviewSession.tsx), lines 7–9; [clinicalEngine.ts](src/lib/clinical/clinicalEngine.ts), lines 33–44; [clinical/types.ts](src/lib/clinical/types.ts).

Free-text `runParser` returns before phrase expansions, tech rules, obsolete redirects and dictionary translation/validation. The queue does not load those services. A probe marked QD obsolete with a Q24H redirect and high-risk flag; free text still produced QD with no unresolved/high-risk flags. All generated free-text tokens are marked `unresolved: false` regardless of dictionary presence.

The session exclusion mechanism blocks copying and hides an excluded suggestion; it does not select a permitted equivalent. The technician must edit output or undo the preference. Exclusions disappear on reload. `readPreferences`/`writePreferences` have no UI callers; `translateClinicalSig` is invoked without preferences. `defaultAdminTimes` is never consumed. Thus the documented persistent COU/admin-time preferences are not operational.

**Fix:** Apply the chosen dictionary and personal/site policy consistently after parsing and before review. Persist non-order preferences separately from ephemeral order data. Suggest a validated alternative only when available; otherwise show an actionable conflict. Do not silently substitute clinical meaning. Use dictionary/policy revisions to invalidate stale reviews.

**Acceptance:** A saved preference still works after restart, applies in both queue/workbench and all sub-orders, and does not require the same correction on every order. No generated token is declared validated merely because a string was emitted.

### F13 — P1: Citrix storage is disconnected and cannot provide the documented durability

**Evidence:** [ReviewSession.tsx](src/components/ReviewSession.tsx), [citrixStorage.ts](src/lib/citrixStorage.ts), [SettingsView.tsx](src/components/SettingsView.tsx), [DiscrepancyPanel.tsx](src/components/DiscrepancyPanel.tsx), lines 60–99.

A source-wide call-site search found no application call to `connectDirectory`, `readQueue`, `writeQueue`, `readPreferences`, `writePreferences`, or `flushPendingWrites`. Only discrepancy append uses the adapter. The real queue and exclusions remain React memory. The ordinary UI can never select the redirected folder or read saved orders back. The `beforeunload` warning is not storage and does not cover unsaved workbench drafts when the queue is empty.

The adapter retains its directory handle only in a class field, not IndexedDB, and does not verify/reacquire write permission. `showDirectoryPicker()` requests the default read access rather than explicitly requesting read/write. Browser documentation specifies the mode and rechecking permissions; selecting a folder once does not establish durable write permission across sessions. [File System Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)

**Fix:** Connect the actual queue/preferences to the agreed store using F11's model. Expose accurate store status and reconnection. If a browser folder store is retained, persist its handle, verify permissions, and test it on the actual redirected directory. Separate queue expiration from lasting exclusions. Do not assume Citrix always clears or always preserves a browser profile.

**Acceptance:** Restore a reviewed-but-now-stale source safely after restart, preserve exclusions, expire orders at the chosen lifetime, and recover visibly from lost directory access. Validate disconnect/reconnect, actual logoff, new session and concurrent session behavior separately.

### F14 — P1: Storage failures are reported as successful saves; fallback can return stale data

**Evidence:** [citrixStorage.ts](src/lib/citrixStorage.ts), lines 106–160, 163–176, 214–249; [DiscrepancyPanel.tsx](src/components/DiscrepancyPanel.tsx), lines 64–99, 157–166.

`writeFile` returns false on error; `writeLocalStorage` swallows its own errors. `commitWrite` resolves the save promise regardless of whether either destination succeeded. The UI then says “Saved to Citrix Storage!” even though ordinary application use never connected a folder.

Confirmed fault probes:

- With localStorage writes throwing a quota error, `appendDiscrepancy` resolved successfully and readback returned zero records.
- With a readable old file and denied writes, the new record was written to localStorage, but readback still preferred the old file. The adapter reported `file_system`; disk read returned only `old`, while the cache contained `old` and `new`.
- Two concurrent immediate appends to the same adapter yielded one saved report instead of two. Read-modify-write is not serialized.

Debounced writes do not track in-flight writes for a complete flush, and fixed whole-file writes have no version/conflict protocol for concurrent sessions. These are additional risks if the adapter is connected to live order state.

**Fix:** Make persistence return a verified result or throw; expose degraded/unavailable status; use a consistent read source after fallback; serialize updates; track in-flight writes; validate schema on read; and define conflict handling. Do not resolve callers as saved merely because an error was caught.

**Acceptance:** Write-denied, quota-full, malformed JSON, concurrent append and stale-file scenarios do not lose records silently or show false success. Reads after a successful write return the latest committed version.

### F15 — P2: Discrepancy capture records the wrong result and has no usable review/export loop

**Evidence:** [WorkbenchView.tsx](src/components/WorkbenchView.tsx), lines 388–396; [DiscrepancyPanel.tsx](src/components/DiscrepancyPanel.tsx), lines 24–30, 64–99; [translationDiagnostics.ts](src/lib/translationDiagnostics.ts), lines 22–28, 60–77.

Feedback prefers the clinical engine's `primarySig` even when the technician saw/edited the other engine's output. The draft in `WorkbenchReview` is not passed into feedback, so the technician must type the correction again. When input/order changes, feedback state is not keyed/reset, allowing old notes/corrected text to be associated with new props.

Discrepancy writes persist raw prose, PON, drug and notes in localStorage without a TTL. Queue clearing does not clear those records. There is no application caller of `readDiscrepancies`, no discrepancy viewer/export, and no preference-update mechanism consuming them. Recording a lead does not currently close the improvement loop.

The separate GitHub diagnostic redactor only removes certain dates and numbers. It does not remove names or arbitrary identifying text, and the generated output is included unchanged. Its claim that identifiers are excluded is not guaranteed by the implementation. No diagnostic issue was opened or submitted during this audit.

**Fix:** Record the exact source revision, suggestion and current correction the technician actually reviewed; reuse that correction instead of asking for it again. Reset feedback on identity changes. Provide a bounded, explicit retention/export/review path. Keep public diagnostic generation separate from raw clinical data and validate its redaction claims before enabling it operationally.

**Acceptance:** A correction can be flagged with minimal extra input; it is attached to the right source/result and recoverable from the supported store. Clearing/expiry behavior and any exported content match what the UI promises.

### F16 — P2: The optional shared dictionary is not turnkey or complete

**Evidence:** [sigDictionaryService.ts](src/lib/sigDictionaryService.ts), lines 4–12, 26–39; [techRulesService.ts](src/lib/techRulesService.ts), lines 24–29; [supabase.ts](src/lib/supabase.ts); [DictionaryView.tsx](src/components/DictionaryView.tsx), lines 240–258; [SettingsView.tsx](src/components/SettingsView.tsx).

- No local dictionary backend exists. Without Supabase, reads return empty arrays, while save/import calls throw. The local prototype can boot, but editing/importing the supplied dictionary is unavailable. There is no ready-to-import JSON dictionary generated from the supplied DOCX and no full deployment/migration/seed procedure in the quick start.
- `fetchAllSigEntries` performs one request without pagination or an expected-count check. Supabase documents a configurable default maximum of 1,000 returned rows; the supplied dictionary has thousands of entries. On that setting, search, export and bulk clear operate on an incomplete subset. This is a conditional service-limit defect; the actual remote setting was not read. [Supabase row-limit documentation](https://supabase.com/docs/reference/python/select)
- JSON import performs no runtime schema validation before accessing fields. The services' return types also rely on unvalidated external data; the Supabase client is not parameterized with generated database types.
- `reorderTechRules` awaits requests but never inspects their `{ error }` results. Its caller's `.catch()` will not catch normal PostgREST error responses, leaving the visible reorder different from the saved order. There is no atomic reorder.
- Nonempty malformed Supabase URL configuration reaches `createClient` at module import with no configuration error UI. Empty configuration is handled; malformed configuration is not the same case.

**Fix:** Choose and document local versus shared dictionary ownership, provide a versioned import pipeline and typed/schema-validated data, paginate until complete, report/rollback failed writes, and handle configuration errors without preventing local review.

**Acceptance:** A full-size dictionary imports and round-trips with count/version verification; offline/unconfigured behavior is explicit; denied rule reorders do not appear saved. No remote service is required merely to run the local MVP.

### F17 — P1: Framework behavior and active-order matching remain unverified boundaries

**Evidence:** archived Framework manual pages 141, 335–337, 966, 970; data dictionary pages 715, 760; managed UI metadata; [clinical/types.ts](src/lib/clinical/types.ts), [types.ts](src/lib/types.ts), [paxitEngine.ts](src/lib/clinical/paxitEngine.ts).

Framework SIGs affect quantity per dose, doses per day, days supply, route, administration times, partial-tablet status and structured SIG interpretation. The app's dictionary model holds translation/status/high-risk text, not these interpretation effects. A phrase that reads equivalently is not automatically an interchangeable Framework macro. `defaultAdminTimes` in an unused preferences object cannot set Framework's administration times.

The manual explicitly supports split directions in Framework; packaging compatibility must be a separate site-specific check. `evaluatePaxitPackaging` currently infers Paxit applicability from TAB/CAP in the product name and has no facility/package-type input. The archived integration rules do not justify treating every oral solid as a Paxit order or every multi-phase regimen as a new prescription.

The internal PON lookup's facility/patient parameters support contextual matching, but the inspected metadata does not prove an external API for reading the active selection. `FWLTC.InterfaceQueue` is documented for MTS/MOT; it should not be assumed to be the E-Rx work queue. Framework's separate E-Rx Queue Manager setting is a useful lead, not proof that a default port is a readable API at this site.

**Fix:** Validate output using the actual site dictionary and Framework Preview Sig, including all interpreted fields. Observe the active order through a verified supported interface or deliberately scoped on-session mechanism. Keep direct field insertion as a stretch goal; clipboard review can work first. Verify session placement and clipboard delivery with the real non-admin account rather than assuming local browser access implies remote UI access.

**Acceptance:** One matched synthetic/test order demonstrates correct PON/context, generated codes, expanded directions, quantity, schedule and days supply in Framework. No automated paste/save should proceed on an uncertain active-order match.

### F18 — P2: Tests and documentation overstate what is implemented

**Evidence:** [tests/uiIntegration.test.tsx](tests/uiIntegration.test.tsx), [tests/clinicalEngine.test.ts](tests/clinicalEngine.test.ts), [sigRegression.test.ts](src/lib/sigRegression.test.ts), [sigComparison.ts](src/lib/sigComparison.ts), [checks.yml](.github/workflows/checks.yml), [docs/superpowers/PR_COMMENT.md](docs/superpowers/PR_COMMENT.md), [README.md](README.md).

The UI suite uses `renderToString`; it verifies initial markup, not typing, review invalidation, copying, failed saves, restart or end-to-end intake. Thus 118 passing tests coexist with F04–F06. The clinical suite checks selected cases and some partial output substrings; it does not execute every maintained `TESTS.txt` case through the queue/workbench path.

The “site synonym variants” regression compares a hand-written acceptable output rather than calling the translator. `compareSig` can also accept a result merely because a small token set is present, without checking dose, site or schedule equivalence. It must not become an operational clinical validator.

The benchmark itself needs reconciliation: for example, the original half-of-25MCG case labels its expected parenthetical as MG while the newer test uses MCG. Do not force an implementation to reproduce a unit typo. Some expected outputs are narrative requirements rather than literal SIGs; count them separately and obtain approved expectations.

Documentation currently promises complete benchmark success, direct redirected-folder persistence, stored sub-orders, and preferences that are absent from the real call graph. Older local-MVP notes accurately describe memory-only orders but are stale for the newer persistent feedback path. Lint now reports 21 errors, not the five in the older handoff, and CI omits that gate.

**Fix:** Update implementation status from verified call paths. Add a small real interaction suite covering the failures above and an end-to-end replay-to-queue test. Parameterize agreed fixtures through the same entry path the user sees. Keep missing integration and unverified environment checks visibly separate from passing unit checks. Fix lint and decide whether it is a CI gate.

**Acceptance:** Tests fail for the reproduced bad behaviors; fixing an unused helper alone cannot make the workflow suite pass. Documentation states precisely what is implemented, tested, planned and site-dependent.

## Recommended implementation order

1. **Make the runtime concrete.** Choose the actual session placement and deliver a prebuilt standard-user launcher/origin. Guard optional browser capabilities and fatal diagnostics (F03). Keep default local startup working.
2. **Join the data model and UI path.** Define canonical identity/lifecycle (F11), import the supplied de-identified XML through a fixture adapter, and make that populate the queue automatically (F01/F04). This provides a reviewable runtime milestone without requiring production LAN access during development.
3. **Fix review integrity and visible data loss.** Unify copy/exclusion policy (F05/F06), preserve regimen phases (F07/F09), and correct the selected engine before routing all orders through it (F08/F10). Unsupported content should stay visible and unresolved.
4. **Make local state truthful.** Wire the agreed bounded order cache and durable preferences (F12/F13), then resolve failure/concurrency/readback behavior (F14). Integrate feedback without duplicate entry (F15).
5. **Complete source and site qualification.** Prove the read-only source mapping on LAN (F02), deploy the collector, validate actual Framework effects and Citrix paste/matching (F17), and add the full dictionary path needed by that deployment (F16).
6. **Replace claims with evidence.** Update docs and CI using those actual workflows (F18). Reconcile the older open parser PRs against the chosen model rather than accumulating additional engines.

The normal technician interaction should become: open the companion once, choose their existing work context once if necessary, see the matched incoming order, review/correct its draft, and copy into Framework. Repeatedly filling identifiers or retyping corrections is not an acceptable substitute for intake/matching.

## Concrete MVP acceptance checklist

- [ ] Standard Windows user can launch the packaged app in the intended Citrix arrangement without installing dependencies or elevating privileges.
- [ ] Missing capabilities/configuration show a useful state instead of a blank page or false success.
- [ ] A complete synthetic SCRIPT order enters the queue with identity, original directions, drug, timestamps and structured comparison data filled automatically.
- [ ] The same record is not duplicated on redelivery; amendments/cancellations invalidate the correct review; disconnect/reconnect has explicit status.
- [ ] Source clauses, quantities, units, routes, schedules, phases, holds and durations are preserved or explicitly unresolved.
- [ ] Queue, workbench, split cards, warnings and discrepancy capture use the same source/result/policy.
- [ ] Every edited or newly excluded SIG requires fresh review; copy failure is visible and does not claim success.
- [ ] Preferences survive the intended restart, while orders follow a deliberate bounded lifetime; save/readback failures and concurrency are covered.
- [ ] Actual on-LAN retrieval is proven read-only; no code/configuration is installed or written on Iguana.
- [ ] One matched test order is pasted into Framework and its expanded/structured SIG, quantity, administration times and days supply are checked in the real session.
- [ ] Tests and project documentation accurately describe the milestone that passed.

## Reproduction notes for maintainers

Re-run the unchanged baseline with `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint`. At the reviewed revision only lint is expected to fail among those checks. The following compact synthetic XML reproduces F04 in the Free Text workbench:

```xml
<Message TransactionVersion="20170715">
  <Header><PrescriberOrderNumber>DEMO-1</PrescriberOrderNumber></Header>
  <Body><NewRx><MedicationPrescribed>
    <DrugDescription>EXAMPLE 20 MG TABLET</DrugDescription>
    <Sig><SigText>Take 2 tablets by mouth daily</SigText></Sig>
  </MedicationPrescribed></NewRx></Body>
</Message>
```

For F05, enter an example tablet product and differing morning/bedtime doses in Workbench, approve the first split card, edit its SIG, and check whether copying remains enabled. For F06, reject/mock the clipboard write and inspect the resulting status. For F03, use a test environment without `crypto.randomUUID`, enter incomplete prose, and check that the app recovers rather than unmounting.

For F14, exercise the adapter with (a) denied writes in both stores, (b) a readable old file plus denied file writes and an available cache, and (c) two simultaneous append calls. Assert readback and reported destination, not just promise resolution. The temporary audit probes reproduced all three failures.

### Private evidence provenance

Source material remains in the user-supplied Drive handoff. These hashes identify the two locally inspected archives/captures without reproducing their contents:

| File | Bytes | SHA-256 |
|---|---:|---|
| `analysis-and-source.zip` | 19,840,280 | `8264c50729fd9f640c6214baaef4ed3f5a188529b5e54cb18a3b9e607ee3e01a` |
| `iguCORRECTEDCHANNEL.har` | 90,950,882 | `ff2d5b7db6ba0da0c9790792c14f84b08e66e7ce961c9cf118ec9e18564a971d` |

Relevant source links: [syntax-preserved de-identified XML](https://drive.google.com/file/d/1gDmvEcZsqAEst01cBe_UGwogQYxMDrAS/view), [MessageBroker entry point](https://drive.google.com/file/d/1U-biWvWXosJHsN_fLRrYVh6_PeqKMV_x/view), [MessageBroker helpers](https://drive.google.com/file/d/1ZPfUySdXlwlgQHGXoRbr8Jat96WB6GPJ/view), [dump update notes](https://drive.google.com/file/d/1X3XdIzKHX70l9MBemsTs24e3FFOLD8Vj/view). These are historical/de-identified evidence, not proof of the current production server configuration.
