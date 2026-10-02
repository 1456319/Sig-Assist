# Read-only Iguana intake and diagnostic pilot

Order Queue supports local HAR/XML inspection and a localhost bridge that polls
Iguana's log API. It creates local SIG review drafts. It does not write to Iguana,
resubmit/dequeue messages, change channels, or insert anything into Framework.

## First run on Windows

1. Extract the entire `Sig-Assist-Windows-Demo.zip`.
2. To inspect a capture now, open `index.html` in Edge/Chrome. Choose **Import HAR
   / log XML** in Order Queue and select the HAR. This requires no runtime/server
   installation. Capture imports never replay requests or run the log UI's JS.
3. For live intake, double-click **Start-Iguana-Connector.bat**. It checks for
   **Node.js 22.12+** beside the launcher and on PATH, then checks its private
   user cache. If none works, it downloads the official standalone Node.js
   **22.23.3** executable for Windows x64/ARM64/x86 from `nodejs.org`, verifies
   the pinned official SHA-256 checksum, and saves it under
   `%LOCALAPPDATA%\Sig-Assist\runtime\node-v22.23.3-win-<architecture>\node.exe`.
   This needs no administrator access, MSI installer, npm, PowerShell or
   permanent PATH change. The first download needs internet access; later
   launches reuse the cache. Use the exact localhost address printed/opened by
   the launcher (normally `http://127.0.0.1:4190/`) and keep its console window
   open. A second launch reopens an existing connector only when its bridge and
   portable page fingerprints both match. If another service or an older build
   occupies that port, the launcher selects an available port without stopping
   the existing process. From a source
   checkout, run `npm run build:demo`, then `npm run connector` with Node installed.
4. Expand **Live connection settings**. The site defaults are already filled:
   **Iguana base URL = http://iguanabalt01v:6543**, **Username = admin**,
   **Password = password**, and **Channel = MessageBroker**. The URL is the web
   management interface including its port, without `/logs.html`.
5. **After** starts at midnight of the previous calendar day on this computer,
   in `YYYY/MM/DD HH:MM:SS` format. **Before** is blank. Adjust the time if the
   PC and Iguana use different clocks, or narrow the window for a known order.
   **Use yesterday’s midnight** resets After and clears Before. These query
   values are interpreted as Iguana server wall-clock times.
6. For this first test, enter the known PON in **Text / PON filter**, enable
   **Include payload evidence**, and click **Fetch once**.
7. Check the counts, original directions, identifiers, NDC, structured dose,
   route, frequency and administration times. Match the order/PON in Framework
   before reviewing/copying the suggested SIG.
8. **Export connector diagnostics**, including when the fetch fails or returns
   zero entries. This supplies the response-profile evidence for further fixes.
9. To collect ongoing orders, remove the PON filter, set a recent starting time,
   and **Start polling**. Keep Order Queue open: leaving that view stops polling.
   **Stop intake** stops the outstanding fetch/timer; Ctrl+C closes the bridge.

The optional environment variable `SIG_ASSIST_CONNECTOR_PORT` changes the local
port. The standalone file and localhost page use different browser storage
origins. Export saved discrepancy cases from the old page before switching;
its queue/case archive is not automatically transferred. Existing folder storage
in Settings remains available.

If the connector reports a busy port and opens a different address, a notice
explains that browser-saved cases remain at the original address. Close your
earlier Sig-Assist connector console with Ctrl+C, then relaunch to return to the
original port. Do not close an unrelated application just to free a port.

### Blank page / startup troubleshooting

The page displays a startup panel until React mounts. A JavaScript, module,
rendering or startup timeout failure keeps that panel visible with **Save startup
diagnostics** and **Reload page**. The JSON includes the page address, source
build fingerprint, browser, errors/stacks, storage availability and local bridge
profile when available. It does not export saved order/case contents. Reloading
does not clear stored cases. If browser policy blocks even the diagnostic script,
the static startup message remains visible; capture that screen and address.

The bridge checks that `index.html` is the standalone build before serving it.
A source checkout shell, separate-asset build or missing file gets an explanatory
HTML error rather than an empty application root. **Open startup diagnostics**
on that error page, or `http://127.0.0.1:<active-port>/connector/diagnostics`,
shows the runtime, bridge fingerprint, checked file/path, page fingerprint and
selected port. The console prints the same initial page profile. Extract the
complete ZIP into one folder; replacing only the BAT does not update the page
or bridge.

### User runtime setup troubleshooting

