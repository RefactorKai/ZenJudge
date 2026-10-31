# Working on ZenJudge

This is a Windows development preview. Compilation and submission execution are disabled until a verified containment boundary is implemented. Do not restore the retired host runner or treat source filtering as isolation.

## Run locally

Install Node.js 24, Rust/MSVC, C++ build tools with a Windows SDK, and Microsoft Edge WebView2. Python 3.12+ is used for checks. Browser regressions also need Chrome or Edge.

```powershell
npm ci --ignore-scripts
npm start
```

`npm start` launches the Tauri desktop app. `npm run dev` is only the Vite frontend and cannot access native commands by itself.

## Validate changes

From the repository root:

```powershell
npm run check
node node_modules/vite/bin/vite.js build --outDir .audit-work/frontend-dist
python scripts/run-safe-checks.py
npm test
python scripts/source-manifest.py
```

Tests use synthetic databases and separate temporary/build storage. Keep real databases, submissions, drafts and local configuration out of fixtures and commits. The publication manifest is an allowlist plus a heuristic scan, not proof that arbitrary private information is absent.

For a local executable, use `npm run desktop:build`. The debug executable depends on its checkout/resource layout; a Windows release package is a separate build, not a portable copy of that file. See [release instructions](docs/releasing.md).

## Repository layout

- `src/`: React interface and bundled Monaco setup.
- `src-tauri/`: Tauri commands, SQLite, pack validation and runner contracts.
- `problems/demo-*`: original demonstration statements and fixtures.
- `assets/brand/`: source for the temporary geometric mark.
- `docs/`: development, content provenance and security evidence.
- `scripts/`: checks, source export and release preparation.
- `.github/workflows/`: Windows CI checks.

Small, complete changes are preferred. Preserve error handling and existing user data. Add focused regressions for behavior changes. If a feature needs a larger execution/security architecture, discuss its boundary and lifecycle before enabling it.

Third-party problem content must have documented redistribution terms. A public URL alone is not a license. CSES and Blind 75 references are recorded in [problem sources](docs/problem-sources.md).
