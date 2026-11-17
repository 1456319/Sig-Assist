# Final audit 2026-11-17 — native observation, helper/session/recording, exact PON lookup

Status: IN PROGRESS (checkpoint 1). Baseline: Sig-Assist `prototype` @ b853b88cb7bc6c96f262d06b8240c434f0174a13, fetched as a read-only tarball into /tmp. Pharmacy repo not modified. Synthetic data only. FWDirect excluded.

Baseline check: `vitest run tests/iguanaPanel.test.tsx tests/frameworkDesktop.test.ts tests/pilotJournal.test.ts tests/iguanaBridge.test.ts tests/orderSearch.test.ts` → 90/90 pass on b853b88 (Linux).

## Candidates under verification
1. Detected-PON lookup treats a substring sibling (e.g. `X:10` for detected `X:1`) as a match: suppresses the "Search the last 7 days" offer and lists only the wrong order. (IguanaConnectorPanel.tsx ~L90, orderSearch.ts)
2. Recorder keeps launching UIA helpers every ~9 s against a non-responding Framework; no passive hung-window check, no backoff. (iguana-bridge.mjs observe(), FrameworkDesktop.cs RememberedRoot/Observe)
3. Observe sibling rotation walks every sibling twice when scanOffset >= sibling count. (FrameworkDesktop.cs ObservationChildren)
4. Passive current-PON read design (no Detect scrolling/recovery).

