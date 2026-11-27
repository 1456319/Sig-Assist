# Recording session 2 — deidentified review

Reviewed the session's manifest, both complete JSONL streams, all 405 PSR action
records/control stacks, and selected screenshots around technician comments.
Raw recordings and clinical identifiers remain outside this repository.

## Confirmed capture results

- Prototype v0.1.15, build `1e465879babb`, was actually used.
- Local journal: approximately 89 minutes; 1,295 workflow and 1,887 translation
  records. No reported file errors, dropped records, or session limit reached.
- PSR: 405 screenshots/actions, with 9 missed actions reported. Its main MHT
  inside the ZIP is the same byte length as the separately supplied MHT; the ZIP
  was sufficient for review. Screenshot retention clearly exceeded 25.
- Native journal: 250 observation records; 188 unsuccessful reads and 62 nominal
  OK snapshots. None contains a captured field value. No button-invocation
  records exist. Eight snapshots contain a PON, representing seven distinct
  identifiers. These are observations, not seven verified processed orders.
- Failure codes: 68 READ_LIMIT, 105 CURRENT_ORDER_UNAVAILABLE, 12 BUSY, and one
  each of CURRENT_ORDER_AMBIGUOUS, WINDOW_UNAVAILABLE and ORDER_CHANGED.
- Much of the session was idle. During the first active PSR segment, 34 of 77
  observation records were READ_LIMIT; during the second, 8 of 37 were READ_LIMIT.
  Typical limited reads lasted roughly 3.2 seconds. Idle unavailable screens
  should not be confused with failures while processing.
- Normal PON detection succeeded with one candidate on 12 of 13 requests; the
  other found no candidate. A screenshot confirms an on-screen PON during that
  failure. Reopening the queue was the technician's recovery, not a proven
  programmatic repair.

Zero file drops establishes file durability only. The native captured content
was inadequate for learning the complete processing workflow. The UI's generic
OBSERVING / saved-observation count overstated useful capture quality.

## Reader compatibility findings

PSR steps 196 and 219 expose named quantity/days-supply wrappers plus child
TextBox controls named PART_Editor that repeat the parent field's Name. The
v0.1.15 reader counts all matching nodes, rejecting nested aliases as duplicates.
Same-role ancestor/descendant aliases should resolve to the inner editor;
independent sibling fields must remain ambiguous.

The real application combines WPF pages, DevExpress editors and Win32/VB6 MDI
hosts. Most framework actions belong to one process, with a small number in two
others. Event availability needs separate diagnostics: a connected UIA listener
does not establish that button events propagated across these provider boundaries.

Raw whole-view traversal frequently exhausts the three-second budget before
useful values are retained. A future focused, bounded reader should prioritize
known current-page fields and validated inner editors, with explicit coverage
and unavailable reasons. Raising timeouts alone would increase interference.

## Technician guidance preserved

These are site workflow statements from the recording, not general prescribing
or legal rules and not yet authority to automate every affected field.

- Assisted living: written quantity or duration is required by this workflow;
  when both are absent, the demonstrated exception is Profile Only with 0.1 in
  quantity, days supply and total quantity written.
- The demonstrated split is a bulk routine/PRN split; Paxit splitting is a
  separate workflow. The technician identified a removable period after PRN.
- Duplicate administration-time rows are not acceptable. A day-shift start/end
  pair represents one range, not two doses. Bulk can retain a range such as
  7-3; the stated Paxit convention is 0701. Do not generalize from intermediate
  demonstration values such as duplicate 0801 rows.
- For products without a measurable amount per administration, the stated
  five-day-supply convention needs product/context qualification; Voltaren is
  explicitly excluded and must be calculated.
- For lidocaine patches, AM/on and PM/off describe application/removal times,
  rather than two patch applications.
- The sweeper example changes batch, dates and associated entry fields. Its
  target next-day state was demonstrated before midnight. This recording does
  not establish actual automatic defaults after midnight or a universal sweeper
  field policy; a before/after field matrix is still needed before automation.
- Always choosing the recommended option applies to the demonstrated dialog;
  it is not a general instruction to accept every dialog automatically.

## Immediate work

1. Collapse same-field nested aliases, retaining independent-field ambiguity.
2. Report field-bearing snapshots and button-event counts separately from
   screen-only snapshots and unsuccessful reads.
3. Add regressions for the wrapper/editor shape and PRN sentence punctuation.
4. Continue using PSR beside the recorder until live fields and actions are
   demonstrably captured. Do not require the technician to reintroduce checkpoints.

The complete original evidence stays private. No raw screenshot, patient name,
PON, address, phone number or private server/path is included here.

## v0.1.16 corrective checkpoint

The next prototype collapses only same-role nested field aliases, preserves
sibling ambiguity, and reports fixed unavailable-reason codes without provider
exception text. A native synthetic wrapper/editor regression exercises both
successful alias resolution and independent-field rejection.

The general field walk also stops at known detail/selection grids instead of
descending through every cell. The existing bounded detail-grid PON reader stays
separate. A synthetic 800-cell neighboring grid checks that ordinary field capture
is not starved by unrelated table traversal. The read timeout is not increased.

The recorder now distinguishes VIEW_ONLY and IDENTITY_ONLY from actual readable
fields. The manifest/UI report field snapshots, button events, screen-only
snapshots and unsuccessful reads separately. This corrects the misleading health
display; it does not establish that the live provider's traversal/event problems
are solved. The independent dataset's displayed sample count is not proof of
native field capture.

A narrow clinical-output fix removes the hanging period from `PRN. IF` before
output exclusions are applied, preserving the complete condition and source text.
Its regression uses a synthetic wound location and no patient data. Other site
procedure notes remain documented rather than silently becoming universal rules.

Native Windows execution, final full checks and the next live capture are pending
at this intermediate checkpoint. The raw PSR/clinical logs are not committed.
