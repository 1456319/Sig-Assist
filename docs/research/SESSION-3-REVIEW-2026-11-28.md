# Recording session 3

The live workstation ran v0.1.20, build `c8940f3cf7c9`. The technician started
and stopped the automatic recorder successfully. The PSR capture ran from
11:25:44 p.m. to 12:02:06 a.m. Eastern, and automatic recording ran from
11:43:42 p.m. to 12:02:36 a.m. Eastern. Both timelines cross midnight. Only the
119 overlapping PSR records, including 88 Framework actions, can be used
to assess missing native coverage. All 88 Framework actions were attributed
to one process in PSR.

## Native recording and PSR

| Check | Session 3 |
| --- | --- |
| PSR | 304 action and comment records with 304 images, including 24 comments. PSR reported 20 missed actions. |
| Local journal | 300 workflow records and 157 translation records. Contiguous sequence through the explicit technician stop. The manifest reported no file failure, overflow, or limit. |
| Native records | 49 observations, including 4 with nonempty fields, 18 without nonempty fields, and 27 failure records. |
| Read failures | 22 READ_LIMIT, 4 BUSY, and 1 ORDER_CHANGED. The recorder coalesces repeats, so 22 is the number of logged READ_LIMIT records. Their median request duration was 3.31 seconds. |
| Order identity | One queue snapshot contained a PON. The four field-bearing snapshots were unpaired. |
| Button events | Zero. At least two overlapping PSR actions directly name the Done control. Another technician comment describes a Done click. |

The four field-bearing snapshots were on Directions. Each had nonempty
message SIG, structured SIG, drug and batch fields. The message and structured
values agreed within each snapshot. The default field was blank in all four.
A separate Directions snapshot flagged two candidates for the batch field.
No snapshot captured a current draft SIG or a prescription-entry quantity,
days supply, delivery, start date, or administration-time value. The four
explicit Detect open E-Rx operations each returned one candidate and the
corresponding order lookups reported success. The separate passive reader
needs its own reliable association.

PSR step 212 shows Next and the next native record contains Directions fields.
Steps 215–220 show activity in the prescription-entry surface, where the native
records return READ_LIMIT. The same transition repeats after steps 244 and 282.
The late sequence at steps 284–303 shows date and quantity field activity and
the Done and association-prompt actions during the longest failed-read interval.
The final native record returns to a view-only work queue. Session 2 had zero
field-bearing snapshots, so Directions coverage improved. Prescription-entry
coverage and button-event delivery remain unverified by the observer. A final
queue snapshot does not establish that any particular prescription was saved.

## Technician workflow captured in PSR

- Therapeutic interchange can replace the editable SIG with placeholder
  directions. The technician checks whether the interchange includes dose
  changes, replaces the placeholder with the reviewed SIG, and retains the
  interchange annotation for the facility's MAR. Product selection and dose
  equivalence require technician review.
- F9 in the administration-times box exposes facility-specific time codes.
  The technician uses that display to learn the facility's shift format and
  still checks it against the E-Rx. In one separate daily example, two displayed
  morning times represented one administration with a morning label. The
  technician used the facility's one-minute-offset code.
- In the demonstrated date editor, changing the dispensed date moved the start
  date. Set dispensed and delivery first, then restore the ordered start date
  and verify the resulting fields. A highlighted formulation-change instruction
  prompted the technician to go back and confirm the prior order before linking
  and discontinuing it.
- The technician explicitly declines the **post-save prescription association**
  prompt in this workflow. This is a specific prompt during E-Rx entry.
- The later example uses a **regular PM batch**, with the current calendar day
  excluded from the demonstrated three-day dispensing window. A later ordered
  start can shorten the included interval further. The example's quantities
  are derived from that order's daily dose and the included days. Keep this
  case distinct from the clarified **Paxit sweeper** target, which uses the
  sweeper batch date for dispensed, start and delivery, the full ordered
  three-day quantity, days supply 3 and a delivery ID beginning with 9.
  Confirm the scope of the regular PM rule before translating it into an
  automatic calculation.

## Next verification

Use the late prescription-entry transition as the first fixture for the
bounded Windows reader. Record an allowlisted budget stage for scope discovery,
editor enumeration, field reads and identity verification so READ_LIMIT
locates the cost. Keep the existing ambiguity and changed-order safeguards.
Add a real UIA Invoke fixture for a button under the mixed host and for an owned
dialog, with durable subscription and fallback status in the diagnostic log.
Then replay one dummy E-Rx through Directions, editable entry and Done with
both tools running from the beginning. Compare saved native fields and button
events to PSR. An invocation is evidence of the action, with successful save
verification requiring independent evidence.

The review used both complete journal streams, the manifest, all PSR action
metadata, the 24 technician comments and selected image checks. Original
recordings and clinical identifiers were kept private. This checkpoint records
the field observations and workflow. Prototype runtime remains at the verified
v0.1.20 build.
