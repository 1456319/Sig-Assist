# PILOT ONLY — E-DC disposition evidence, not a refusal classifier

The Richmond Process desktop scan now starts a read-only Iguana evidence check immediately after acquiring PONs. It queries **MessageBroker** and **Paxit: VA - FW Outbound** independently for each distinct PON (up to two PONs simultaneously). Search windows cover the last seven calendar days. It does not advance intake cursors, create/revise queue orders, overwrite SIG drafts, write to Iguana, refuse Framework orders, or use FWDirect.

An outbound channel lookup reports **outbound activity**, not **processed**, **refused**, **accepted**, or **pending**. A NewRx in MessageBroker reports only historical receipt. CancelRx is reported as an incoming cancellation notice. A failed channel query, truncated response (limit reached), or incomplete match must never be interpreted as an absent event or as clearance to process. Each scan clears the prior evidence and can be rechecked manually. The DocuTrack Process snapshot is independent of these per-PON results.

## Evidence supplied 2026-11-14

The user-provided `HAR-CONFIRMING-VA-OUTBOUND-QUEUE-CONTENTS.har` contains 114 HTTP exchanges and 21 log-list responses. The list responses contain 320 display rows on the exact channel **Paxit: VA - FW Outbound**: 222 Info, 35 Success, 32 Ack Msg, and 31 Message rows. No `/log_view_entry` or `/api_query` message-detail responses appear in this capture. **These counts are UI log rows, not unique prescriptions or proven dispositions.** A generic Success or Ack Msg is not evidence that Framework accepted/refused an individual PON.

The HAR must remain outside the repository and public diagnostics: it contains server details and potentially sensitive log content. No patient values or credentials are included in this document.

## Required next dummy-data validation

1. In Framework, prepare one distinct **dummy pending NewRx** with a known PON and confirm its current queue state. Record the PON and source message ID locally.
2. Capture that PON's MessageBroker entry and the matching outbound *full detail* before the refusal.
3. Perform a technician-led refusal using the normal workflow, then capture the outbound full detail and Framework history showing refusal. Compare exact identifiers, event type, chronology, acknowledgment and request identity.
4. Repeat with one completed/accepted, non-refused dummy NewRx. Prove that any future disposition classifier can distinguish **refused** from **accepted** and **unverified**, even where outbound log markers are identical.
5. Only after these mappings are verified should the UI offer explicit refused/processed outcomes or use them to filter advisories. Always cross-check a currently pending Framework request immediately before any actual refusal.

**Packaging:** The GitHub Actions Windows artifact from the source commit contains the current standalone build; the previously committed ZIP is not updated by these source changes. The LAN pharmacy profile is deliberately kept outside GitHub and must be supplied separately for the local build.
