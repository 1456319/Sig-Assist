# Functional polish reconstruction

The previous temporary checkout was removed by automated workspace maintenance.
This repair reconstructs the source changes described in
[the historical checkpoint](FUNCTIONAL-POLISH-CONTINUATION.md). The recovered
Lovable reviews and installer evidence remain in `docs/research/`.

## Restored behavior

- Treatment actions retain their source order, named weekdays, durations, PRN
  reasons, follow-up, action-specific qualifiers and unresolved wording.
  Missing frequency no longer invents QS; a product name alone no longer invents
  an APPLY action. The three November fixture adjustments retain source details;
  original prose was not edited.
- Clinical and classic translation share scale detection with insulin product
  context. Headingless tables, glucose units, postfix comparisons, explicit
  additive doses, rechecks and unfamiliar notifications have focused coverage.
  Ambiguous doses retain the full source. The `>400 OR <60` notification
  regression is covered explicitly.
- Passive Framework observation batches identity/capability properties, reads
  fresh values separately, prioritizes the validated focused view and rotates
  sibling traversal. Offscreen wrappers can be traversed. Counters are sanitized.
  The Windows fixture contains 1,000 decorative controls and critical entry
  fields; it asserts field reach, fresh tokens, unchanged focus and omitted
  protected/hidden values. This is synthetic coverage, not site validation.
- Required dictionary writes report actionable failures. Indexed bulk imports
  retain existing codes and identities. Empty/partial remote responses preserve
  local changes; explicit delete/rename tombstones prevent stale resurrection.
  Optional cache-refresh failure does not hide usable entries.
- Rejected-output matching uses a bounded compiled-pattern cache. Packaging
  whitespace and classic numeric parsing avoid the reproduced long-input retry
  behavior. Clipboard failure selects the exact edited draft, offers Ctrl+C and
  does not report a successful copy. Editable drafts show the 199-character limit.

## Verification

Local Linux verification on the reconstructed source passed:

- 1,096 tests across 66 files.
- ESLint and application TypeScript checks.
- Clinical reference consistency (388 codes).
- Production/offline demo build.
- Demo packaging and byte-for-byte package source verification.

Windows compilation and all existing native, browser, UNC, clipboard, Iguana and
pilot recording smoke checks are run by `.github/workflows/checks.yml`. Their
remote result must be verified before treating the native reader as validated.
A short workstation field-coverage check is still needed before making claims
about the real Framework installation's coverage or latency.

## Preservation and release status

Every coherent reconstruction increment was committed to `prototype` on GitHub
while work continued. [AGENTS.md](../AGENTS.md) requires continued remote
checkpoints, including explicitly labeled unfinished work. One coordinator owns
Git writes in a shared checkout. Local commits and agent messages are not durable
source backups.

This is a source repair checkpoint. It does not replace the previously delivered
v0.1.8 workstation ZIP or claim a new v0.1.9 release. Generated demo/package
outputs were verified locally and are rebuilt in CI; the checked-in workstation
artifact remains the previously validated build.

`TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH` remains active. FWDirect
remains excluded. No private capture, patient data or credentials were committed.
