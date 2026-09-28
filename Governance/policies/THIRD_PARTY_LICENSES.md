# Third-Party License Policy

**Policy version:** 1.0.0  
**Effective date:** 2026-09-28

## Purpose and scope

This policy defines the licenses permitted for third-party software and other dependencies used or distributed by TeachLink Backend. It applies to production and development dependencies, transitive dependencies, and third-party components bundled with or distributed by the project. License compliance is checked by the repository's automated license scanner and reviewed as part of dependency changes.

The machine-readable policy in `compliance/configs/license-policy.yml` is used by the scanner. This document is the human-readable governance reference; changes to either policy must keep their license classifications aligned.

## Permitted licenses

Dependencies under these licenses are permitted, subject to meeting the license's notice, attribution, source-disclosure, and other applicable obligations:

- 0BSD
- Apache-2.0 (including the `Apache-2` identifier)
- BSD-2-Clause
- BSD-3-Clause
- BSD-4-Clause
- BlueOak-1.0.0
- CC0-1.0
- CC-BY-4.0
- ISC
- MIT
- MPL-2.0
- Python-2.0
- Unlicense

## Prohibited licenses

The following licenses are prohibited for project dependencies:

- AGPL-3.0
- GPL-3.0
- Proprietary
- SSPL-1.0

Do not add or retain a dependency identified under a prohibited license. Replace it with a permitted alternative or remove it. An automated scan failure must be resolved before merging.

## Licenses requiring review

These licenses are not pre-approved and require review before the dependency is introduced or upgraded:

- LGPL-2.1
- LGPL-3.0
- GPL-2.0
- Unknown, missing, or conflicting license information

The contributor must provide the license evidence and describe how the dependency is used and distributed. Maintainers must obtain legal review for license terms and technical review where linking, modification, or redistribution affects the obligations. Approval and its rationale must be recorded in the pull request or a linked issue. A review-required dependency must not be treated as permitted until approval is recorded.

## Exception process

Exceptions are not automatic and must be approved before merging or distributing the affected dependency. The contributor must open a pull request or issue that records:

1. The dependency name, version, source, and license evidence.
2. The project need and why a permitted alternative is unsuitable.
3. The intended use, linking and modification model, and distribution obligations.
4. The proposed controls, required notices or source offers, and any limits or expiry for the exception.

A maintainer must approve the exception, and legal review is required for any prohibited license or material uncertainty about obligations. Technical review is required when integration or distribution details affect compliance. The approval and rationale must be recorded with the issue or pull request. An exception involving a prohibited or review-required license also requires an approved update to `compliance/configs/license-policy.yml` so automated enforcement reflects the decision; until that update and required approvals are complete, the dependency remains blocked. Exceptions must be revisited when the dependency, license, use, or distribution model changes.

## Enforcement and policy changes

The license scan runs in CI for pull requests and pushes to the protected branches. Prohibited licenses fail compliance; review-required or unknown licenses require documented review. Contributors must resolve findings and preserve required license notices before merging.

Changes to the permitted, prohibited, or review-required classifications require maintainer approval and must update this document and the machine-readable policy together. Increment the policy version when classifications or exception requirements change; clarify wording without changing requirements in the change history only when useful.

### Version history

- 1.0.0 (2026-09-28): Establish the third-party license policy and exception process.
