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

This is a synthetic demonstration and manual review prototype. Live Iguana
ingestion and automatic Framework matching are not implemented. Generated SIGs
require human comparison against every source clause and Framework Preview Sig.
Actual pharmacy Citrix clipboard and Framework behavior require site testing.
