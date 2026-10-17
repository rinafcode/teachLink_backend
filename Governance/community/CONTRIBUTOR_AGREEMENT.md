# Contributor Agreement

| Field | Value |
| --- | --- |
| Document | `Governance/community/CONTRIBUTOR_AGREEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months |
| Applies to | Everyone who contributes code, documentation, or other material to `rinafcode/teachLink_backend` |
| Related | [`policies/DCO.md`](../policies/DCO.md) · [`policies/CONTRIBUTOR_SIGNOFF.md`](../policies/CONTRIBUTOR_SIGNOFF.md) · [`policies/LICENSING.md`](../policies/LICENSING.md) |

This document is the human-readable overview of what a contributor agrees to
when they contribute to the project. It is not a contract and it adds no
obligation beyond the licence and the sign-off described below; the authoritative
texts are [`policies/DCO.md`](../policies/DCO.md),
[`policies/CONTRIBUTOR_SIGNOFF.md`](../policies/CONTRIBUTOR_SIGNOFF.md), and the
project's [`LICENSE`](../../LICENSE).

## 1. What contributors agree to

By contributing, you agree that:

1. **You have the right to contribute the work.** The contribution is your own
   original work, or you have permission to submit it, and it does not knowingly
   infringe anyone's copyright, patent, or trademark.
2. **Your contribution is licensed under the project's licence.** The licence for
   this repository is described in [`policies/LICENSING.md`](../policies/LICENSING.md)
   and the root [`LICENSE`](../../LICENSE). Inbound contributions are licensed
   under the same terms as outbound, so the project can distribute them.
3. **You follow the Code of Conduct.** Participation is governed by
   [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) and enforced under
   [`COC_ENFORCEMENT.md`](../COC_ENFORCEMENT.md).
4. **You follow the contribution process.** Branching, commits, the PR checklist,
   and review expectations are defined in [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
5. **You will not contribute secrets or third-party material you cannot license.**
   Do not submit credentials, `.env` values, customer data, or code copied from a
   source you do not have the right to relicense.

## 2. Sign-off mechanism

The project uses the **Developer Certificate of Origin (DCO)**, not a CLA. You
sign off by adding a `Signed-off-by:` trailer to each commit:

```
Signed-off-by: Full Name <email@example.com>
```

`git commit -s` adds it for you. The trailer certifies the statements in §1 and
is described fully in [`policies/DCO.md`](../policies/DCO.md). Commits without a
valid sign-off may be asked to amend before merge.

## 3. Where records are kept

- **The commits themselves are the record.** The `Signed-off-by` trailer in the
  repository history is the primary, durable record of each contribution and its
  sign-off.
- **Pull requests** keep the review trail: who proposed the change, who reviewed
  it, and the discussion that led to the merge.
- **No separate private registry** of contributors is maintained for the DCO;
  the git history is sufficient and auditable. Maintainer-role records, if any,
  live with the governance documents in this folder.
- Personal data in a sign-off is limited to the name and email you choose to
  publish in the commit, in line with the project's data-minimisation principle.

## 4. If you change your mind

You may stop contributing at any time. Because the DCO grants an irrevocable
licence for contributions already made, merged contributions remain part of the
project under the project's licence. If you have a concern about a specific
contribution, raise it with the maintainers rather than rewriting published
history.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
