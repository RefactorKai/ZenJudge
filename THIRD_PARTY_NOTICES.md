# Third-party components

ZenJudge's application code and original demo packs use GPL-3.0-only. Dependency licenses remain their respective upstream licenses; the project license does not replace them.

Dependencies are fetched using the committed npm and Cargo lockfiles. The source repository does not vendor dependency trees or toolchains. See `package-lock.json` and `src-tauri/Cargo.lock` for exact versions and source references.

Main components include Tauri, React, Monaco Editor, KaTeX, SQLite/rusqlite, serde, chrono, flate2, Tailwind CSS and Lucide icons. Their source distributions contain their copyright and license notices. Preserve those notices when redistributing dependencies or a compiled app, including KaTeX's bundled fonts.

The temporary geometric mark in `assets/brand/mark.svg` and its generated app icons were created for this demo release. They replace the previous, unverified artwork in the publication set.

No third-party problem statements are included in the core preview. See [content provenance](docs/provenance.md) and [problem sources](docs/problem-sources.md).

This source preview is not a completed notice audit for a signed binary installer or a bundled C++/Python toolchain. Those distributions require a review of their actual included materials before release.
