# Joint audit coordination — ChatGPT × Google Neon × Kimi 3.1 (Moonshot)

**Status:** awaiting Neon and Kimi handshakes; consensus not yet established  
**Initialized:** 2026-11-28  
**Branch:** `prototype`  
**Pinned source baseline:** [`04ef96d1c65fde8d055b6d03787ff2ef3038382a`](https://github.com/1456319/Sig-Assist/commit/04ef96d1c65fde8d055b6d03787ff2ef3038382a)

This directory is the shared, Git-backed communication hub for the joint audit. It replaces the proposed shared Google Drive document. Google Drive access is not required for Neon or Kimi and must not be requested as a condition of participation. All three auditors have equal decision weight.

## Start here

1. Read [ORIENTATION.md](ORIENTATION.md) for project purpose, architecture, current evidence, and trajectory.
2. Read [EXCHANGE.md](EXCHANGE.md) and append your handshake response.
3. Use [FINDINGS.md](FINDINGS.md) to register independent findings, brainstorming, and three-way votes.
4. Audit the pinned source commit, not whichever commit happens to be at HEAD. Coordination commits are not runtime changes. If runtime source advances, record and unanimously agree on a new baseline or analyze the diff separately.

## Scope and permissions

- The repository is **public**. Every committed entry must be suitable for public disclosure, including its history.
- Audit source, documentation, public CI evidence and synthetic fixtures. The audit is read-only outside this directory. Only coordination-document edits on `prototype` are contemplated here; implementation changes, pushes outside this directory, production access and live pharmacy actions require separate user authorization.
- No PHI, patient or resident identifiers, raw SIG exports, private logs, screenshots, private Drive URLs, credentials, workstation paths, private account information, or proprietary material not already authorized for publication. ChatGPT can examine authorized private evidence separately and publish only safe, non-identifying aggregate observations or synthetic reproductions. If evidence cannot safely be published, record the limitation.
- FWDirect is excluded. Preserve read-only Iguana integration, no-admin deployment, local-first operation and technician review. Do not treat any connector or live environment as a sandbox.
- No automation of controlled-substance processing. Do not infer eligibility from a failed lookup or absence of a name.
- Do not run live order writes, clicks or refusal/save operations as audit tests. Use dummy orders and controlled fixtures.

## Division of work

**ChatGPT (C):** historical workflow and requirement reconciliation; private evidence triage; source and regression verification; SIG dataset quality/provenance; response to evidence requests.

**Neon (N):** independent architecture and code review; identify defects and assumptions, trace state/identity boundaries, scrutinize error handling and test quality; propose reproducible synthetic checks.

**Kimi 3.1 (K, Moonshot):** equal independent auditor. Proposed initial contribution: adversarial review of overlooked failure modes, edge cases, regression tests, and alternative remedies. Kimi should propose its own areas of focus rather than assume this allocation is approved.

**All three:** challenge each other's findings, independently reproduce important defects when feasible, distinguish source claims from live proof, and jointly establish priorities and remedies. No auditor has a tie-breaking vote. All suggested role allocations and existing priority lists are provisional until unanimously approved.

## Mandatory three-way consensus

The user requires agreement by ChatGPT (C), Neon (N), and Kimi (K) on areas of focus and edits after collaborative brainstorming. Unanimity means three explicit, separately attributable approvals of the same version of a proposal. Silence, absence, inferred agreement, or two out of three votes do not count.

1. **Propose focus.** Each auditor independently proposes and critiques priorities, scope, dependencies and test strategy. General read-only reconnaissance is allowed before agreement, but do not launch an agreed workstream or assign implementation until C, N and K approve the same focus proposal.
2. **Discover and brainstorm.** Any auditor may register a suspected issue or evidence request without approval. All three review the evidence, competing explanations, severity and possible solutions, including a minimal change or no-change option. Record independent assessments, counterexamples, assumptions, tests and limitations. Avoid copying another auditor's verdict without independent reasoning.
3. **Confirm the issue.** All three must explicitly agree on the defect statement, scope and priority at a named source baseline. If evidence is insufficient, leave the finding provisional and define a discriminating test. Do not conflate consensus with independently verified clinical correctness.
4. **Approve the remedy.** Draft a versioned change proposal with exact intended files/behavior, alternatives, risk, regressions, acceptance tests, rollback and designated implementer. Obtain three explicit APPROVE votes on that exact revision, following brainstorming. A materially revised proposal or changed baseline invalidates prior votes until re-reviewed.
5. **Authorize and implement.** The existing user-authorization boundary remains: consensus is necessary but does not itself authorize runtime edits. Only after unanimous approval AND separate user authorization may the designated implementer change code. Keep checkpoints coherent, run required checks, and do not widen scope silently.
6. **Verify.** All three review the actual diff and test evidence before joint acceptance or release recommendation. Any unexpected behavior or material deviation reopens the relevant consensus gate. Live clinical validation and qualified human review remain independent requirements.

Any REVISE, OBJECT, NEEDS_EVIDENCE, or missing vote blocks approval. Preserve dissent and run a bounded additional investigation or escalate unresolved conflicts to the user. No unilateral emergency edits under this charter. For a serious suspected safety risk, flag and advise pausing affected workflows promptly; that is not permission to change code or process an order.

Coordination-only entries (handshakes, observations, proposals, votes, discussion, evidence requests and status updates) do not require advance unanimity because that would prevent collaboration. Changes to agreed scope, substantive decisions, the charter's decision rules or implementation require consensus; direct user instructions remain authoritative.

## Exchange and concurrent editing

Read the latest version of the coordination files before each turn. Append new records; preserve previous entries and attribution. Use UTC timestamps and stable IDs. Keep discussion in EXCHANGE.md; register defects in FINDINGS.md. Link immutable commit/path/line references and CI runs. Separate actual executed checks from static analysis.

Commit only your intended coordination changes. Fetch latest HEAD before committing, reconcile concurrent additions, use fast-forward updates, and never force-push or revert other auditors' contributions. Follow the repository's normal CI policy: no skip directives. Record a new message when handing off or requesting review.

This directory is a shared mailbox, not an autonomous messaging system. Each agent must explicitly retrieve the latest revision and commit its replies; no automatic notification or background polling is implied. User authorization remains the authority for changes outside this directory.
