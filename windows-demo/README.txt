SIG-ASSIST WINDOWS DEMO

1. Extract ALL files from Sig-Assist-Windows-Demo.zip to a local folder.
2. Double-click Start-Sig-Assist.bat. Keep the console window open.
3. Edge or Chrome opens http://localhost:4173. If it does not, open that address.
4. Click Load demo queue. Select DEMO-001; compare original directions and SIG.
5. Edit the final SIG, check the review box, and click Copy reviewed SIG.
6. Select DEMO-002 for morning/bedtime split cards, DEMO-003 for a taper,
   DEMO-004 for PRN directions, and DEMO-005 for multiline hold parameters.
7. Use Revise source or Cancel order to demonstrate copy invalidation.
8. Open Trace Logs to inspect translation steps and export diagnostics.

No Node.js, npm, installation or administrator privileges are required.
The app and translation engine are prebuilt and run without internet access.
Windows PowerShell 5.1 (built into Windows 10/11) and Edge/Chrome are required.
Close the console window to stop the server.

Orders and exclusions are saved in this browser at localhost:4173. Use Clear
orders to remove the queue. Undo removes exclusions. Folder storage is optional
and is available in Settings on supported browsers.

This is a synthetic demonstration and manual review prototype. Live Iguana
ingestion and automatic Framework matching are not implemented. Generated SIGs
require human comparison against every source clause and Framework Preview Sig.
Actual pharmacy Citrix clipboard and Framework behavior require site testing.

If launch fails: extract the full ZIP, close any other localhost:4173 preview,
then retry. If your organization blocks scripts, use the existing hosted app
or ask IT for an approved launch method.
