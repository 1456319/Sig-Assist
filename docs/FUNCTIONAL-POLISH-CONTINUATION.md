# Sig-Assist continuation checkpoint

**Historical checkpoint:** the missing implementation has subsequently been
reconstructed and committed incrementally. See
[functional polish recovery](FUNCTIONAL-POLISH-RECOVERY.md) for restored behavior,
verification and remaining workstation checks.

This checkpoint preserves the implementation state from the interrupted functional-polish turn. The execution workspace subsequently became unavailable. It is not a release announcement.

## Published baseline and recovered research

The last validated application build is v0.1.8, commit 5ba102ee4a7c76eef7962e69e4c5882efaaf2d8b, with the Astra audit subsequently committed as 6fed8ca. GitHub still showed version 0.1.8 when this checkpoint was written. The unfinished local application changes have not been verified as committed, built or uploaded.

Completed external reviews are now preserved in:
- [Installer entrypoint review](research/LOVABLE-INTEGRATION-ENTRYPOINT-REVIEW.md)
- [Translation QA and synthetic corpus](research/LOVABLE-SIG-QA-AND-CORPUS.md)

Both reviews describe the baseline, not the modified working tree. Lab code with disabled TypeScript checking was not adopted. The corpus is reference material; raw-source preservation is not successful automatic translation.

## Recover the working tree before editing

Original checkout: /workspace/scratch/97832af46bc1/project, branch prototype. Check whether its uncommitted edits still exist before reimplementing or resetting anything. Preserve them and compare against the current remote, which now also contains these documentation commits. Do not reset the working tree to the older remote and discard the implementation.

Expected edited files and responsibilities:
- Treatment parser: src/lib/clinical/treatmentOrderEngine.ts and tests/treatmentOrders.test.ts.
- Scale parser: src/lib/clinical/slidingScale.ts, frequencyEngine.ts, clinicalEngine.ts, sigEngine.ts; new tests/slidingScaleVariants.test.ts.
- Native observation: windows/FrameworkDesktop.cs, scripts/framework-desktop.mjs, scripts/pilot-journal.mjs, scripts/smoke-framework-desktop.mjs, tests/fixtures/FrameworkDesktopFixture.cs.
- Performance/dictionary: outputCodePolicy.ts, sigDictionaryService.ts, possibly paxitEngine.ts and new tests.
- Clipboard and length polish: SigReviewPanel.tsx, MultiOrderCards.tsx, tests/citrixClipboardRecovery.test.tsx.
- Classic numeric matching: sigEngine.ts, tests/classicDoseBoundaries.test.ts.
- Reported-output fixture: tests/fixtures/reported-discrepancies-2026-11-03-reviewed.json.
- Other new agent files must be discovered from git status; this list is not exhaustive.

Historical local test log: /workspace/scratch/97832af46bc1/v019-tests.log. Do not describe an incomplete run as a passed suite.

## Implemented locally before interruption

Treatment work used ordered procedural clauses; retained duration, notifications, named weekdays, PRN reasons and source action order; removed the implicit QS frequency and product APPLY injection. The treatment agent reported 22 focused tests passing before one final residual-qualifier guard. Review its final file rather than assuming that guard passed.

Scale work added insulin-context numeric detection without the heading; glucose mg/dL labels; postfix comparisons; explicit additive base dose; per-band rechecks and retained unknown action text. Clinical and classic entry points share detection; clinicalEngine bypasses splitSupplementalDirections for scale candidates so GIVE/IF/CALL clauses are not severed.

A reproduced regression treated "400 or less than 60" as a postfix comparator. The normalizer was amended to distinguish "or less" from "or less than". The existing November case 52 and a new opposite-threshold notification case were reported restored.

Native observation work batched identity/capability reads and separately fetched values after password checks; prioritized the validated focused subtree and known views; traversed offscreen wrappers; removed per-node GetSupportedPatterns; rotated siblings by a connector-owned scanOffset. New numeric metadata: scanOffset, cacheReads, prioritySeeds. Patterns now represent the four surveyed capabilities, not a complete pattern inventory. A synthetic fixture has 1,000 decorative controls plus quantity, days supply, package and start-date editors. It must prove field reach, fresh quantity tokens, unchanged focus and omitted private values. Static checks were reported passing; Windows compilation/UIA was never confirmed.

UI work added full-length counters against 199 characters, select-draft controls and automatic selection after clipboard failure, without claiming a successful copy. Two clipboard-recovery tests passed alongside 22 connector/journal tests.

