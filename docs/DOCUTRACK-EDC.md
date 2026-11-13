# Richmond E-DC pilot · v0.1.5

Open DocuTrack and Sig-Assist in the same Windows session. In DocuTrack select **Folders → Richmond Pharmacy → Order Processing → Process**. Make the folder grid visible. In its Column Chooser show **Document Type** and **Text 3**. Clear filters that might hide E-DC orders, or filter specifically for E-DC Order. In Sig-Assist open **Order Queue → Show E-DC PONs**. The button reads the selected folder through Windows UI Automation using the technician's session.

| Field | How to use it |
| --- | --- |
| Document Type | Both E-DC and E-DC Order qualify. A supplied status must be Process. |
| Text 3 | The prescriber order number (PON). Find PON searches saved orders and, when available, requests matching Iguana records. Leading zeroes and suffixes are significant. |
| Source / Text 4 / List 2 | Facility source, resident, and displayed route. Compare with the actual pending NewRx. Delivery cutoffs do not apply to an E-DC. |
| Document number | Compare the grid number with the original number stamped at the bottom right of the E-DC. Use the stamped number in the Framework refusal reason. A copied document may omit its stamp. |

The list shows the time, source, row count and unreadable count for each snapshot. Refresh after a folder change or a refusal. An empty or filtered grid cannot clear an order for processing. If the live reader cannot establish the selected folder or obtain the required columns, it explains where it stopped. **Save E-DC reader report** records provider and column counts without row contents. A new scan or import replaces the preceding snapshot.

**Use copied rows or document text** accepts tab-separated headers and rows, or the selected text of one Discontinue Rx. In the Richmond Process folder, right-click the document list and choose **Copy All Rows**. The 6.6.4 client includes headings in this command. Paste into Sig-Assist on the workstation, confirm the folder, and choose **Read copied documents**. Check the displayed counts against the DocuTrack view. Some exported pages contain outlines in place of selectable text. Use their folder rows and verify the printed number in the viewer.

### Richmond workstation evidence

The paired Process and Triage captures exposed document rows as children of a Windows accessibility tree. Process exposed 22 column headers, including **Text 3** and **Doc. Type**, and 22 cells in each of two sampled rows. Triage exposed five headers and five cells per sampled row. Neither capture exposed a standard grid provider. Both contained a **Process** toolbar label and neither exposed a selected folder through the standard selection pattern. The follow-up workstation checks identified the selected Process and Triage nodes under Richmond Pharmacy → Order Processing using Windows Active Accessibility. Both checks found exactly one matching folder control. The live reader now checks that selection before and after reading. In the 6.6.4 installer, the header and data cell accessibility providers both use the column caption. The reader matches captions exactly and skips rows with missing or ambiguous cells. This provider exposes a list of rows without a reliable queue total. Compare the on-screen count and a dummy E-DC PON on the workstation before relying on the results.

The 6.6.4 client installer contains three relevant implementations. In `IS.OMS.Client.WorkflowWorkspace`, `SearchFolderTree._searchFolderTree_AfterActivate` associates the active folder with its cabinet and business unit. In the shipped Infragistics tree, `TreeAccessibleObject.GetSelected` returns the active node. `NodeAccessibleObject.Navigate` maps left navigation to its parent. The pilot folder check tests whether the workstation exposes that path and recognizes only the expected folder labels. In `IS.OMS.Client.ResultsGridPane`, the **Copy All Rows** handler calls `ItemCollectionGrid.Copy(false, true)`. The implementation in `IS.OMS.Client.CommonUIElements` writes the display headings and tab-delimited rows to the Windows clipboard. A technician initiates that command.

## Check an unprocessed NewRx

1. With the E-DC list open, use **Find PON** or **Detect open E-Rx**. An exact PON match shows an advisory. A facility conflict or more than one plausible candidate calls for individual comparison. An Iguana CancelRx supplies a separate advisory even when there is no DocuTrack snapshot. The SIG review controls remain available.
2. Open **Prescriptions → E-Rx Triage Manager** in Framework. Confirm that the intended NewRx is still pending. Compare the PON, facility, resident and medication. Leave already-processed orders and controlled medications with the pharmacy's manual procedure.
3. Associate the resident on the E-DC. If retrieving the NewRx out of sequence, use the demonstrated empty ALF folder procedure. The green button takes the next request for the selected folder. Recheck the open order.
4. Choose **Refuse Request**. Enter the original DocuTrack document number as the reason. Confirm the Framework result. Add **REFUSED** to the E-DC, set **PV1**, save and refresh the list.

The pilot reads DocuTrack, matches PONs, and assists the technician with lookup and copying. Refusal, association, note, PV1 and save are technician actions. FWDirect is excluded. A future automated refusal needs a verified binding to one pending Framework request, plus a readable success outcome for both the refusal and the DocuTrack save so that a retry cannot duplicate either action.

## Controlled medication references

Use the pharmacy's verified product record and procedure to determine whether an order is in scope. These official lists support manual lookup. A missing name or spelling variation provides no clearance for an automated action.

| Jurisdiction | Official list |
| --- | --- |
| United States | [DEA alphabetical controlled-substance list](https://www.deadiversion.usdoj.gov/schedules/orangebook/c_cs_alpha.pdf) and [21 CFR Part 1308, including schedules and exemptions](https://www.ecfr.gov/current/title-21/chapter-II/part-1308) |
| Virginia | [Drug Control Act, Article 5, Schedules I–VI](https://law.lis.virginia.gov/vacodefull/title54.1/chapter34/article5/) and [Board of Pharmacy additions to Schedule I](https://law.lis.virginia.gov/admincode/title18/agency110/chapter20/section322/) |

For example, Virginia Schedule V lists gabapentin and pregabalin. The Virginia statute also defines Schedule VI. Confirm with the pharmacy how its product record represents state scheduling before using that flag to automate dispositions. [Virginia Schedule V](https://law.lis.virginia.gov/vacode/title54.1/chapter34/section54.1-3454/) · [Virginia Schedule VI](https://law.lis.virginia.gov/vacode/title54.1/chapter34/section54.1-3455/)
