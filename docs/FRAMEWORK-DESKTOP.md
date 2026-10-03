# Framework desktop integration (pilot)

## Daily workflow

1. Extract the complete current ZIP. Start `Start-Iguana-Connector.bat` **inside the same Windows/Citrix session as Framework**. A connector on a local PC cannot inspect fields inside a remote Citrix application.
2. Open the E-Rx in Framework and click **Detect open E-Rx**. Multiple Framework instances can remain open. Detection checks all of them and prioritizes the visible E-Rx Work Queue wizard, excluding other instances' triage queues and hidden cached wizard pages. It reads the detail grid beyond the initial visible rows; it may briefly scroll those details and restore their original position. Keep the order open during detection. One exposed PON fills the search automatically. **Two or more PONs show a warning and a choice of PON to find; they do not disable sending.** Choose the matching patient, drug and order from the results. If no PON is exposed, normal lookup still works.
3. Read the prominent **E-Rx administration times** panel beside the translation. These are exact incoming structured values. An absent time is not inferred. **Copy incoming times** is also available.
4. Correct the final SIG and check its review box. In **Send to Framework**, confirm the intended patient, drug, PON and destination. Click **Send approved SIG to Framework**. For split orders, choose the reviewed order part to send.
5. If the SIG field was not identified automatically, use **Choose Framework SIG field**. Click directly inside the SIG text box in Framework within eight seconds, then return to Sig-Assist. Selection only reads the field; check its displayed current text and click Send separately. Sending with an absent or expired target starts this same selection step.
6. The helper fills that exact field and reads back its text. Verify Framework Preview Sig, administration schedule, quantity and days' supply. **You save the prescription in Framework.** Sig-Assist does not invoke save, submit, dispensing or queue-processing actions.
7. **Transfer administration times** provides an editable times draft with separate technician approval. Choose a times text field in the same way if necessary. Grid/multi-row schedule editors need a screen-specific mapping or manual entry.

## Technician authority

As requested, the technician decides which order receives the approved text. A different or multiple detected PON is a warning, not a sending lock. Missing accessible patient/facility/drug metadata does not prevent transfer. A changed destination's current contents may be replaced by the approved text; a warning reports that change. The application still requires review of the exact current SIG, respect for saved exclusions/cancellation/source revisions, and explicit destination confirmation.

Technical failures still need correction: a closed/replaced window, a removed control, an inaccessible/read-only field or a different Windows session cannot accept a transfer. These are not order-identity vetoes. The helper never sends keystrokes or pastes into an arbitrary focused window. A technician-selected field is bound by process start time, window and control runtime ID. An uncertain write/read-back result is reported without automatic retry or rollback.

## Installer findings and compatibility

The Framework 3.3.363 installer was inspected statically; no vendor application code was executed. Its integration assemblies contain `LoadScreen`, `OpenLiteralOrder` and `ProcessQueueMessage`. Those are inbound operations, not a verified selected-order notification or SIG setter. `Vb6ObjectProxy` is an internal bridge. This implementation does not call them.

The managed UI contains `ERxWorkQueueDirectionsView`, its `OrderSigTextBox` and `LinkedSigTextBox`, and `RxEntryView` / `PrescriptionTabDirectionsView`. These names do not establish a public integration contract or prove runtime accessibility. Order/linked-directions editors are not automatically treated as the prescription SIG destination.

The separate .NET Framework helper uses Microsoft's Windows UI Automation. It inspects only `FrameworkLTC` and `SoftWriters.FrameworkLtc` processes in the current session. PON detection accepts exact labels, labelled PON text and paired Title/Value detail rows. Known `ERxWorkQueueWizardView` / `ERxWorkQueueView` controls identify the opened E-Rx; visibility is inherited through the control hierarchy so hidden pages cannot supply stale order data. The visible wizard's `ERxGrid` is read through `GridPattern.GetItem`, with `VirtualizedItemPattern.Realize` when supported and its scroll position can be restored. If rows remain unavailable, a bounded `ScrollPattern` traversal reads the active details only, restoring the viewport in a `finally` block. It never selects queue rows. Limits are 512 detail rows, 40 pages and a shared 12-second expansion budget; incomplete reads and restoration failures are reported. Detection/diagnostic helper timeout is 35 seconds. Target selection and sending do not expand or scroll grids.

Automatic destination matching requires exactly one visible, enabled, writable Edit control labelled `SIG`, `Prescription SIG`, or `SIG code` within the open wizard when identified; times use `Administration times` or `Admin times`. The technician's explicit field selection still supports editable text controls in any Framework instance with other labels. Clipboard contents, database rows and OCR are not used.

**Actual Framework screen compatibility needs an on-site check.** Windows tests use synthetic controls to exercise detection, read-back, multiple-PON warnings with sending allowed, edited destinations, read-only controls and explicit target selection. A separate five-process WPF fixture reproduces an open wizard, a triage queue, hidden stale pages, and an 80-row detail grid exposing only 30 rows at once, with its PON at row 67. It tests indexed reads, scrolling/restoration, provider failures and two open E-Rx windows. These tests do not establish compatibility with every Framework screen or verify its clinical effects. UI Automation is not a transactional vendor API; do not switch orders while sending.

## Diagnostics and setup

If detection or selection fails, keep the relevant Framework screen open and use **Framework detection help → Export desktop diagnostics**. The JSON captures process/window identity and accessible control IDs, parent IDs, depth, labels, types, inherited visibility, values and editability, with scan-limit/error flags. Schema version 2 also identifies open-wizard windows and includes detail-grid patterns, advertised row/column counts, initial and collected rows, read method, page count, completeness, restoration status and provider errors. Password controls are omitted. **The export can contain patient and order text.** It is not uploaded automatically. Share it with which screen was open and which field should receive the SIG; this supplies the runtime evidence for a screen-specific mapping.

The helper is compiled with Windows .NET Framework 4's `csc.exe` into the user's local application-data folder when first needed and cached by source hash. Node invokes it directly. No PowerShell, administrator installation or extra download is used. A missing compiler or an application-control block is reported explicitly. It does not disable or bypass application control; ordinary lookup/copy remains available.

The bridge holds short-lived opaque target tokens in memory. They expire after five minutes, are invalidated by a fresh detection/field selection and are consumed before sending. Successful read-back supplies a fresh token. The page cannot replace the saved process/control selectors. Local desktop endpoints require same-origin JSON and grant no cross-origin access.

Iguana access remains `GET /api_query` only. Desktop transfer is a separate local operation. `readOnly` in the legacy health response is explicitly scoped to the Iguana upstream.

Primary API references:
- https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/obtaining-ui-automation-elements
- https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/implementing-the-ui-automation-value-control-pattern
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.gridpattern.getitem
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.scrollpattern.setscrollpercent