Automatic setup uses Windows `curl.exe` and `certutil.exe`; neither requires
elevation. If setup fails, the console identifies download, checksum, profile
write or runtime execution failure and prints `node-setup.log` from the runtime
folder. Keep that log with the error report. Downloads are staged under a
temporary name; an incomplete or wrong-checksum file is never installed.
Application policy or a proxy can still block a download or executable; the
launcher reports the failure and does not change that policy. A compatible
official `node.exe` placed beside the BAT also works offline. The runtime is
installed for the Windows/Citrix user executing the launcher, and only the
standalone Node executable is needed for this bridge.

`Start-Iguana-Connector.bat --check` checks or sets up Node and exits before
starting the bridge. `--no-browser` runs the bridge without opening a tab.
The version and checksums come from the
[official Node.js release](https://nodejs.org/en/blog/release/v22.23.3).

## Confirmed source mapping

The paired HAR/PDF established PointClickCare NCPDP SCRIPT `20170715` inside
SOAP. Two MessageBroker **Info** records contain the same NewRx. The associated
Framework-to-Paxit HL7 and RxFill records are different processing stages.

| Queue/display field | SCRIPT location |
| --- | --- |
| PON | `Message/Header/PrescriberOrderNumber` |
| Event identity | `Message/Header/From` + `MessageID` |
| Source time | `Message/Header/SentTime` |
| Facility | `Body/NewRx/Facility/Identification/FacilityID` |
| Resident reference | `Patient/HumanPatient/Identification/MedicalRecordIdentificationNumberEHR`; otherwise `PatientAccountNumber` |
| Ordered drug | `Body/NewRx/MedicationPrescribed/DrugDescription` |
| NDC | `DrugCoded/ProductCode/Code`, when qualifier is `ND` |
| Original directions | `MedicationPrescribed/Sig/SigText`, retained verbatim |
| Structured dose/unit | `Sig/Instruction/DoseAdministration/Dosage` |
| Route | `Sig/Instruction/DoseAdministration/RouteOfAdministration/Text` |
| Frequency | `Sig/Instruction/TimingAndDuration/Frequency` |
| Administration times | All `FacilitySpecificHoursOfAdministrationTiming/HoursOfAdministrationValue` occurrences |
| Start/effective dates | Qualified `OtherMedicationDate` occurrences |

Identity is facility + resident reference + PON. Names, birth dates and SSNs are
not substitutes for a missing stable reference. Required identity/drug/directions
are quarantined when absent. The intake mapper inserts no guessed oral route,
tablet dose or daily frequency. Translation remains in the existing clinical
engine; its output is always a review draft.

Structured facts/schedules are retained as metadata and displayed separately
from the verbatim SIG. Every instruction leaf/path is recorded for diagnosis;
facts are not silently appended to the original prose. A structured indication
of `Unspecified` produces a diagnostic warning. A Framework default SIG template
is not available in this captured NewRx and is not invented.

## Query, completeness and lifecycle

The bridge calls **GET `/api_query`** with `source=MessageBroker`,
`type=info,messages,warnings,errors`, `deleted=false`, `reverse=false`, `after`
and `limit`, plus optional `before` and `filter`. **Info must be included**.
Authentication defaults to Iguana API username/password parameters; HTTP Basic
is an alternate mode. Credentials stay in page memory and are excluded from
exports. Every request supplies credentials again; the connector does not depend
on the Iguana web UI session or its 15-minute inactivity timeout. Captured HAR
cookies/credentials are never reused.

The live adapter accepts the site's observed `<export><message data="..."
source_name="..." time_stamp="..." reference_id="..." /></export>` profile.
It also accepts `<message><data>...</data></message>` with entity text, CDATA or
nested XML. Explicitly empty data is a valid queue marker and still counts toward
the query limit. Missing data, conflicting representations, rejected API queries,
unknown roots, malformed XML and partial HAR details are reported. Schema
diagnostics include attribute names, representation counts and empty-body counts.
The October 2 diagnostic export confirmed HTTP 200 API access with parameter
authentication; the parser had been rejecting the attribute-based response.

Polls run every 15 seconds, backing off to at most two minutes on connection
failures, with no overlapping polls. If every entry supplies server time in
`YYYY/MM/DD HH:MM:SS` or `YYYY-MM-DD HH:MM:SS` (optional fractions), a cursor advances with a two-second
overlap. Unknown formats keep the current window and produce a warning.

When a result reaches its limit, automatic polling **pauses**. Returned oldest
entries can be inspected, but the window is not considered complete and its
cursor does not advance. Narrow the interval or increase the limit (maximum
5000), then fetch again. Mapping/quarantine failures also pause polling and
retain the cursor. This pilot does not claim durable queue consumption or
complete collection of a saturated historical window.

- Duplicate SCRIPT MessageIDs/sources preserve technician drafts and review.
- A newer changed drug, directions, NDC or structured clinical fact creates a
  source revision and clears single/split approval/copy state.
- Saved historical replays cannot revert the current source. Changed events
  with older/equal/unknown timestamps are reported for investigation.
- Conflicting content under one MessageID is quarantined. Matching existing
  orders receive an intake hold that blocks copying. Investigate, then use
  **Revise source** to resolve the hold and require fresh review.
- RxFill/status transactions are recorded without creating orders; prescribed
  and dispensed medication sections are kept distinct.
- CancelRx cancels a uniquely matched local order by explicit source identity
  or original-message reference. Unmatched/ambiguous cancellations are reported.
  Replays never reopen cancelled orders.
- HL7 records are classified for diagnostics and not queued by this adapter.

## Verbose diagnostic evidence

**Export connector diagnostics** downloads a versioned JSON bundle containing:

- Source build fingerprint, browser/protocol, current state, last counts,
  configured server-time window, cursor, filter, channel and limit.
- Separate intake history (3000 retained events), stage totals and dropped-event
  count; existing clinical Trace Logs remain available.
- Request IDs, read-only endpoint/method, timing, bytes/content type, HTTP status,
  network error category, retry count and query-limit findings.
- HAR/detail/list-row counts, position/channel/type correlation, decoding depth,
  formatting repairs, schema paths and structured instruction values.
- Mapped source/transaction identifiers, original directions, missing fields,
  duplicate/status decisions, revisions/cancellations and quarantine causes.
- Current imported order metadata, revision and cancellation state.
- Optional payload evidence collected only while enabled: up to 20
  snapshots, 1 MB each, with truncation/drop information. Transport authentication
  headers and SCRIPT Security blocks are omitted. XML entity escaping is retained
  so an untruncated API snapshot remains parseable; nested authentication removal
  does not leave orphan closing tags.

Exports contain exact prescription data/resident references and are marked
`redacted: false`; they are not anonymized. They stay local and are not uploaded
automatically. Export before leaving Order Queue/closing the page: connector
diagnostics/cursor are in memory. Queue metadata follows existing browser/folder
persistence. Restart with an overlapping After time to recover missed logs;
saved sources prevent duplicate orders. Console request/result/error JSON
summaries omit credential-bearing request URLs.

| Diagnostic stage/result | What to check |
| --- | --- |
| `transport.unreachable` / `transport.bridge.profile` | Open the bridge's localhost page, not standalone HTML/Vite preview |
| `ENOTFOUND` | Hostname resolution on the computer running the bridge |
| `ECONNREFUSED` | Management-interface host and port |
| HTTP 401/403 | Entered account, auth mode and channel/log read visibility |
| `api.schema` / `query.failed` | Response profile differs; enable payload evidence and retry |
| `decode.failed` | Incomplete/malformed SCRIPT or encoded SOAP |
| `intake.quarantine` | Required source identifiers/drug/directions absent |
| `intake.conflict` / `intake.revision.unordered` | Content conflict or uncertain source ordering |
| `intake.cancel.unmatched` | Original order/reference needed for cancellation matching |
| `query.cursor.unavailable` | Server timestamp profile needs adjustment; current window retained |
| `query.limit` | Narrow interval/increase limit; completeness not established |

## Validation and remaining live checks

Tests cover encoded/base64 details, duplicates, RxFill section selection, HL7
exclusion, source revisions/historical replay, cancellations, missing identity,
malformed/partial XML, diagnostic limits and clock overlap. Bridge tests use a
synthetic localhost server to assert GET-only requests, Info inclusion, auth
failures, timeouts and repeated authentication after simulated session expiry.
Tests reproduce the observed attribute format using synthetic records, including
empty markers, escaped SOAP, duplicate NewRx entries and fractional timestamps.
Browser smoke tests cover import, metadata persistence, prefilled settings,
diagnostic downloads and attribute-based live fetch through the bridge.

Remaining site checks: sustained intake after this parser fix, throughput/query
limits, additional transaction types,
Framework queue selection/route mapping and actual Citrix copy/paste. This
connector observes incoming orders; it does not determine which orders are
currently assigned to a technician in Framework's E-Rx Queue.

API reference: <https://help.interfaceware.com/v6/http-api-reference#api_query>.
