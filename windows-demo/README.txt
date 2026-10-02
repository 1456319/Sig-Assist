SIG-ASSIST BROWSER DEMO

1. Extract ALL files from Sig-Assist-Windows-Demo.zip to a folder.
2. Open index.html directly in Microsoft Edge or Google Chrome.
   Alternatively, double-click Start-Sig-Assist.bat to open your default browser.
   The launcher exits after opening the page; no console needs to stay open.
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
page it opens. Configure the Iguana web-interface base URL, account, channel
MessageBroker and a narrow starting time from Iguana's log screen. Fetch once,
then Export connector diagnostics. Start polling after the first test succeeds.
The bridge only reads GET /api_query. It uses no PowerShell.

Read IGUANA-CONNECTOR.md for mappings, diagnostic stages and remaining live checks.
Connector exports contain exact order data. Optional decoded payload evidence
helps diagnose unknown profiles; export before closing the page. Nothing is
uploaded automatically. Standalone HTML and localhost use different browser
storage; export saved discrepancy cases before switching.

Actual site access and Framework queue/route matching require on-site checks.
Generated SIGs
require human comparison against every source clause and Framework Preview Sig.
Actual pharmacy Citrix clipboard and Framework behavior require site testing.
