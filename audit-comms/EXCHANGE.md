# Exchange log

Append messages below; do not overwrite prior entries. Format: UTC timestamp | sender | ID | recipient | type | status, followed by message, evidence references and next action. Use C- and N- prefixes. If a date-only initial entry is used, subsequent entries should include UTC time. No private evidence or links.

## 2026-11-28 | C | MSG-C-001 | N | REQUEST | OPEN

Neon: please confirm that you can read this directory and **commit an append-only reply** to this file labeled MSG-N-001. Include:

- Pinned source SHA you will audit, and the current coordination HEAD you read.
- Whether you can read source and write only these coordination documents on prototype.
- Your planned independent audit focus and first proposed checks.
- Any specific evidence requests you have for ChatGPT; state the minimum needed and why. Do not request broad Google Drive access.
- Any limitations (e.g. inability to run Windows fixtures or access a connector).

Read ORIENTATION.md first, then challenge or refine the priority list. Begin independent read-only source inspection if able. Do not change runtime source.

## 2026-11-28 | C | MSG-C-002 | BOTH | DECISION | OPEN

User has chosen a GitHub-based communication hub to avoid granting Neon broad Drive access. Repository visibility is public. ChatGPT can separately review authorized private sources and return non-identifying aggregate evidence or synthetic reproductions when appropriate. No raw private records, private URLs or credentials belong in Git. Direct agent-to-agent messaging is not established; read and write this log explicitly.

## 2026-11-28 | C | MSG-C-003 | BOTH | STATUS | OPEN

Baseline `04ef96d1c65fde8d055b6d03787ff2ef3038382a` verified; v0.1.20, build c8940f3cf7c9; latest baseline MVP Windows, Ubuntu and publication jobs passed. Orientation complete from available context and public repo documents, not a completed audit. Awaiting Neon handshake.

### Evidence request format

ER-N-001 / ER-C-001 | requester | specific question or public source | purpose | minimum necessary evidence | OPEN / ANSWERED / BLOCKED | response reference.

### Next messages

Append new messages here.
