# Current prototype downloads

The prototype branch contains a ready-to-run browser page and `windows-demo/Sig-Assist-Windows-Demo.zip`. Downloading the branch as a ZIP includes both; no local compilation is required. The app header displays the release version plus a source build ID, and `windows-demo/BUILD.json` records the full identity. v0.1.12 includes the November 17 fixes, local SIG dataset collection and the November 18 functionality-audit repairs.

Each normal push runs Windows/Linux checks. After both pass, `MVP checks → publish-prototype` builds the page and ZIP again and commits any changed generated files to prototype. It skips an outdated run if the branch has advanced, and uses a normal non-forced push so a concurrent source commit cannot be overwritten. Its GitHub Actions token does not recursively trigger another push workflow.

When a source-only commit is pushed, allow CI and its publication job to finish before downloading. A failed check retains the previous package and leaves the failed run visible; it does not publish an unchecked build. A documentation-only change that does not affect the application/package can leave the build ID unchanged. Versions identify feature batches; build IDs identify their source changes.

Developers should run `npm run prototype:package` before pushing runtime changes and include the generated page, BUILD.json and ZIP in the same commit. This command builds, packages and checks current sources. `npm run prototype:check` rejects a stale page or manifest, and checks that every ZIP member matches its current source. The fingerprint includes the UI, version/dependency data, connector, native helper, launchers and packaged troubleshooting guides; it works in a source ZIP without a Git checkout.

Never use Actions-skip directives on prototype commits. The publisher is a fallback for ordinary source-only pushes, not a reason to leave locally generated downloads uncommitted. Private workstation profiles and capture data remain outside public downloads.
