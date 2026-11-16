# E-Rx automation: active priority and observation plan

Decision recorded 2026-11-15 (America/New_York), against prototype v0.1.6 / 9ea8dc8.

## Priority change

E-DC end-to-end validation is deferred because the technician currently has no E-DCs available. Preserve the reader, advisory evidence, and unfinished refusal / DocuTrack write work. Resume from the [E-DC disposition evidence](EDC-DISPOSITION-PILOT.md), [DocuTrack workflow](DOCUTRACK-EDC.md), and November E-DC audit when an appropriate test case is available. Lack of E-DC samples does not block E-Rx/SIG work.

The active objective is reducing manual E-Rx entry: follow the technician's selected order, prepare the translation, populate reviewed fields, compare the Framework result, and collect the technician's judgment and corrections. FWDirect remains excluded.

This document changes the work priority and specifies the next implementation. It does not ship a continuous observer or additional clinical write actions.

## What the current program supplies

- A remembered Framework entry window, bound to the selected process/window in the same Windows/Citrix session.
- PON detection, including virtualized detail-grid recovery and multiple-instance handling.
- Read-only Iguana lookup for original directions and structured administration times.
- Separate approved SIG and times transfers to an identified or explicitly selected editable field, with text read-back.
- General technician feedback from the first screen, local persistence/export, severity, observation time, optional time lost, and bounded diagnostic metadata.

See [Framework desktop integration](FRAMEWORK-DESKTOP.md) and [technician feedback](TECHNICIAN-FEEDBACK.md).

The current detection / inspection path can activate the entry window, scroll detail grids, realize cells, request focus during recovery, and temporarily enable accessibility support. Repeated calls to this path are unsuitable for passive observation while a technician works.

## Use installer evidence and live observation together

Existing installer analysis identifies Framework 3.3.363 and candidate UI classes such as ERxWorkQueueWizardView, ERxWorkQueueDirectionsView, RxEntryView, and PrescriptionTabDirectionsView. OrderSigTextBox and LinkedSigTextBox are investigation leads; their presence does not establish that either is the prescription SIG destination.

LoadScreen, OpenLiteralOrder, ProcessQueueMessage, and Vb6ObjectProxy are integration/internal leads from that analysis, not verified setters or an event stream for the selected order. Reinspect their callers, signatures, validation, and state transitions before assigning a capability. An integration method name alone does not establish a network endpoint or a supported contract.

Targeted static review should prioritize:

1. The E-Rx wizard's navigation and command handlers: opening, linking, directions, schedule, product selection, quantity/day supply, review, completion and cancellation.
2. Data bindings and control identifiers for each field, plus the model/validation rules that enable the next action.
3. Existing external integration interfaces and their actual callers, separating reads, preparation, and persistent side effects.
4. A compatibility map between installer version and the installed client's version/control patterns.

Static analysis can explain possible paths. It cannot alone establish the site's current product catalog, SIG expansions, route mapping, configuration, permissions, overrides, or the technician's reasons for choosing a path. Those require observed examples.

This turn rechecked the current helper source and existing installer findings. A fresh full-MSI transfer was not completed: the available 612,577,280-byte MSI exceeds the connected Drive tool's 268,435,456-byte download limit. This does not invalidate the previous analysis or block the observer design. Prefer existing extracted assemblies/source for further targeted review; do not ask the technician to reinstall the vendor application.

## Planned passive workflow observer

Run beside Framework in the same Windows/Citrix session. Select one entry window, then use explicit Start / Pause / Stop controls with a visible recording indicator. Retain the selected-instance boundary; do not jump to another Framework instance when the selected window closes.

Use scoped Windows UI Automation property/structure/invocation events where the provider exposes them, coalescing events into bounded state snapshots. Supplement missing events with a slow, bounded visible-tree refresh or a technician checkpoint. An event signals a possible change, not a completed save or a verified business outcome.

Passive mode must not invoke controls, set values, move focus, activate windows, scroll, realize offscreen cells, change Windows accessibility settings, inspect the clipboard, take screenshots, capture keystrokes, or query additional servers. Read only currently exposed controls and supported non-mutating properties. An unreadable field is recorded as unreadable; it does not trigger the active PON recovery path.

