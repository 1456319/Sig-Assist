# Windows demonstration

Download [Sig-Assist-Windows-Demo.zip](https://github.com/1456319/Sig-Assist/raw/refs/heads/main/windows-demo/Sig-Assist-Windows-Demo.zip).
Extract the entire ZIP to a folder, then double-click **Start-Sig-Assist.bat**.
Leave the console window open while presenting. The same download is available
from successful [MVP checks runs](https://github.com/1456319/Sig-Assist/actions/workflows/checks.yml).
The existing **Start-Sig-Assist.cmd** package remains supported by `npm run demo:package`.

The prebuilt package uses Windows PowerShell 5.1 and the default browser.
It needs no Node.js installation, npm setup, administrator access, database
configuration or connection to Iguana. Open `http://localhost:4173/` in Edge or
Chrome if the browser does not open automatically. If that port is already in
use, close the previous demo console before starting again.

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

The queue and exclusions are saved in this browser's local cache and restored
after reload. If a directory is connected, writes go to that chosen folder;
reconnect the folder after restarting. **Clear orders** clears the saved queue.
Clipboard content is managed separately by Windows.

This is a demonstrable translation/review prototype. Live Iguana intake,
automatic Framework matching/insertion and site-specific SIG validation remain
unfinished. Use synthetic examples for this demo. All generated SIGs require
technician review; this package does not establish clinical accuracy.

## Build the same package from source

With Node.js 22.12+ installed, run `npm ci`, then `npm run build:demo` and
`python scripts/package-demo.py` to create the standalone ZIP. Alternatively,
`npm run demo:package` creates the existing multi-file CMD package. The source
launchers `start-windows.bat` and `preview-windows.bat` remain available when
Node.js is installed; the downloaded prebuilt artifact avoids that requirement.
