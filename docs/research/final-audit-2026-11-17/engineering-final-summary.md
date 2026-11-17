# Engineering lab final response summary

This is the connector's final response summary, recovered after the lab exhausted its credits. The lab's `engineering-report.md` is only its first checkpoint. Candidate native changes below were not implemented by the lab and must not be read as measured results.

Credits ran out during the audit; the work is incomplete. The pharmacy repo was not modified. The checkpoint was fetched read-only at `b853b88cb7bc6c96f262d06b8240c434f0174a13`, and related baseline tests passed 90/90 on Linux.

**Verified defect:** In `src/components/IguanaConnectorPanel.tsx`, detected-PON candidate counting uses substring matching via `orderSearch.ts`. With synthetic `TEST-PON-100:10` already loaded, detecting `TEST-PON-100:1` incorrectly counts the sibling as a match, hiding “No matching orders” and “Search the last 7 days.” A small patch makes detected PONs match exactly (trimmed), carries that rule into the seven-day retry, and leaves typed searches unchanged. The synthetic regression test fails on baseline and passes with the patch; the patched lookup tests passed 10/10. This does not explain the pilot’s zero-log result.

Saved in the lab, uncommitted:
- `docs/FINAL-AUDIT-2026-11-17.md` — initial checkpoint only
- `audit-2026-11-17/01-detected-pon-exact-lookup.patch`
- `audit-2026-11-17/tests/detectedPonExactLookup.test.tsx`

**Static candidates, not runtime-verified:**
- `iguana-bridge.mjs` polls observations every 3 seconds and appears to relaunch a helper after its 8-second timeout without backoff. A passive `IsHungAppWindow` check before UI Automation calls could report a distinct not-responding status; `safeDesktop` in `pilot-journal.mjs` would need to preserve it. A Windows fixture test and backoff change were not implemented.
- `ObservationChildren` in `windows/FrameworkDesktop.cs` appears to enumerate siblings once to rotate the starting point and again during traversal, wasting UI Automation reads. This was not measured.

The passive current-PON reader prototype, installer contract review, package/start-date field evidence, and expanded final report remain undone. Do not use Detect’s scrolling/recovery routine for a passive reader; use targeted cached reads from the remembered entry window without scrolling or recovery.

The lab preview still has TypeScript errors in the older `src/lib/erxQueue/` files, associated with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; these were not addressed. The `/tmp` checkout may be lost.
