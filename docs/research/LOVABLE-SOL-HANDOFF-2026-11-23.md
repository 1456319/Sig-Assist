# Sig-Assist audit assignments for Sol 6.1

Review baseline [prototype at 9304ba0](https://github.com/1456319/Sig-Assist/tree/9304ba0f35b7ae04a3a8cb0dce71bac0bfa043ac). Each lab has its full brief and synthetic acceptance cases. Sol owns reproduction, review and implementation. The separate SSI validation branch contains additional sliding-scale work.

| Priority | Finding | Verification at dispatch | Confirmation Sol should require |
| --- | --- | --- | --- |
| 1 | Treatment translation loses an explicitly different application site. | Reproduced through `translateClinicalSig` on the pinned source. Changing the last clause from left heel to right elbow produced identical cards. Only the ordinary split finding appeared. | Preserve distinct sites, laterality, actions and qualifiers on their own cards. Keep genuinely duplicate same-site instructions working. Verify combined display and copy if more than two parts are needed. |
| 2 | Administration-time text and approval survive a change of split part. | Source trace. Queue passes order-wide times. The transfer dropdown changes the part ID alone. The outbound request uses the previous time draft. | Start with two approved parts. Approve A's times, switch to B and verify that A's approval cannot authorize B's transfer. Test the single-part path and check the native destination on a dummy workstation. |
| 3 | A passive Framework observation can be paired to the wrong incoming order when a PON is reused. | Source trace. The desktop response supplies PON and SIG. The panel can pair from one loaded row or a PON-only cache. Its last-observation key omits the source revision and split. | Simulate reused PONs, unchanged SIG across a revision and delayed lookups. Assert stored provenance, stage and row count. Preserve unpaired observations when the source cannot be established. |

## Lab threads

| Lab | Assignment message |
| --- | --- |
| [Audit Lab](https://lovable.dev/projects/766dd189-ff18-4f49-b2d7-f97e8726f577) | `umsg_01m85vzpjhebqv74jwprfbt7gf` |
| [Engineering Lab](https://lovable.dev/projects/22a38ec9-2439-4854-a171-b32ba96dd019) | `umsg_01m85vzvqwfzvspxw3t0z0fqk3` |
| [QA Lab](https://lovable.dev/projects/f6775d54-18d5-4a10-8619-e419ba04dea2) | `umsg_01m85vzx9be8r96ret15cgrm7e` |

## Reproducing the treatment defect

Use drug `Zinc oxide cream` and synthetic directions `Cleanse left heel with saline, pat dry, apply cream daily and as needed AND apply to right elbow as needed for itching.` The second card at baseline reads `TO LT HEEL:CLEANSE W/SALINE,PAT DRY,THEN APPLY ZINC OXIDE PRN FOR ITCHING`. Substituting `left heel` for `right elbow` in the last source clause gives the identical output. Inspect `resolveTreatmentOrder` around lines 134–164 and the primary SIG assembly in `clinicalEngine.ts` around lines 224–262.

For split transfer, start at `OrderQueueView.tsx` lines 328–336 and `FrameworkDesktop.tsx` lines 125–197. For passive pairing, start at `SigDatasetPanel.tsx` lines 47–131, `frameworkSigDataset.ts` lines 25–37 and `FrameworkDesktop.cs` around line 1404. Compare each lab's claimed results against the pinned files and rerun synthetic red/green cases before accepting a repair.
