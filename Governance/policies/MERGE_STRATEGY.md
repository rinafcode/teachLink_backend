# Merge Strategy Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/MERGE_STRATEGY.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All pull requests merged into inafcode/teachLink_backend |

## 1. Allowed merge strategies

| Strategy | When to use |
| --- | --- |
| Squash and merge | Default for all PRs to `main` and `develop` |
| Rebase and merge | When commit history must be preserved (rare, requires maintainer approval) |
| Create a merge commit | Not permitted |

## 2. Squash and linear-history rules

- All PRs are squashed into a single commit on merge.
- The squash commit message follows the conventional commit format.
- The PR title becomes the squash commit message subject.
- Linear history is maintained on `main` and `develop` — no merge commits
  other than squash commits are allowed.
- Force-pushing to `main` or `develop` is prohibited.

## 3. Exceptions

- Rebase-and-merge may be used when a PR contains meaningful individual commits
  that should be preserved (e.g. a series of logically distinct changes).
- Exceptions require explicit approval from 2 maintainers.
- Any exception must be documented in the PR description with justification.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |