# Final audit 2026-11-17: dictionary durability and technician lookup workflow

Baseline: `1456319/Sig-Assist@b853b88cb7bc6c96f262d06b8240c434f0174a13`. The source was read from a public tarball in an isolated `/tmp` checkout. The pharmacy repo was not edited, pushed or published. All inputs are synthetic and contain no PHI.
Patches and tests are in `audit-2026-11-17/`.

**Verification.**
- Baseline: the new tests fail (3 dictionary tests and 1 lookup test).
- Patched: the full suite passes, **68 files and 1116 tests** (1111 existing + 5 new).
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) passes.

Already-fixed 6fed8ca findings are not repeated here.

## D1 (high): a dictionary lookup that fails returns a stale list and hides a code the technician just saved
- **Where.** `src/lib/sigDictionaryService.ts`, `fetchAllSigEntries`, lines 150–159. `state` is read before the shared request and is only re-read `if (remote)`. When the request errors, throws, or returns a malformed body, the pre-request snapshot is returned.
- **Trigger.** `DictionaryView` starts `load()` on mount. If the network is slow or failing, the technician saves `NEWCODE` (`upsertSigEntry` → `load()`), or deletes a code, while the first load is still pending. The first load then resolves with an error after the save.
- **Current behavior.**
  - The list drops `NEWCODE`, even though it is stored locally.
  - A code that was just deleted reappears in the list.
  - Either can happen right after a "saved" or "deleted" toast. This looks like data loss and invites a duplicate re-entry or a second delete.
- **Expected.** The list returned always reflects local storage as it stands when the request settles.
- **Fix** (`01-dictionary-stale-lookup.patch`, 3 lines). Move `state = getLocalState()` outside the `if (remote)` block.
- **Test.** `sigDictionaryRaces.test.ts` covers the error, malformed-body and delete cases.
- **Limitation.** This does not reorder overlapping `load()` calls in `DictionaryView`. With the fix, each load returns current local data, so the remaining order risk only affects remote rows, which pending markers and tombstones already guard.

## D2 (medium, workflow trust): a lookup for an order that is already saved says "0 logs · 0 added" and does not offer the 7-day search
- **Where.** `src/components/IguanaConnectorPanel.tsx`, `runQuery`, around lines 88–108. The lookup status shows only `result.logs.length` and `intake.summary.added`. The 7-day button is hidden whenever saved orders match (`count > 0`), but the status never states that count.
- **Trigger.** A detected PON `123456789:0000123456` was already added to the queue by earlier intake, and the new Iguana query returns no new logs for it.
- **Current behavior.** `Search complete: 0 logs · 0 added. Choose a matching E-Rx below.` with no 7-day retry. A technician reads this as "not found", although one candidate is listed.
- **Relation to the pilot.** This matches the aggregate pilot pattern: one PON detected, the app reported 0 logs / 0 added, and no 7-day retry appeared. That is a **hypothesis** about the pilot, not proof. The later FrameworkNotResponding and helper failures are unrelated to this path.
- **Expected.** The status says how many saved orders match, e.g. `… · 0 added · 1 matching.`
- **Fix** (`02-lookup-matching-count.patch`). Add the matching count to the status, and update the three exact strings in `tests/iguanaPanel.test.tsx`. Those updates only add the new count; they do not loosen any assertion.
- **Test.** `auditLookupFeedback.test.tsx`. The first case is a control and passes on both versions. The second fails on baseline and passes with the fix. This adds no prompt and no new step.

## Investigated, not patched (with evidence)
- **A shared delete is never confirmed.** `deleteSigEntry` ignores `{ error }`, and a `delete().eq('id')` that matches zero rows also returns no error. Code-level tombstones are permanent.
  - I tried releasing the code tombstone after a "successful" delete. That broke the existing test `does not resurrect an explicitly deleted code … (online=true)`: legacy local IDs can differ from the shared ID, so "no error" does not mean the shared row is gone. I reverted it.
  - Consequence (a deliberate trade-off): if a colleague later re-creates the same code, this device keeps hiding it until a technician saves that code locally.
  - Next step: have the delete return its affected rows (`.select('id')`), and only release the tombstone when the shared row is confirmed gone.
- **Pending edits are never retried.**
  - After a failed shared upsert, the entry stays in `pendingIds` and local data wins. Nothing re-sends it, so other devices never get the edit, and the "saved" toast does not say it was saved only on this device. Locally nothing is lost.
  - Smallest next step: re-send pending entries after a successful `fetchAllSigEntries`.
- **Renames on the shared copy (hypothesis).** An upsert with `onConflict: 'sig_code'` that carries an existing `id` under a new code would hit a primary-key conflict if `id` is the primary key. No schema is committed to the repo, so I could not verify this. The rename stays pending on the device.
- **Lookups during polling.** Find, Load recent and queue "find" are disabled or skipped while busy or polling. The guard at `runQuery` L79 drops a lookup without feedback, but only Framework-detect can reach that path, and only in a narrow window where polling starts during detection. No synthetic trigger was reliable enough to patch.
- **Bulk import count** returns the number of input rows, not the number of unique codes. The existing test asserts this on purpose. Cosmetic, so not changed.

## Scope checks
No FWDirect use and no controlled-order automation were added. No translation output changed. No schema or security change was made, and no prompts were added.

