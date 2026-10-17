# Dependency Register

This register lists the external dependencies of TeachLink Backend that a
maintainer is accountable for: who owns each dependency, under what
license it is used, and when it was last reviewed. It exists so that a
license change, a vulnerability, or a maintainer departure never surprises
the project.

This document is part of the project's **Compliance** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Tracked Fields Per Dependency

Each dependency in the register carries these fields:

| Field | Meaning |
|---|---|
| Dependency | Package name and the ecosystem it comes from (npm, container image, tool). |
| Version | The version range actually required by the project. |
| Purpose | Why the project depends on it, in one line. |
| Owner | The GitHub handle accountable for keeping this entry current. |
| License | The SPDX identifier of the license under which it is used. |
| Criticality | Core (release-blocking) or peripheral. |
| Last reviewed | Date of the last review of license, criticality, and owner. |

## Register

| Dependency | Version | Purpose | Owner | License | Criticality | Last reviewed |
|---|---|---|---|---|---|---|
| *(entries added as dependencies are adopted)* | | | | | | |

## Owner And License Fields

- **Owner** is mandatory for every entry. The owner is not necessarily the
  author of the code that introduced the dependency — it is whoever will
  act when the entry needs updating. When an owner steps down, the entry
  is reassigned before their offboarding completes.
- **License** records the SPDX identifier. If the license is not on the
  project's approved list, the entry is flagged in the review below and a
  decision is recorded before the dependency is used in a release.

## Review Cadence

- Every dependency entry is reviewed at least **quarterly** by its owner.
- Reviews confirm the version range, the license, the criticality, and
  that the owner still accepts the responsibility.
- A vulnerability disclosure or a license change triggers an **immediate**
  out-of-cycle review of the affected entry, independent of the cadence.
- Each review updates the **Last reviewed** date; an entry whose date is
  more than one quarter old is treated as unreviewed at the next audit
  (`Governance/runbooks/DEPENDENCY_AUDIT_RUNBOOK.md`).
