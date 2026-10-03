SIG-ASSIST BROWSER DEMO

FRAMEWORK DESKTOP PILOT
Run Start-Iguana-Connector.bat in the same Windows/Citrix session as Framework.
Detect open E-Rx fills the search when Framework exposes its PON. Select the
matching order, review the SIG and administration times, and approve it.
Multiple PONs show a warning; approved sending remains available. If needed,
use Choose Framework SIG field and click the destination within eight seconds. Verify Preview Sig and
save in Framework. No prescription is saved or submitted by Sig-Assist.
Actual Framework screen compatibility needs an on-site check. If unavailable,
use Framework detection help > Export desktop diagnostics with the E-Rx open.
See FRAMEWORK-DESKTOP.md for setup, supported fields and current limitations.

1. Extract ALL files from Sig-Assist-Windows-Demo.zip to a folder.
2. Open index.html directly in Microsoft Edge or Google Chrome.
   Alternatively, double-click Start-Sig-Assist.bat to open your default browser.
   The launcher exits after opening the page; no console needs to stay open.
   Start-Sig-Assist.cmd is the same browser launcher under the older file name.
   The current ZIP replaces the old CMD that required PowerShell.
3. Click Load demo queue. Select DEMO-001; compare original directions and SIG.
4. Edit the final SIG, check the review box, and click Copy reviewed SIG.
5. Select DEMO-002 for morning/bedtime split cards, DEMO-003 for a taper,
   DEMO-004 for PRN directions, and DEMO-005 for multiline hold parameters.
6. Use Revise source or Cancel order to demonstrate copy invalidation.
7. For a wrong translation, open Flag Discrepancy, verify the corrected SIG,
   add notes, and Save Discrepancy Report. Confirm the saved count increases.
8. Export discrepancy cases after each session to keep a portable JSON file.
   Reports stay local; they are not sent to GitHub or a developer automatically.
9. Open Trace Logs to inspect translation steps and export runtime diagnostics.

Case files contain exact original directions, PON, corrections and notes.
Use de-identified examples and remove patient identifiers before sharing.
Saving a case does not approve an order or change the translation rules.

No PowerShell, Node.js, npm, server, installation or administrator access is
required. The prebuilt page runs entirely in Edge/Chrome without internet access.
If a launcher is blocked, right-click index.html and choose Open with > Edge.

Orders and exclusions are saved in this browser when local storage is permitted.
Keep index.html in the same folder; moving it or changing from localhost uses a
different storage location. Clear orders removes the queue. Undo removes exclusions.
Clipboard and optional folder storage also depend on the browser's permissions.

READ-ONLY IGUANA INTAKE

In Order Queue, Import HAR / log XML inspects captured NewRx details and fills
the queue automatically. This works in the standalone page without Node.js.

For live intake, run Start-Iguana-Connector.bat. It checks for Node.js 22.12+,
and if missing, downloads and verifies official Node.js 22.23.3 into your user
profile. No administrator access or PowerShell is needed. The first setup
requires internet; later launches reuse the cached runtime. If setup fails,
the console prints the cause and the location of node-setup.log.
Keep its console open and use the localhost
page it opens. Live connection settings are prefilled with:
  Iguana base URL: http://iguanabalt01v:6543
  Username: admin    Password: password    Channel: MessageBroker
  After: yesterday at 00:00:00 on this computer    Before: blank
Paste a PON into Find E-Rx and press Enter. Choose the matching drug/order from
the results; incoming details and the suggested SIG fill automatically.
Load recent E-Rx needs no fields. Search the last 7 days is offered when there
are no matches. The same box filters saved orders by PON, patient reference,
facility or drug. The manual order form is optional and starts collapsed.
Adjust the time in Live connection settings if Iguana uses a different clock.
Start polling after the first test succeeds. New arrivals keep your current
selection and draft. Each fetch
supplies credentials again, independently of the web UI's 15-minute session.
The bridge only reads GET /api_query. It uses no PowerShell.

If port 4190 is busy, a matching connector is reused; otherwise an available
port is opened. Use the exact address printed by the launcher. Browser-saved
cases remain at their original address. Close your earlier Sig-Assist connector
with Ctrl+C and relaunch to return to its port and saved cases.

If the application cannot load, its startup panel offers Save startup diagnostics.
Send that JSON with the console error. Reloading does not clear saved cases.
An incomplete or source-only index.html gets an explanatory error page.

Expand Capture import and diagnostics to import a HAR or export diagnostics.
Read IGUANA-CONNECTOR.md for mappings, diagnostic stages and remaining live checks.
Connector exports contain exact order data. Optional payload evidence
helps diagnose unknown profiles; export before closing the page. Nothing is
uploaded automatically. Standalone HTML and localhost use different browser
storage; export saved discrepancy cases before switching.

Actual site access and Framework queue/route matching require on-site checks.
Generated SIGs
require human comparison against every source clause and Framework Preview Sig.
Actual pharmacy Citrix clipboard and Framework behavior require site testing.
