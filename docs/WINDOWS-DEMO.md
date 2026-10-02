# Windows demonstration

Download [Sig-Assist-Windows-Demo.zip](https://github.com/1456319/Sig-Assist/raw/refs/heads/main/windows-demo/Sig-Assist-Windows-Demo.zip).
Extract the entire ZIP to a folder, then double-click **Start-Sig-Assist.bat**.
The launcher opens the standalone **index.html** in your default browser and
exits. You can also open **index.html** directly in Edge or Chrome. The same
download is available
from successful [MVP checks runs](https://github.com/1456319/Sig-Assist/actions/workflows/checks.yml).
**Start-Sig-Assist.cmd** is also included as an alias for the browser-only BAT
launcher. Extracting the current ZIP replaces the older CMD that invoked
PowerShell. The repository's `windows/Start-Sig-Assist.cmd` opens the same
prebuilt page from the sibling `windows-demo` folder.

If you downloaded the repository ZIP, open **windows-demo** and run
**Start-Sig-Assist.bat**. The root `start-windows.bat` and `preview-windows.bat`
also use this bundled demo automatically when Node.js/npm is unavailable.
All launchers support UNC paths such as Citrix redirected Documents folders.

The default demo opens as a local HTML file. It needs no PowerShell, Node.js,
npm setup, administrator access, database configuration, server port or
connection to Iguana. If the launcher is blocked or no browser opens, right-click
**index.html**, choose **Open with**, then **Microsoft Edge** or **Google Chrome**.
This route uses the ordinary browser; it does not change endpoint protection.

The older localhost server remains available in the repository for environments
where it is approved. Its PowerShell files are omitted from the default ZIP.

## Five-minute walkthrough

1. In **Order Queue**, click **Load demo queue**. Five synthetic orders are loaded.
   DEMO-001's original directions remain visible alongside `1T PO BID X7D`.
2. Change the editable final SIG to show technician correction. Check the
   review acknowledgement, then click **Copy reviewed SIG**. Paste into an empty
   text editor to demonstrate exactly what would be copied into Framework.
3. Click **Revise source** and change the directions. Saving regenerates the
   draft and requires fresh review.
4. Select DEMO-002 for a split regimen, DEMO-003 for a taper, DEMO-004 for PRN,
   and DEMO-005 for multiline hold parameters. Each split card has its own
   review and copy controls. Cancellation also immediately blocks copying.
5. Open **Trace Logs**, filter by clinical layer and export a diagnostic bundle.
   **Settings** also lets Edge/Chrome choose a writable local/Citrix folder.

The queue and exclusions are saved in this browser's local cache when permitted
and restored after reload. Keep the HTML at the same path; moving it or switching
from localhost uses a different browser storage location. If a directory is
connected, writes go to that chosen folder;
reconnect the folder after restarting. **Clear orders** clears the saved queue.
Clipboard content is managed separately by Windows.

This translation/review prototype now supports captured and read-only Iguana
SCRIPT intake. See [IGUANA-CONNECTOR.md](IGUANA-CONNECTOR.md) for the launcher,
field mapping and verbose diagnostics. Live site access, Framework matching/
insertion and site-specific SIG validation still need verification.
**Start-Iguana-Connector.bat** checks for Node and automatically downloads a
verified private copy into your user profile when needed. This setup needs
internet access on the first run and no administrator access or PowerShell.
Use synthetic examples for this demo. All generated SIGs require
technician review; this package does not establish clinical accuracy.

## Collect mistranslations during an evaluation

Use the app alongside the normal order-entry process. Manually enter approved,
de-identified directions and medication/strength in **Workbench**, or add an
order in **Order Queue** with anonymous references, or use the read-only intake
pilot in the connector guide. Framework insertion is not implemented;
the app does not replace routine
technician/pharmacist checks.

1. Compare the suggested SIG and split cards against the original directions.
2. Open **Flag Discrepancy or Uncaught Error / Preference Lead**. In the Queue,
   your current draft is offered as the correction; for a split regimen, put
   each corrected card on its own line. Verify that text before saving.
3. Enter the corrected SIG and explain the missed clause, incorrect translation,
   or preferred code in **Notes / Rationale**. Notes alone are allowed when the
   expected answer is not yet established. Click **Save Discrepancy Report**.
4. Confirm that the saved report count increases. **Export discrepancy cases**
   downloads every saved case from the current storage destination as JSON.
   This control is also available in Workbench and Settings.
5. Export after each session, before changing folders, replacing the HTML at a
   different path, or clearing browser data. Keep the exported files; reports
   are local and are not uploaded automatically.

Each new report contains the original directions, drug, generated SIG, technician
correction, notes, timestamp, source build fingerprint, default template,
abnormalities, and generated split-card context when available. Queue reports
also include edited split-card drafts and review preference context. Older
reports are included in exports even when they lack the new metadata.
The count and success message appear only after storage accepts the write.
Clearing the order queue does not clear discrepancy reports. Browser storage
can be cleared by policy or by the user; the exported JSON is the portable record.

Case exports preserve exact directions and PON and are **not anonymized**.
Remove patient identifiers from directions and notes before sharing a case file.
A saved correction is a proposed expected answer for investigation; saving it
neither approves an order nor updates translation rules. Reviewed examples can
later become regression tests to check each parser fix.

## Build the same package from source

With Node.js 22.12+ installed, run `npm ci`, then `npm run build:demo` and
`python scripts/package-demo.py` to create the standalone ZIP. Alternatively,
`npm run demo:package` also refreshes the standalone page and browser-only CMD
alias while retaining the optional server assets. The source
launchers `start-windows.bat` and `preview-windows.bat` remain available when
Node.js is installed; the downloaded prebuilt artifact avoids that requirement.
