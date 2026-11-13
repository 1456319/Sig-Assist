SIG-ASSIST WORKSTATION PROBE v0.1.4  |  PILOT ONLY — REMOVE FROM PRODUCTION

No administrator install or HAR is required.

Richmond folder check (option 3)
Open Richmond Pharmacy > Order Processing > Process and let the list refresh.
Run Start-Probe.cmd and choose 3. Save the report as 05-process-folder.json.
Switch to Triage under the same cabinet, wait for the refresh, and repeat
option 3. Save as 06-triage-folder.json. No document needs to be opened.
This check uses Windows accessibility to ask visible outline controls which
node is active and which cabinet and pharmacy are above it. It reports only
fixed folder labels, selection state, installer control matches and counts.
An unknown label is omitted. A partial or missing path is useful evidence.
No row values are read. Neither report is uploaded automatically.

General control maps (options 1 and 2)

1. Extract all files to a local folder. On the Windows desktop hosting DocuTrack,
   open Richmond Pharmacy > Order Processing > Process. Run Start-Probe.cmd
   and choose 1. Keep that screen open during capture.
2. The report opens in Notepad. Save As 01-process.json locally. With one
   dummy E-DC open, take a second capture and save as 02-document.json.
   For Framework choose 2 while its pending NewRx is open; if a completed
   dummy refusal is available, capture its history view separately.
3. Review and share only the probe JSONs you choose. Say which screen each
   corresponds to and whether the displayed row count matched. Use a generic
   filename. A second dummy resident helps test collisions; repeat the first
   to check consistency. No real name, PON, phone, or address is needed.

The general map samples the Windows UI Automation control tree. A node
number is unique within one capture. Parent numbers describe the structure.
Labels come from a fixed application vocabulary. Unrecognized names are
omitted. Node numbers identify controls, not people. Protected inputs and
their children are skipped. Grid dimensions and provider patterns describe
what Windows advertises; a reported Invoke or Value pattern does not prove
that an operation is appropriate or that the account has permission.
The probe never reads a value, document text, clipboard, screenshot, or a
window title. It does not click, scroll, change accessibility settings,
instantiate COM, query a server, write to the applications, or upload data.
The DocuTrack report checks only whether a known local COM registration is
present. A time or traversal limit is reported as partial; only two data-row
subtrees per parent are sampled. An empty list or unavailable provider is
an evidence gap. Remote Citrix pixels cannot expose controls to a probe on
the local desktop; run the probe in the session that hosts the actual EXE.

Windows .NET Framework 4.5+ and its built-in compiler are required. Reports
stay under %LOCALAPPDATA%\Sig-Assist\pilot-probe in separate run folders.
Delete that pilot-probe folder after keeping any captures you want.
Remove this extracted kit from workstations before production deployment.
The public demo and LAN application distribution exclude the probe.

Optional browser evidence: open HAR-Preview.html locally. Choose a dummy
HAR captured from a known browser surface to preview a structural report,
then save the previewed JSON. A browser trace of Sig-Assist covers browser
and localhost connector traffic. It cannot observe the desktop EXEs.
Keep original HARs, regular Framework diagnostic dumps, and Iguana exports
on the workstation; those formats may contain patient data or credentials.
