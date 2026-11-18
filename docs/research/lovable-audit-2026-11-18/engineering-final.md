# Engineering final response

Now I'll write the reproducing tests first (connector side), then run them on the baseline to confirm they fail.

Now the connector fix.

Credits ran out partway through this audit. I reproduced and fixed two defects in the connector on the current checkpoint. Today's report is still only a short first checkpoint, and the latest files aren't committed yet.

**Baseline:** prototype at `11fa35b7` (runtime `45ecfa4e`, v0.1.11), downloaded read-only to a temporary folder. The six related test files passed 110/110 on Linux. The pharmacy repo wasn't changed, pushed or deployed, and all test data is synthetic.

**Yesterday's findings at this baseline:**
- **Exact detected PON:** fixed in the source. I didn't rerun yesterday's test against it.
- **Slow native observer and walking siblings twice:** fixed in the source. The observer now reads properties in bulk, walks through hidden layout wrappers, and wraps sibling groups only once. I didn't measure it on Windows.
- **Frozen Framework window, with no pause between retries:** still present. There is no frozen-window check and no pause anywhere in the code. It is defect 1 below.

**Defect 1, reproduced on Linux: background reads keep hammering a frozen Framework window.**
- **Trigger:** a background read times out at 8 s.
- **Now:** the recorder (every 3 s) and the dataset collector (every 5 s) each start a new reader process on every poll. In the test that is 7 launches where 1 is expected. Each one occupies the single shared reader for up to 8 s. The technician's own Detect then waits behind it. The collector also shows only a generic failure, with advice to "choose the entry window", which is wrong here.
- **Fix:**
  - After a timeout, background reads pause for 10 s, then 20 s and 40 s, up to 60 s. A successful read clears the pause.
  - Detect is never paused.
  - A timeout is now reported as its own status instead of a generic failure.
  - The native reader asks Windows whether the window is frozen before reading it, without sending Framework a message. That gives a separate "Framework not responding" status, which the recorder now keeps instead of turning it into a general failure.

**Defect 2, reproduced on Linux: the collector loses its turn while the recorder is reading.**
- **Now:** a dataset read that arrives during a recorder read is turned away as busy. That poll is lost. While both run, roughly half of the collector's chances may be lost (my estimate, not measured), so short-lived orders can be missed.
- **Fix:** the dataset read waits for the recorder's short read to finish. Detect still goes first.

**Tests:** five new synthetic tests. Four fail on the baseline and the fifth guards the Detect priority rule. With the fix, all five pass, along with the existing desktop, dataset-reader, recorder and connector tests (101/101).

**Found in the code, not run on Windows:**
- The new passive SIG reader skips everything under a hidden layout wrapper. It also rejects any field whose parent container is reported hidden. That is the same pattern that was already fixed in the observer. If real Framework screens wrap the SIG or PON this way, passive collection will always report them as unavailable.
- The PON grid is read in only one accessibility view. Detect falls back to a second view when the first is empty; the passive reader doesn't.
- For every element it visits, the reader looks up each label separately instead of in bulk. That could use up its 3-second limit on a large screen.
- If a source lookup in Iguana fails once, that PON is never looked up again for the rest of the collection session. This one can be tested on Linux, but I didn't write the test.

**Saved in this lab but not committed:**
- `audit-2026-11-18/01-passive-helper-backoff-and-scheduling.patch`
- `audit-2026-11-18/tests/passiveHelperScheduling.test.ts`
- A change to this lab's type settings so the old preview builds again. I relaxed the same two strict settings as before. I haven't confirmed the build passes.

Only the first checkpoint of `docs/FUNCTIONAL-AUDIT-2026-11-18.md` is committed. The full report isn't written.

**Not done:**
- The test-window change that freezes the window more than 5 seconds, to prove the frozen-window check on a Windows runner. Without it, the native part of defect 1 is untested.
- A clearer status message in the collection panel for "not responding" and "paused".
- The rest of the planned review: whether a passive PON reading belongs to the current order, the race when lookups are slow, and fields where the reader returns only part of the text.
- The installer review. It produced no new, concrete way to read Framework or DocuTrack that excludes FWDirect, so I didn't revisit it.

Continuing needs available credits. The first step would be committing the saved files, then finishing the report and the frozen-window test.

