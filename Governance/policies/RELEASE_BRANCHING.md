# Release Branching Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/RELEASE_BRANCHING.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All release activities in inafcode/teachLink_backend |

## 1. Branching model

- **`main`**: Production-ready code. Always deployable.
- **`develop`**: Integration branch for the next release cycle.
- **`release/x.y.z`**: Stabilization branch cut from `develop` for a
  specific release. Only bug fixes are cherry-picked here.
- **`hotfix/x.y.z`**: Emergency fix branch cut from `main`.

## 2. Cut and stabilization steps

1. A `release/x.y.z` branch is cut from `develop` when the feature set is
   frozen.
2. Only bug fixes and documentation updates are committed to the release branch.
3. The release branch is tested and validated.
4. On release day, the release branch is merged to `main` and tagged.
5. The release branch is then back-merged to `develop`.

## 3. Backport flow

- Critical bug fixes merged to `main` are backported to the active release
  branch if applicable.
- Backports are cherry-picked commits with the original PR referenced.
- A backport PR is opened against the release branch and follows the standard
  review process.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |