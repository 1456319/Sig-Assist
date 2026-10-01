# Windows demonstration

Download the **Sig-Assist-Windows-Demo** artifact from the latest successful
[MVP checks run](https://github.com/1456319/Sig-Assist/actions/workflows/checks.yml).
Choose a run for **main**. Extract the entire ZIP to a folder, then double-click
**Start-Sig-Assist.cmd**. Leave the console window open while presenting.

The prebuilt package uses Windows PowerShell 5.1 and the default browser.
It needs no Node.js installation, npm setup, administrator access, database
configuration or connection to Iguana. Open `http://127.0.0.1:4173/` in Edge or
Chrome if the browser does not open automatically. If that port is already in
use, close the previous demo console before starting again.

## Five-minute walkthrough

1. In **Order Queue**, click **Fill synthetic example**, then **Add to review
   queue**. The original directions remain visible alongside `1T PO BID X7D`.
2. Change the editable final SIG to show technician correction. Check the
   review acknowledgement, then click **Copy reviewed SIG**. Paste into an empty
   text editor to demonstrate exactly what would be copied into Framework.
3. Click **Revise source** and change the directions. Saving regenerates the
   draft and requires fresh review.
4. Show a split regimen by entering a new synthetic PON and drug `PREDNISONE
   10MG`, with directions `Take 2 tablets in the morning and 1 tablet at night
   for 5 days`. Each generated order card has its own review and copy controls.
5. Open **Trace Logs**, filter by clinical layer and export a diagnostic bundle.
   **Settings** also lets Edge/Chrome choose a writable local/Citrix folder.

The queue and exclusions are saved in this browser's local cache and restored
after reload. If a directory is connected, writes go to that chosen folder;
reconnect the folder after restarting. **Clear orders** clears the saved queue.
Clipboard content is managed separately by Windows.

This is a demonstrable translation/review prototype. Live Iguana intake,
automatic Framework matching/insertion and site-specific SIG validation remain
unfinished. Use synthetic examples for this demo. All generated SIGs require
technician review; this package does not establish clinical accuracy.

## Build the same package from source

With Node.js 22.12+ installed, run `npm ci`, then `npm run demo:package`.
The generated `windows-demo` folder is the portable package. The source
launchers `start-windows.bat` and `preview-windows.bat` remain available when
Node.js is installed; the downloaded prebuilt artifact avoids that requirement.
