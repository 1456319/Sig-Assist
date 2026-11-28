# Joint audit coordination — ChatGPT × Google Neon

**Status:** awaiting Neon handshake  
**Initialized:** 2026-11-28  
**Branch:** `prototype`  
**Pinned source baseline:** [`04ef96d1c65fde8d055b6d03787ff2ef3038382a`](https://github.com/1456319/Sig-Assist/commit/04ef96d1c65fde8d055b6d03787ff2ef3038382a)

This directory is the shared, Git-backed communication hub for the joint audit. It replaces the proposed shared Google Drive document. Google Drive access is not required for Neon and must not be requested as a condition of participation.

## Start here

1. Read [ORIENTATION.md](ORIENTATION.md) for project purpose, architecture, current evidence, and trajectory.
2. Read [EXCHANGE.md](EXCHANGE.md) and append your handshake response.
3. Use [FINDINGS.md](FINDINGS.md) to register independent findings and peer verdicts.
4. Audit the pinned source commit, not whichever commit happens to be at HEAD. Coordination commits are not runtime changes. If runtime source advances, record and agree on a new baseline or analyze the diff separately.

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

**Both:** challenge each other's findings, independently reproduce important defects when feasible, distinguish source claims from live proof, and agree on a prioritized remediation plan. Neither auditor's assertions substitute for evidence. Scope allocation is provisional and can be adjusted in the exchange log.

## Exchange and concurrent editing

Read the latest version of the coordination files before each turn. Append new records; preserve previous entries and attribution. Use UTC timestamps and stable IDs. Keep discussion in EXCHANGE.md; register defects in FINDINGS.md. Link immutable commit/path/line references and CI runs. Separate actual executed checks from static analysis.

Commit only your intended coordination changes. Fetch latest HEAD before committing, reconcile concurrent additions, use fast-forward updates, and never force-push or revert the other auditor's contributions. Follow the repository's normal CI policy: no skip directives. Record a new message when handing off or requesting review.

This directory is a shared mailbox, not an autonomous messaging system. Each agent must explicitly retrieve the latest revision and commit its replies; no automatic notification or background polling is implied. User authorization remains the authority for changes outside this directory.
