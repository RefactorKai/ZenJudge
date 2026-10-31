# Publication gates

Source publication, desktop distribution and internet hosting are separate decisions. The owner authorized a public GPLv3 **development preview** with original demo content. Secure-execution desktop distribution and internet hosting remain on hold.

For source publication:

1. Check the content and license inventory in `provenance.md`.
2. Run `python scripts/source-manifest.py`. It writes `.audit-work/publication-manifest.json` with exact allowlisted file paths, sizes and SHA-256 values, and scans their bytes for high-confidence credential patterns. The allowlist includes only original `demo-*` packs and excludes legacy local packs, private usage data and generated output. Review the exact list before publishing; the scan is heuristic. A later edit invalidates the prior manifest.
3. Publish only the reviewed files, never the working directory. `.gitignore` prevents ordinary future additions of state/dependencies/builds and `.gitattributes` excludes them from Git archives. Neither removes already tracked history nor protects arbitrary manual zip uploads. The pre-remediation directory had no Git history to audit.
4. Exclude live databases, WAL/SHM/journals, source submissions, notes, settings, local instructions, environment/credential files, logs, generated schemas, dependencies, build output and `.audit-work/`. The latter contains baseline source copies and disposable test/browser data. Do not upload it.

## Running from source

On Windows, install Node.js 24/npm, Rust/MSVC, C++ build tools with a Windows SDK, and Microsoft Edge WebView2. Clone `https://github.com/RefactorKai/ZenJudge.git`, or extract the source ZIP. From that directory:

```powershell
npm ci --ignore-scripts
npm start
```

`npm start` opens the Tauri desktop preview. `npm run dev` alone opens a frontend without the native problem/database commands. Subsequent updates use `git pull --ff-only` followed by `npm ci --ignore-scripts`. Keep personal work outside tracked source files.

The original demo packs are bundled as Tauri resources for packaged builds. Debug builds use the checkout. Never distribute `target/debug/zenjudge.exe` alone as a portable app: debug behavior depends on the checkout and packaged release resources must be validated separately.

## Desktop release gate

Verify a clean installation, resource mapping, app-data import, local fonts/Monaco under production CSP, WebView navigation, startup/storage error handling, and window-abort behavior. A successful source build is not an installer smoke test. Execution is deliberately unavailable. A release offering execution must first satisfy the [AppContainer gates](appcontainer-worker.md). No secure-executor claim is supported.

For internet hosting: HOLD. There is no execution service, tenant identity model, authorization, admission/rate limits, storage quotas or confidential grader architecture. Serving the frontend alone does not implement the native backend. Do not wrap the desktop commands in an HTTP endpoint.
