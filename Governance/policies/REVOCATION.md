# Privilege Revocation Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2025-01-01
- **Review cadence:** Every 6 months, or after any revocation appeal

This policy defines how privileges granted to contributors, reviewers,
maintainers, and other community members of the TeachLink project may be
**revoked**. It exists so that revocation is transparent, consistent, and
appealable, rather than ad hoc.

"Privilege" means any elevated access or trust granted by the project,
including but not limited to:

- Repository access (write, maintain, or admin permissions).
- Reviewer or maintainer status (see the contributor ladder).
- Ownership of a code area, package, or release responsibility.
- Membership in project communication channels or security groups.
- Access to project infrastructure, secrets, or deployment credentials.

This document is governance only. It does not change application behaviour and
is scoped entirely to the `Governance/` folder.

## 1. Grounds for revocation

A privilege may be revoked only when there is a documented, verifiable reason.
Recognised grounds are:

1. **Security risk** — a compromised account, leaked credentials, or credible
   evidence that access is being abused or is likely to be abused.
2. **Code of Conduct violation** — a confirmed breach of the project's Code of
   Conduct, including harassment, discrimination, or retaliation.
3. **Abuse of privilege** — using elevated access to bypass review, merge
   unreviewed changes, alter protected branches, or otherwise circumvent
   project process.
4. **Inactivity** — prolonged inactivity in a role where the responsibility
   cannot be met (for example, an unresponsive maintainer blocking reviews).
   Inactivity is handled as a *graceful* revocation (see §5).
5. **Conflict of interest** — an undisclosed conflict that compromises the
   impartiality required by the role.
6. **Legal or regulatory requirement** — a lawful order or a contractual or
   licensing obligation that requires removal of access.
7. **Repeated non-compliance** — a pattern of ignoring review, triage, or
   disclosure obligations after documented feedback.

Revocation is **not** a punishment for disagreement. Holding a minority
technical opinion, voting against a proposal, or raising concerns in good faith
is never grounds for revocation.

## 2. Who can initiate revocation

Any community member may **request** revocation by contacting a maintainer or
the Code of Conduct team privately. A request must include the ground(s) from
§1 and any supporting evidence.

Only the following may formally **initiate** a revocation:

| Initiator | Scope of revocation they may initiate |
| --- | --- |
| Any maintainer | Reviewer status, area ownership, channel membership |
| Two maintainers acting together | Maintainer status, repository write/maintain access |
| Code of Conduct team | Any privilege, when a Code of Conduct violation is confirmed |
| Security team | Any privilege, on security grounds (§1.1) |
| Project lead / steering group | Any privilege, including admin access |

Rules that apply to every initiation:

- **No self-review.** The person initiating a revocation must not be the sole
  decision-maker on it.
- **Recusal.** Anyone with a personal conflict of interest in the case must
  recuse themselves from the decision.
- **Least privilege.** Revoke the *minimum* access necessary to address the
  ground; prefer a temporary suspension over permanent removal where the risk
  can be contained.
- **Confidentiality.** The fact and details of a revocation are shared only
  with those who need to know, subject to §4.

## 3. Process

1. **Report / request.** The initiator records the ground(s), evidence, and the
   specific privilege(s) at issue.
2. **Triage.** A maintainer confirms the request is in scope and identifies any
   required recusals. Security grounds may be handled under embargo.
3. **Decision.** The initiating body (per §2) decides by consensus. If
   consensus cannot be reached, the decision escalates to the project lead or
   steering group.
4. **Notification.** The affected person is notified in writing, with the
   ground(s), the privilege(s) revoked, the effective date, and the appeal path
   (§4). Where a security or legal constraint prevents full disclosure, the
   notice states that a constraint applies.
5. **Execution.** Access is removed promptly. For security grounds, revocation
   may take effect **immediately and before notification**.
6. **Record.** The decision is logged in the governance decision record with
   the date, ground(s), scope, and outcome. Personal details are minimised.

### Emergency revocation

When there is an active security risk, a single maintainer or the security team
may revoke access **immediately** to contain the risk. An emergency revocation
must be reviewed by the initiating body within **72 hours**, and the affected
person must be notified as soon as the constraint allows.

## 4. Appeal path

Every revocation is appealable, except where a legal or regulatory constraint
prohibits it (the notice will say so).

1. **File the appeal.** The affected person submits a written appeal within
   **14 days** of notification to the project lead or steering group, stating
   why the ground(s) do not apply or why the scope was disproportionate.
2. **Acknowledge.** The appeal is acknowledged within **5 business days**.
3. **Independent review.** The appeal is reviewed by people who were **not**
   involved in the original decision. The reviewer may request additional
   evidence from either side.
4. **Decision.** A written decision is issued within **21 days** of
   acknowledgement. Outcomes are:
   - **Upheld** — the revocation stands.
   - **Modified** — the scope or duration is reduced (for example, a permanent
     ban becomes a time-boxed suspension).
   - **Overturned** — the privilege is restored, with access reinstated as soon
     as practicable.
5. **Final escalation.** If the appeal was decided by the project lead, a
   further appeal may be made to the steering group, whose decision is final.

### Reinstatement

A person whose privilege was revoked may apply for reinstatement after the
period stated in the decision (or, for indefinite revocations, after **6
months**). Reinstatement follows the normal contributor-ladder process and
requires the approval of the body that made the original decision or its
successor.

## 5. Graceful (inactivity) revocation

For inactivity (§1.4), the process is deliberately gentler:

1. A maintainer contacts the inactive person to confirm availability.
2. If there is no response within **30 days**, the privilege is moved to
   *emeritus* status where the role supports it.
3. Emeritus status preserves recognition and can be reactivated on request
   without a new appeal.

## 6. Relationship to other policies

- Code of Conduct enforcement is governed by the Code of Conduct and its
  enforcement process; this policy covers the *access* consequences.
- Security disclosures and embargoes are governed by the security and
  disclosure policy.
- Role definitions and the contributor ladder are governed by the roles &
  membership documents.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 7. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2025-01-01 | Initial privilege revocation policy (grounds, initiators, appeal path). |
