# Development checkpoints

The user requires incremental commits and remote preservation. The previous
workspace was removed by automated maintenance before unfinished changes were
committed. Local files and agent messages are not backups of source code.

- Save each coherent implementation or test increment to the authorized working
  branch on GitHub. Do not defer all commits until the whole task passes tests.
- During long work, checkpoint meaningful partial changes at least every ten
  minutes when remote writes are available. Mark incomplete work explicitly.
- Verify the remote branch contains the checkpoint. A local commit alone does
  not survive loss of this execution workspace.
- With agents sharing a checkout, designate one writer for Git staging and
  remote commits. Agents report ready file lists promptly and avoid overlapping
  ownership. The coordinator checkpoints their work while other work continues.
- Development checkpoints may use `[skip ci]`; run the required checks on the
  completed change before describing it as validated or publishing a build.
- If remote preservation fails, report the blocker and prioritize saving the
  current patch through an available durable channel before expanding the work.

Never commit PHI, private captures, workstation-specific paths or credentials.
FWDirect is excluded from this project by the user's explicit instruction.
