# FrameworkLTC workstation test plan

Wednesday, November 25, 2026

Use a dummy E-Rx in the same interactive Windows or Citrix session as the Sig-Assist connector. Record the Framework version, Sig-Assist build ID, session setup and whether the test uses an installed DevExpress accessibility setting. Start with a plain single-SIG order and a different dummy order for the wrong-order checks. Add a split SIG, a repeated PON, and an already saved/refused dummy record where the test environment has them.

## Ranked entry targets

| Rank | Field | Automation to check | Wednesday acceptance |
| --- | --- | --- | --- |
| 1 | SIG | Existing reviewed transfer. Rx Entry ships `DirectionsSigTextEdit` bound to `SelectedItem.Sig`. The E-Rx wizard also has a separate editable order SIG and message/default/linked/preview displays. | Verify only the active editable draft receives the selected text, including a split. Check exact read-back, Framework Preview Sig, and draft value after leaving the edit control. Test the case where RichEdit exposes only read-only TextPattern. |
| 2 | Quantity | Rx Entry exposes the static ID `RxEntryPrescription_QtyEdit`. Try writable ValuePattern first. | Whole and decimal quantities, units, rounding, lost focus and whether any dependent field changes. Test the approved value against the visible Rx Entry field before saving. |
| 3 | Days Supply | Rx Entry static ID `RxEntryPrescription_DaysSupplyEdit`. | Verify the approved value after Quantity and after moving focus. Capture whether Framework recalculates Days Supply on quantity or SIG changes. |
| 4 | Start Date | Rx Entry names `RxEntryStartDate` / `RxEntry_StartDate` and StartDate binding. | Verify the locale's actual format and calendar date, blank and disabled cases, and date/quantity behavior before and after midnight. Never derive a date from the current clock in this pilot. |
| 5 | Administration Times | Existing reviewed text transfer for a writable edit control. The Rx Entry directions view binds an editor to `SelectedItem.AdminTimes`. Separate administration schedule grids also ship. | Compare single and multiple approved times, delimiters, split association, the schedule after leaving the field, and a grid-only case. Read a selected split's schedule independently. |
| 6 | Delivery Date | `RxEntryPrescription_DeliveryDate` with delivery-state-related enablement. | Verify the selected date and whether selecting a different Delivery ID or batch recomputes it. Include before/after cutoff and a released/disabled dummy case. Require an explicitly reviewed date. |
| 7 | Delivery ID | `RxEntryPrescription_DeliveryId` is tied to a delivery schedule selector. | Capture control patterns and option ID, display text, selection and facility scope. A displayed string alone does not verify a schedule selection. Cover duplicate labels, unavailable IDs and dependent date changes. |
| 8 | D/C Date | Requires the active screen and actual identifier. A discontinue-date binding elsewhere in the installer is insufficient to identify the requested field. | Record the exact control and whether editing it changes scheduling or order status. Test blank, edited and cleared states in the dummy environment. |
| 9 | Checkboxes below D/C Date | Capture exact labels, IDs, control types, intended states and per-checkbox conditions. A verified two-state TogglePattern may be usable. | Confirm starting and desired state, enabled and indeterminate behavior, dependencies and that a second run leaves an already correct checkbox alone. Capture whether any checkbox takes an immediate workflow action. |

The ordering reflects daily entry value and evidence available from the supplied installer. It assumes the added fields receive values reviewed by a technician, including any site-dependent date or schedule decisions.

## Workstation screenshot reference

An existing refill-workflow screenshot shows the main Rx Entry form with the SIG area, Quantity, Days Supply, the header Start field, Delivery ID and Delivery Date. It also shows Admin Type and a separate Dates button in the directions section. Use this layout to orient the dummy run. The screenshot does not demonstrate writable accessibility patterns, commit-on-focus behavior or the active order's PON.

The shipped directions view binds the administration-times grid to the active split's `SelectedItem.AdminTimes`. The Dates button opens the split-specific Start Date/Time and Stop Date/Time dialog. The dialog's UI describes those values as interface communication fields. Verify the actual D/C Date panel before binding it to an action. Capture the full label and context for each checkbox there.

