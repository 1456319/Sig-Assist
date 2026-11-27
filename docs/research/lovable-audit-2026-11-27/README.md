# November 27 lab evidence

These are external reports and proposed patches, not an installation bundle.
The coordinator's [audit decisions and validation](../LOVABLE-AUDIT-2026-11-27.md)
are authoritative for what was actually integrated. Do not reapply these patches.
All examples supplied to the labs were synthetic; private evidence is excluded.

| Evidence | Coordinator treatment |
| --- | --- |
| clinical-report / clinical-candidate | Treatment-course repair accepted with simpler extraction order. Glucagon dose-conversion candidate withheld. |
| engineering-response | Credits exhausted before a report/patch. Event-degradation and unknown-event regressions independently reproduced and repaired; Windows verified. |
| qa-report / qa-candidate | Reload-to-ten defect reproduced and repaired; browser_cache attribution rejected. |
| clinical-integration-report / candidate | Three course-scoping defects reproduced and repaired. Additional scale fallback-header issue reproduced/repaired by coordinator. Lab dataset timeout not reproduced in the coordinator's full checkout. |
| qa-integration-report / controls | Positive recovery/split/original-evidence controls re-run, with cleanup corrected to the real storage API. Adjacent reload-to-low ordering defect found/repaired independently. |

Runnable checks are in `tests/workflowObserver.test.ts`,
`tests/ratingColdReload.test.ts`, `tests/ratingRecoveryControls.test.ts`,
`tests/translationRatings.test.tsx`, `tests/treatmentSharedCourse.test.ts`,
`tests/maximumCourse.test.ts`, `tests/nov27IntegrationScope.test.ts`,
`tests/scaleFallbackSchedule.test.ts`, and the native Windows smoke script.
The `.test.ts.txt` files here preserve candidates as evidence only.

No external turn remains pending. Clinical and engineering reported exhausted
credits; QA finished its requested checks. No purchase or upgrade was made.
