# Security scope

ZenJudge is currently a local Windows practice-workspace preview. It rejects compiler/interpreter/submission launches. It is not a secure hostile-code executor, an exam browser, or an internet judge service.

The SEB-inspired Lock-In feature is an opt-in focus aid. It changes the app's window state and records focus changes. It does not prevent a computer owner from switching programs, terminating the app, changing local files or using another device.

Before restoring execution, require an OS-enforced filesystem/network boundary for both compilation and runtime, bounded storage and supervision, cancellation and failure-injection regressions. See [the worker investigation](docs/appcontainer-worker.md).

## Reporting a vulnerability

Use GitHub's private vulnerability-reporting feature if it is available on this repository. Otherwise open an issue asking for a private reporting channel, without exploit details, secrets or personal data. Do not run destructive probes against a machine containing valuable data.

The [remediation record](docs/security/remediation.md) distinguishes fixed paths, removed functionality, and unresolved properties. Passing tests are not a guarantee that no security flaws exist.