## Prototype behavior

Open the selected dummy order in Sig-Assist, approve the SIG, and expand **Fill Rx Entry fields**. Choose **Read Rx Entry fields** with the draft open in the remembered window. Available fields show their current values. The grouped action requires a single visible Rx Entry view containing the exact PON and a readable patient ID. The installer establishes the Rx Entry form's internal E-Rx message identifier, while availability of the PON in the accessible draft view is a Wednesday test. Record where the PON disappears if it is only available on the preceding page.

Enter the reviewed values and select the review checkbox. Dates use the shipped `MM/DD/YYYY` mask. Blank inputs skip a field. The pilot takes its values from this review form and does not calculate dates, quantities, or days supply. It applies Quantity, Days Supply, Start Date, and Delivery Date in that order. It stops when a pending field has changed, including when Framework recalculates a dependent value. If a group stops after a write, review the full draft and read it again before continuing. The SIG and administration-times actions are separate and now stop if the bound PON list or destination text changes after detection.

## Run order

1. **Read the active order.** Open the dummy E-Rx and choose or detect the entry window once. Record when the PON and patient ID are readable together with the target fields. Check the directions wizard, product selection and Rx Entry separately. For each field capture the exact label, AutomationId, class, control type, parent view, enabled/read-only state, and Value, Text, RangeValue, SelectionItem or Toggle patterns as applicable. Record presence and state for the D/C controls. Workstation diagnostics may include order text, so only export dummy captures.
2. **Exercise one reviewed draft edit at a time.** Approve a distinctive dummy value and compare the visible field immediately and after tabbing away. Repeat with the same intended value, an inaccessible editor and a normalized value. If Framework accepts and reformats a value, record the requested and actual formats before considering normalization support. Stop and review the draft whenever read-back is uncertain.
3. **Exercise a reviewed group.** Use Quantity and Days Supply first, then add Start Date and Delivery Date. Observe dependencies as Framework runs validation. Test a changed order, duplicate PON, stale field edit, split switch, a second window and a control that goes read-only after the preview. Confirm that execution stops on any unexpected change and reports fields already verified. Manually review the full draft and any dependent changes before saving in the dummy environment.
4. **Test save and refusal evidence separately.** If the site confirms supported API authorization and supplies the exact Framework message GUID, observe the queue marker, queue presence and linked prescription before and after a tester's normal dummy save. Include immediate dequeue, abandon, patient-handling, duplicate PON and revision cases. Observe an existing dummy refusal record separately from outbound response traffic. Missing queue state is inconclusive. Do not use a cancel/refuse/queue-completion endpoint for this check.
5. **Measure the passive collector and preview.** Check stability through focus and page changes, disabled or hidden controls, a stalled Framework window and inactivity after a read. Compare source, linked/default, technician-edited, split and saved directions as distinct values. Compare ordinary preview and structured preview against the site character-budget calculation. Check exact PON with independently matched facility, patient and source revision before pairing dataset rows.

## Automation and evidence

- Run the existing Windows synthetic smoke test with `node scripts/smoke-framework-desktop.mjs`. It exercises the helper against a dummy WinForms process and can run in GitHub Actions. It cannot establish which installed Framework controls expose writable patterns.
- Use **Export desktop diagnostics** from Framework detection help on the dummy workstation for UI Automation discovery. An explicit inspection records the supported patterns and current toggle state of accessible, visible checkboxes. For live entry tests, use the existing reviewed SIG/times buttons and the reviewed Rx Entry field group when the page binds it to the active order. Compare the actual draft after each case.
- Record case, build, active screen, field/pattern, same-order proof, requested dummy value, immediate read-back, value after focus moved, side effects, outcome, and time taken. A format or lookup assumption becomes a blocked case until verified. Use redacted logs or fixture data for durable results.
- The program should draft reviewed values through the Windows accessibility API. Keep prescription save and workflow actions with the technician. The framework-read integration remains a separate, approved test, and FWDirect remains excluded.

[FrameworkLTC read-only API audit](https://chatgpt.com/library?file_id=libfile_539f3c9391208191bf895b2cc4efb467&account_id=personal)