Performance work reported ~4.6x improvement for a synthetic rejected-code scan by compiling bounded cached patterns and normalizing once. Dictionary import was changed to one indexed merge/write, preserving existing entries and IDs. Save failures were changed to reject rather than silently report success; corrupt local archives were preserved. These results were intermediate, not final release validation.

## Known remaining integration and verification work

1. Finish the entire existing test suite. The interrupted full run found scale assertions in reportedDiscrepanciesBatch3 and reportedDiscrepanciesOct4. Distinguish genuinely ambiguous numeric doses (retain complete source) from recognized doses with unknown notification recipients (retain recipient text beside translated bands with a finding). The scale agent was fixing this when its turn hit a usage limit. Do not merely loosen assertions to hide missing doses.

2. Review the three deliberate November fixture changes against original directions:
   - Case 10: retain "(DURING DAY SHIFT)".
   - Case 86: retain "FOR SKIN CARE".
   - Case 93 routine part: retain "FOR FUNGAL PARTIAL THICKNESS".
   Original source directions were not to be changed. Review additions for field length and practical wording.

3. DictionaryView should display the actionable storage error instead of always saying the JSON is invalid. Check whether this adjustment was made. Also check fetchAllSigEntries: remote empty/partial results previously replaced the local cache, erasing offline codes. A follow-up request to preserve pending local changes was sent, but its implementation was not confirmed. Handle explicit deletions separately so deleted remote codes are not resurrected. The user's existing custom codes are important functional data.

4. Verify the long-whitespace packaging benchmark fix, if any. Classic parseDose gained a left boundary, fraction-first parsing and finite-number check to avoid quadratic retries on long digit runs. Confirm ordinary/fractional doses still parse.

5. Run lint, type checking, full tests, build and package checks once the files are stable. Then Windows CI must compile the native observer and execute its wide-tree fixture plus existing DocuTrack, Framework, clipboard, direct-file, UNC, Iguana and pilot tests. No workstation latency or complete-field-coverage claim is justified yet.

6. Update temporary logging documentation for caching, scanOffset and the limited capability survey. Keep TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH visible. A short focused workstation check is useful after field coverage is demonstrated; do not request another long general capture first.

7. Only after passing checks, bump/package the next prototype and push the application changes. Preserve the private recording-folder configuration and existing iguana-site.json. Do not publish PHI, captures or credentials. Verify any uploaded workstation ZIP against its source. No v0.1.9 build exists merely because its test-log filename does.

## Installer opportunities worth pursuing

Static installer work identified:
- DocuTrack DirectConnect.DirectConnectCOMClient.1, a COM wrapper over a local WCF client service, with loaded-document read operations and UI/document mutation operations.
- Framework's local integration service at net.pipe://localhost/FrameworkLTC{PROCESS_ID}/Service, with screen/order navigation and queue-message association operations. This could remove manual navigation; it is not itself a field read/write or refusal API.
- A configured Framework localhost web API with controller types for prescriptions, patient orders and work queues. Its actual routes/port and relationship to the expressly excluded FWDirect surface remain unresolved.
- DTClientInterfaceHarness is a scripting/clipboard/screen-scraping component, not a queue API.

Exact method/type evidence is in the recovered review. Earlier local installer research may have deeper method-body evidence than the external report. Recover that work from /workspace/scratch/97832af46bc1/extract-tools and any new agent artifacts before repeating extraction. Inspect installed-version contracts and normal session behavior before wiring new calls. Do not infer a logical WCF URI from OS pipe names alone.

Functional priorities remain treatment and scale translation, then native field coverage and practical navigation. Trust the technician; keep partial drafts editable and collect optional corrections/comments. E-DC automation remains earmarked; FWDirect remains excluded.

## External job retrieval

All jobs below completed and need not be resubmitted:
- Audit Lab: project 766dd189-ff18-4f49-b2d7-f97e8726f577, account link_6a6e0563fc9881918dd6ac2cf7b6bcc0, message umsg_01m7j7922ee3vrxv618hhc4yc6.
- Engineering Lab: project 22a38ec9-2439-4854-a171-b32ba96dd019, account link_6af9b0f8e2e481919a094b9a969aab3e, message umsg_01m7j7yk02e1pb37scfpyywbar.
- QA Lab: project f6775d54-18d5-4a10-8619-e419ba04dea2, account link_6af9aee8f8f08191bbe5f2f684b3ce59, message umsg_01m7j7y7agep9a27ezxwvw1rp2.

Read published handoffs first. Review the lab's existing experimental artifacts if needed; do not mistake their separate app builds or tests for pharmacy-repository validation.