Subscribe/unsubscribe within the selected-window boundary, include only explicitly related dialogs, debounce bursts, cap capture duration/event count, and stop cleanly on process exit/provider failure. Missing/dropped events and partial snapshots must be visible in the report.

Default shareable output should include elapsed times, known screen/control identifiers, control types/patterns, field presence/editability, transitions, and fixed failure codes. Arbitrary labels, window titles, automation IDs, names, values, errors, and provider text must not be copied into this metadata format without an allowlist: any of them may contain identifying text.

For complete value-level examples, use confirmed synthetic orders/residents. Keep clinical/source values on the workstation; only technician-reviewed, intentionally synthetic examples are shared. Giving real residents fictional names alone is not sufficient to make their medication histories or free text synthetic. A reviewed export can consistently map synthetic PONs/residents to unique session tokens so the same order remains traceable through its steps.

The current desktop diagnostic export is broader and may contain patient/order text. It is not the observer's privacy boundary and must not be substituted for the default shareable report.

## A small, useful demonstration set

Start with one ordinary non-controlled scheduled medication, from opening the E-Rx through its completed workflow. Add two or three available variations: PRN, an edited/complex SIG or split order, and a case involving an administration-time or batch choice. These are a starting sample, not a claim of complete workflow coverage.

For each case retain:

- Synthetic incoming order and expected selected product / directions / schedule.
- Screens and field changes, including Framework defaults and automatic recalculations.
- Exact translated code and Framework Preview Sig after expansion; a textbox match alone does not validate the expansion.
- Quantity, days' supply, effective dates, delivery/batch choice, and any technician correction.
- Completion versus abandonment, observed result, and what the technician found tedious.

Ask about reasons at meaningful decision points or after the order, without interrupting every click. An optional explanation should be accepted with either answer.

## Implementation sequence after observation

1. Follow the selected E-Rx and present its translation with fewer repeated detection/lookup steps. Handle order transitions and source revisions explicitly.
2. Add screen-specific SIG/schedule mappings and populate the reviewed fields with one technician action. Read back the fields and present the expanded Framework result.
3. Add product and remaining field preparation from verified bindings and observed site rules. Present plausible product candidates when intent is ambiguous and accept the technician's choice.
4. Add batch/time rules from the supplied routing guidance. Establish which source timestamp governs each rule: receipt, processing, effective date, and cutoff are distinct. Check boundaries with a test clock; do not wait for real cutoff times to exercise them. Do not invent missing facility-to-route mappings.
5. Extend navigation and completion only when the installed workflow and its success outcomes have been established. Preserve explicit technician control of the intended action and avoid automatic repeat submissions after an uncertain result.

## Trust the technician and learn from corrections

Use a clear acceptance question with Yes / No and optional comments. On Yes, distinguish Worked as shown from Acceptable after a correction. Show severity and time independently: a corrected acceptable result can still reveal an important original error.

Allow the technician to resolve observable identity/clinical/workflow uncertainty and record the choice. Missing metadata or an incomplete historical lookup is not an automatic veto on an approved observable decision. Actual closed windows, inaccessible controls, and unavailable write mechanisms must be reported concretely rather than presented as policy refusals.

Record machine text read-back, observed Framework preview, and technician confirmation as separate evidence. Do not call a technician-confirmed completion machine-verified. An uncertain write should remain visible for inspection rather than causing a blind retry.

Use PILOT_DIAGNOSTICS_REVIEW_BEFORE_PRODUCTION for development-only capture/diagnostic hooks. Keep useful operational feedback; review collection scope, retention and experimental hooks before production.

## Observation access

A Drive folder is a place to exchange files; it does not provide live access to the technician's Windows/Citrix session. No new observation/session link was attached to the priority-change message. Once supplied, check whether that link provides a recording, browser-accessible session, or another supported surface. A local observer is the independent fallback; it must be implemented and packaged before asking the technician to run it.

## Primary implementation references

- Microsoft: https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-events-overview
- Microsoft: https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/use-caching-in-ui-automation
- Existing installer findings and runtime limits: FRAMEWORK-DESKTOP.md
- Metadata-only probe behavior: ../pilot/workstation-probe/README.txt
