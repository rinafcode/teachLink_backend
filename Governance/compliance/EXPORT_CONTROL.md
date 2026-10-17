# Export Control Policy

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/EXPORT_CONTROL.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months, and before adding a new dependency or distributing binaries |
| Applies to | The open-source codebase, its release artifacts, and project-funded distributions |
| Related | [`compliance/SANCTIONS.md`](SANCTIONS.md) · [`policies/LICENSING.md`](../policies/LICENSING.md) · `LICENSE` |

This policy describes how the project thinks about export control and economic
sanctions as an open-source software project: what is distributed, the
cryptography that is shipped, and the sanctioned-party screening that applies to
project-sponsored activity. It is a compliance statement of intent, not legal
advice; where a legal question is live, the project seeks counsel.

## 1. Scope and character of the project

- **The project is open source.** Source code is published publicly under the
  project's [`LICENSE`](../../LICENSE), which is available to everyone, including
  persons in other countries. Most open-source code is **not subject to export
  controls** for that reason, and this is the project's default posture.
- **What this policy reaches.** It applies to code, binaries, and technical data
  that the project itself distributes or makes available, and to project-funded
  transactions. It does not purport to regulate what independent users do with
  the code.
- **No end-user restriction in the license.** Consistent with open-source
  practice, the license does not discriminate against persons or groups. This
  policy therefore governs the project's own conduct, not who may use the code.

## 2. Cryptographic functionality

- **The software uses cryptography.** It relies on standard cryptographic
  primitives for transport security, password hashing, and token signing; it does
  not implement novel or export-restricted strong encryption of its own beyond
  what the chosen libraries provide.
- **Notification where required.** Because cryptographic software can trigger
  export notification obligations in some jurisdictions, the project records the
  cryptographic functionality in the dependency inventory and includes the
  standard export notice in release metadata where a distribution channel
  requires one.
- **No circumvention.** The project does not knowingly build or ship tooling
  whose purpose is to circumvent export controls or sanctions.

## 3. Sanctioned parties and restricted destinations

- **Screening applies to project-funded activity.** Before the project enters a
  paid relationship — a sponsorship, a grant, a paid contractor, or a hosted
  service the project pays for — the counterparty is screened against the
  applicable restricted-party and embargoed-destination lists, following
  [`compliance/SANCTIONS.md`](SANCTIONS.md).
- **Contributions are not screened as transactions.** Accepting a public
  contribution through the normal contribution process does not, by itself,
  constitute a controlled export; the project follows
  [`policies/DCO.md`](../policies/DCO.md) and
  [`policies/CONTRIBUTOR_SIGNOFF.md`](../policies/CONTRIBUTOR_SIGNOFF.md) for
  contributions.
- **Sponsorships are covered.** Sponsorship arrangements follow the screening and
  disclosure rules in [`community/SPONSORSHIP.md`](../community/SPONSORSHIP.md).

## 4. Dependencies and third-party components

- **Inventory.** Third-party dependencies are tracked so their licenses and any
  export-relevant functionality are known; see
  [`policies/LICENSING.md`](../policies/LICENSING.md).
- **Escalation.** If a dependency is discovered to require export authorisation
  for the project's distribution, the maintainers assess whether to keep,
  replace, or gate it, and document the decision.

## 5. Records and escalation

- The maintainers review this policy at least **every 12 months**, and whenever a
  new binary distribution, a new cryptographic dependency, or a new funded
  relationship appears.
- Any concern that a project activity may implicate export controls or sanctions
  is raised privately with the maintainers and, where appropriate, escalated
  under [`processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md) before
  the activity proceeds.

## 6. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
