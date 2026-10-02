# Read-only Iguana intake and diagnostic pilot

Order Queue supports local HAR/XML inspection and a localhost bridge that polls
Iguana's log API. It creates local SIG review drafts. It does not write to Iguana,
resubmit/dequeue messages, change channels, or insert anything into Framework.

## First run on Windows

1. Extract the entire `Sig-Assist-Windows-Demo.zip`.
2. To inspect a capture now, open `index.html` in Edge/Chrome. Choose **Import HAR
   / log XML** in Order Queue and select the HAR. This requires no runtime/server
   installation. Capture imports never replay requests or run the log UI's JS.
3. For live intake, the computer running the bridge needs **Node.js 22.12+**.
   Double-click **Start-Iguana-Connector.bat**, then use the localhost page it
   opens (`http://127.0.0.1:4190/`). Keep its console window open. No PowerShell is
   used. The packaged bridge needs no npm dependencies. From a source checkout,
   run `npm run build:demo`, then `npm run connector`.
4. Expand **Live connection settings**. Enter the base URL/port of Iguana's
   **web management interface**, rather than the separate e-prescribing listener.
   Enter the account used to read logs. Leave **Channel = MessageBroker**.
5. Enter **After** in the time shown by Iguana: `YYYY/MM/DD HH:MM:SS`. Start with
   a narrow interval containing one known order. **Before** can bound a historical
   test. These are Iguana server wall-clock times; the bridge does not assume its
   timezone matches the PC.
6. For this first test, enter the known PON in **Text / PON filter**, enable
   **Include decoded payload evidence**, and click **Fetch once**.
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
exports. Captured HAR cookies/credentials are never reused.

The initial live adapter expects `<export><message ...><data>...</data></message>
</export>`, accepting entity text, CDATA or nested XML data. It records schema
names/metadata. Unknown roots, missing data, malformed XML and partial HAR
details are reported. The real site's `/api_query` response/authentication is
still a live check: the HAR verified browser details, not the log API.

Polls run every 15 seconds, backing off to at most two minutes on connection
failures, with no overlapping polls. If every entry supplies server time in
`YYYY/MM/DD HH:MM:SS` (optional fractions), a cursor advances with a two-second
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
- Optional decoded payload evidence collected only while enabled: up to 20
  snapshots, 1 MB each, with truncation/drop information. Transport authentication
  headers and SCRIPT Security blocks are omitted.

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
failures and timeouts. Browser smoke tests cover import, metadata persistence,
diagnostic downloads and live fetch through the bridge.

Remaining site checks: API schema/auth mode, account/channel visibility,
timestamp format, throughput/query limits, additional transaction types,
Framework queue selection/route mapping and actual Citrix copy/paste. This
connector observes incoming orders; it does not determine which orders are
currently assigned to a technician in Framework's E-Rx Queue.

API reference: <https://help.interfaceware.com/v6/http-api-reference#api_query>.
