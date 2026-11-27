# Engineering final chat (report not written; credits exhausted)

I found one new defect and proved it with a test, but credits ran out before I could test the fix or write the report.

**What I read and ran**
- I downloaded 1a0105c fresh into a temporary folder and read the morning handoff and Session-2 review. I also read the Windows helper's event watcher, `scripts/framework-observer.mjs`, the Windows smoke test and the entrypoint map.
- I ran a new test against the unchanged code: 2 new tests fail, and the 9 existing observer tests still pass. Nothing ran on Windows.

**Finding 1 (proven by test): when the accessibility layer fails to start, the observer also shuts down the Windows events that still work**
- Where: in `FrameworkDesktop.cs` `WatchEvents`, if the accessibility subscriptions fail, the helper reports `provider_unavailable`. In `framework-observer.mjs`, `native()` treats that as a dead helper. It closes the whole helper, including the Windows event hooks that still work, and falls back to polling for 30 s.
- Second trigger: the listener wrapper turns any event kind it doesn't recognise into `provider_unavailable`. So a new diagnostic event would also kill the listener.
- Expected: keep the Windows events, report the source as `windows_events`, and ignore unknown event kinds.
- Minimal fix (not applied or run):
  - Have the helper emit a new `uia_unavailable` instead of `provider_unavailable`.
  - Add that kind to the observer's list of known kinds; it sets the source to `windows_events` and closes nothing.
  - Change the listener wrapper so unknown kinds are skipped rather than mapped to `provider_unavailable`.
- Test: `audit-2026-11-27/tests/nativeEventDegradation.test.ts`, synthetic `TEST-PON-300:1`. Both tests fail on the current code. I haven't run them with the fix.

**Finding 2 (code reading only, unproven on Windows): likely reasons for zero button events**
- The accessibility Invoke listener only watches the remembered entry window and what sits inside it. Save/Done dialogs and popups are separate top-level windows, so their button events wouldn't be caught. The Windows event hook does follow owned windows, but it only reports a generic change.
- The Windows event hook range stops at 0x800E. It leaves out the Windows "object invoked" event (0x8013), which is a cheap second signal for button presses.
- The helper reports "ready" right away, before the accessibility listeners are set up. So "ready" doesn't show that the listeners are working, let alone that events are arriving.
- The smoke test only checks for "changed" events, never for "invoked". Even the fixture has never shown a button event arriving.
- Fixture extension for root:
  - Add a fixture button that raises Invoke inside the entry window and assert an `invoked` event.
  - Add a Done button in an owned popup window and record whether it is caught.
  - Add a plain Windows (Win32) button and record whether it is caught.
- Only a dummy-workstation check can show whether the real program delivers these events. Even then, a button event is not proof of a save.

**Not done**
- `docs/FUNCTIONAL-AUDIT-2026-11-27.md` was not written. Only the test file is saved in the lab, and nothing is committed.
- The fix is untested, and there is no patch file.
- I didn't check whether rich-text `paneRichEdit` fields can be read, or the manual PON detection miss.
- I found no new read-only installer entrypoint. The committed map still lists the local web host, named pipe and COM channels as unresolved leads, not proven contracts.

Continuing needs available credits.
