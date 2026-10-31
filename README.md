# ZenJudge

**Stay local. Think clearly. Blame the edge case.**

An offline-first Windows workspace for algorithm practice, built with **Tauri, Rust, React, and Monaco**. Browse problems, write solutions, keep your notes, and give your next practice session a little more structure.

For the session that starts with Two Sum and somehow ends with 27 tabs about mechanical keyboards.

[Features](#what-you-can-do) · [Get started](#get-started) · [Checks](#run-the-checks) · [Project map](#project-map) · [Release status](#release-status)

> [!IMPORTANT]
> **Development preview. Compilation and code execution are disabled.**
> Browsing, editing, drafts, existing history, notes, and focus tools are available. Run and Submit reject requests before starting a compiler or program. The former host runner was retired after a security review; an AppContainer worker is being investigated. There is no switch to restore unsafe execution.

## What you can do

| Feature | What it gives you |
|---|---|
| **Local problem library** | Search by title, filter by difficulty and tags, and browse topic-based study tracks. Three original demo packs cover sums, quiet runs, and rising steps. |
| **A familiar editor** | Monaco with C++ and Python editing, personal starter templates, and drafts saved per problem and language. Workers are bundled locally. |
| **Review your work** | Browse existing local submissions, compare source, and keep Markdown and math notes on accepted submissions. Failed note saves keep your text available for retry. |
| **Plan the next attempt** | Bookmark problems, mark them for another pass, and track local practice activity. |
| **Lock-In mode** | An optional fullscreen, always-on-top focus aid with focus-loss logging and a hold-to-abort shortcut. |
| **Local storage** | SQLite for practice records; WebView storage for drafts and interface settings. No account or cloud backend is required. |

Activity streaks use consecutive calendar days in your desktop's local timezone. A streak ending yesterday stays active until today ends; empty or older history shows zero. Your rest day deserves an honest number.

### A little help staying focused

Lock-In removes the window borders and records focus changes during a session. Hold **Ctrl + Shift + Q for three seconds** to leave it.

It is a practice aid, not tamper-resistant proctoring or an exam security system. It also cannot stop you from thinking about lunch. That remains a hardware limitation.

| Shortcut | Action |
|---|---|
| `Ctrl + K` | Focus dashboard search |
| `↑` / `↓`, then `Enter` | Select and open a problem from the dashboard |
| `Ctrl + Shift + Q` held for 3 seconds | Emergency exit from Lock-In |

## Get started

The current development target is **Windows**. You will need:

- Node.js and npm.
- Rust with the MSVC toolchain, C++ build tools, and a Windows SDK.
- Microsoft Edge WebView2.
- Python 3.12+ for the verification scripts; Chrome or Edge for browser regressions.

The verified development environment used **Node 24.13.0** and **Rust 1.99.1**. Other versions have not been certified. A solution compiler or Python interpreter is not needed to browse or edit while execution is disabled.

Get a checkout (or download the repository ZIP and extract it):

```powershell
git clone https://github.com/RefactorKai/ZenJudge.git
cd ZenJudge
```

From the repository root:

```powershell
npm ci --ignore-scripts
npm start
```

Dependency installation and the first build may need internet access. Normal app use is designed around bundled assets and local data.

To update an existing checkout, save your work, run `git pull --ff-only`, then run `npm ci --ignore-scripts` and `npm start` again. Your database and WebView drafts are outside the tracked source tree.

`npm run dev` starts the frontend by itself. Native database and problem commands require the Tauri desktop app, so use `npm start` for the working development interface.

## Your files stay on your machine

| Data | Location |
|---|---|
| Submission history, notes, bookmarks, redo marks, and focus logs | `%APPDATA%/com.zenjudge.desktop/zenjudge.db` |
| Editor drafts, personal templates, and interface settings | The app's local WebView storage |
| Problem packs during development | This checkout's `problems/` directory |
| Problem packs in a packaged build | Tauri's bundled resource directory |

On first use of the new database location, ZenJudge imports a known legacy `data/zenjudge.db` when no destination database exists. Debug builds check this checkout; installed builds check beside the executable. The import includes committed WAL data, retains the original, and never overwrites an existing destination. **Close older ZenJudge instances before that first launch.**

A leftover `.db.importing` file requires inspection rather than silent replacement. See the [migration and security notes](docs/security/remediation.md) for the validation scope.

Drafts and settings are separate from the SQLite database. Keep a copy of important work, especially before changing development/packaged WebView origins: settings are not automatically transferred between them.

## Problem packs

During development, add a folder under `problems/`, then use **Import Problem → Scan & Reload Problems**.

```text
problems/
└── your-problem/
    ├── meta.json
    ├── statement.md
    └── testcases.json
```

Use [Signal Sum's metadata](problems/demo-signal-sum/meta.json), [statement](problems/demo-signal-sum/statement.md), and [testcases](problems/demo-signal-sum/testcases.json) as format references. Folder names use lowercase letters, digits, and internal hyphens; the metadata slug must match. Loaders validate paths, limits, and pack sizes and reject symbolic links and junctions.

Compressed `testcases.bin` files are also supported. If both formats exist, the binary takes precedence; keep the copies in sync when editing a pack.

Non-sample cases are local learning material. Their inputs and expected answers are **not confidential** from the owner of the computer. There is no hidden-assessment mode.

## Run the checks

These commands keep verification outputs in disposable directories:

```powershell
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build --outDir .audit-work/frontend-dist
python scripts/run-safe-checks.py
node scripts/frontend-regressions.mjs
node scripts/editor-regressions.mjs
node scripts/workspace-regressions.mjs
python scripts/source-manifest.py
```

- **Rust:** bounded checks with separate Cargo output, fresh temporary directories, and synthetic databases.
- **Markdown:** math rendering and remote-resource restrictions.
- **Controller:** draft persistence, history restoration, and stale-response handling.
- **Real Monaco workspace:** current hotkey code/language, busy and lock guards, note-save failure/retry, local workers, and production CSP. Native responses and user data are synthetic.
- **Publication manifest:** an allowlisted source file list with hashes and a heuristic credential scan. It does not export or upload files.

Legacy execution tests and the old stress harness were retired and are not counted as passing security tests; the checks above do not launch disk, thread, fork, or registry payloads.

Passing these checks does not certify a clean installation, installed Windows WebView behavior, or hostile-code containment. The detailed results and remaining gates live in the [remediation report](docs/security/remediation.md).

## Project map

```text
src/                    React interface, controller, and local Monaco setup
src/components/         Dashboard, problem view, editor, notes, and focus tools
src-tauri/src/          Native commands, SQLite, and validated problem loading
src-tauri/src/runner/   Execution rejection and comparison contracts
src-tauri/tests/        Native integration and security regressions
problems/demo-*/         Original demo statements and fixtures
scripts/                Bounded checks and publication-manifest tooling
docs/                   Release, provenance, and security documentation
.github/workflows/      Windows CI checks
assets/brand/           Source for the temporary app mark
```

## Release status

ZenJudge is an **unfinished desktop practice workspace**. The next release gates are:

- A verified compiler/runtime isolation boundary, with resource supervision and writable-storage quotas, before restoring execution.
- Clean-install, resource, migration, startup-error, and installed WebView/Lock-In verification.
- Further content and binary-redistribution notice reviews before adding third-party packs or distributing a packaged installer.

The frontend uses a restrictive CSP, local assets, and constrained Markdown rendering. Those controls do not make the computer air-gapped or establish a sandbox for native programs. Pack validation also does not protect against a same-user process racing to replace ancestor directories.

**This is a GPLv3 source preview, not a production judge release.** Secure-execution desktop distribution and internet hosting remain on hold. There is no internet execution service. Do not publish the working directory: it can contain private databases, sidecars, dependencies, build output, and local audit artifacts.

Read the [publication gates](docs/releasing.md), [provenance decisions](docs/provenance.md), and [AppContainer investigation](docs/appcontainer-worker.md) before preparing a release. The application and original demo content use [GPL-3.0-only](LICENSE). Legacy packs and unverified artwork are excluded from publication. Third-party materials retain their own licenses; see [notices](THIRD_PARTY_NOTICES.md) and [problem sources](docs/problem-sources.md).

The goal is a calmer place to practice. The off-by-one errors can provide their own excitement.
