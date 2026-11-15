# SSRS eRx Queue CSV — read-only M1 pilot

This prototype adds a **local import of CSV exported manually from ErxQueueDashboard**. It does NOT connect to the private reporting host or access Framework directly. The existing E-DC reader and Iguana pilot are unchanged except for conservative matching and safer warning copy.

## Operator procedure (no admin rights)
1. Open ErxQueueDashboard in the normal authorized workstation/browser.
2. Set the appropriate site and other report parameters, refresh, then choose Export > CSV. The export includes **collapsed folders**; an item in **Refusals** means *held for human/pharmacist review*, not electronically refused.
3. In Sig-Assist > Order Queue > Richmond DocuTrack E-DCs, expand **Import eRx Queue Dashboard CSV** and choose the exported file.
4. Each currently scanned DocuTrack E-DC gains an **SSRS queue snapshot** column. Confirm its PON and facility against the actual Framework E-Rx Triage Manager record. Do not infer a pending request from the report alone.

## Actual parsing contract
`src/lib/ssrs/erxQueueCsv.ts` accepts the SSRS export columns in this order:
`Descr1,CC1,EntryDt1,MsgType1,Priority1,FacID,Patient1,PrescriberOrderNumber,Physician1,DEAClass,Drug,Directions,Sendername,CC2`

- Empty `MsgType1` rows are folder placeholders and **not queued prescriptions**.
- PON values are strings. Leading zeros, vendor suffixes and colons are significant.
- CSV quotes, escaped double quotes, commas and embedded line breaks are supported.
- `CC2` is treated as an SSRS-declared total **only as a structural check**, not proof that the report parameters cover every order.
- Unsupported headers and malformed rows cause explicit import errors.
- The imported file remains in browser memory, and can be cleared. No patient information is transmitted through this feature; do not export raw CSV in shared diagnostics.
- Import time means only that the technician selected a file. The CSV itself does not establish **report generation time, live server status, freshness or filter coverage**. A report can already be stale when imported.

## E-DC matching and operational meaning
- An exact `PON + FacID` can identify one **queue row in the imported snapshot**, not a disposition. Missing facility or duplicate rows are ambiguous.
- A PON not listed in a given snapshot has **unknown disposition**, not a completed, processed or refused status.
- **Refusals** is a technician-controlled review-hold folder, not an actual completed refusal.
- Controlled substances, no shared MAR/prescriber PON, or uncertain identity require pharmacist adjudication. DEA class in the CSV is only supporting evidence, not an authoritative controlled-medication registry.
- A historical NewRx, CancelRx, outbound ACK, RxFill, manually voided order, or electronic D/C notice should never independently authorize a refusal.
- The DocuTrack E-DC confirmation workflow remains a technician action. No auto-refuse, auto-Cut, auto-save, FWDirect, backend database, authentication or live SSRS polling was added.

## Acceptance tests
`src/lib/ssrs/erxQueueCsv.test.ts` uses synthetic identifiers to check:
- correctly quoted fields and newlines, BOM, and placeholder counts
- Refusals review-hold semantics and controlled-substance review flags
- exact PON+facility matching, reused PONs across sites, duplicates and absent rows
- malformed files, unexpectedly formatted exports and count mismatch

`src/lib/docutrackQueue.match.test.ts` ensures E-DC matches cannot be marked unique if facility information or an exact known order is missing.

**Remaining work before automated import:** Validate safe user-level SSRS access and report parameters on the workstation. Do not replay HAR cookies, hardcode credentials or assume that SSRS ReportViewer POSTs or integrated authentication can be reused headlessly. A controlled read-only pilot with synthetic data and a verified CSV response is required.
