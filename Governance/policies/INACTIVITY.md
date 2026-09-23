# Inactivity Policy

This document defines how TeachLink handles **inactivity** for contributors and
maintainers. It exists so that roles, access, and responsibilities stay accurate
over time, and so that anyone who steps away can return without friction.

This policy is part of the `Governance/` folder and is self-contained: it does
not affect application code or runtime behaviour.

## 1. Scope

This policy applies to every role listed in the contributor ladder, including:

- Contributors (anyone with merged contributions)
- Reviewers
- Maintainers
- Triagers
- Working-group / committee members

"Activity" means any of the following, recorded in the project's public
systems (GitHub, the repository, or the project's communication channels):

- Opening, commenting on, reviewing, or merging issues and pull requests
- Participating in governance discussions, RFCs, or votes
- Performing role duties (triage, review, release, moderation)

## 2. Inactivity Thresholds per Role

Inactivity is measured from the **last recorded activity** for that role. The
thresholds below are the point at which the notification process in Section 3
begins — they are not an automatic removal.

| Role | Inactivity threshold | Grace period after notice |
| --- | --- | --- |
| Contributor | 12 months | n/a (no access to revoke) |
| Triager | 6 months | 30 days |
| Reviewer | 6 months | 30 days |
| Maintainer | 3 months | 30 days |
| Working-group / committee member | 3 months | 30 days |

Notes:

- Thresholds are measured in consecutive calendar months.
- Approved leave (see Section 5) pauses the clock for the approved duration.
- A role holder may voluntarily declare themselves inactive at any time; doing
  so is not a breach of this policy.

## 3. Notification Process

When a role holder reaches the threshold in Section 2, the following steps are
taken in order:

1. **Friendly check-in (day 0).** A maintainer opens a private conversation
   (email or direct message) with the role holder to confirm whether they wish
   to remain active. No public record is created at this stage.
2. **Written notice (day 7).** If there is no response, or the role holder
   confirms they are stepping back, a written notice is sent to the role holder
   and recorded in the governance log. The notice states the role affected, the
   date of last activity, and the grace period.
3. **Grace period (30 days).** The role holder has 30 days from the written
   notice to respond, resume activity, or request leave under Section 5.
4. **Decision (day 37).** If the grace period expires without a response, the
   maintainers confirm the change of status and apply the consequences in
   Section 4.

Notifications must be respectful and assume good faith. Inactivity is not
misconduct, and this process must never be used as a disciplinary tool.

## 4. Consequences

Depending on the role, an inactivity decision results in:

- **Contributor** — no change to standing. Contributions remain credited.
- **Triager / Reviewer** — removal from the relevant team(s) and revocation of
  triage or review permissions.
- **Maintainer** — move to *Maintainer Emeritus* status: write access is
  revoked, but the title and recognition are retained.
- **Working-group / committee member** — seat is vacated and, where the group
  has a defined process, a replacement is selected.

In all cases:

- The change is recorded in the governance log with the date and reason.
- The person is thanked publicly (unless they prefer otherwise) for their
  service.
- No historical contribution, credit, or attribution is removed.

## 5. Leave of Absence

Any role holder may request a leave of absence before reaching a threshold:

- Requests are made to the maintainers and may be open-ended or time-boxed.
- Approved leave pauses the inactivity clock for its duration.
- Leave longer than 6 months is treated as a voluntary step-back, with the
  reinstatement path in Section 6 available on return.

## 6. Reinstatement Path

Returning after inactivity is intentionally low-friction:

1. **Signal intent.** Open an issue or contact a maintainer stating the role you
   wish to resume.
2. **Lightweight re-orientation.** Review the current `Governance/` documents
   and any changes made since the last activity. For technical roles, confirm
   familiarity with the current `CONTRIBUTING.md` and review policy.
3. **Reinstatement decision.** A maintainer confirms reinstatement. For
   Maintainer and committee roles, a simple majority of current maintainers is
   required.
4. **Access restored.** Permissions are restored to the previous level. Where
   the role's responsibilities have changed, a short onboarding refresher is
   provided.

Reinstatement is expected to be granted unless there is a documented,
role-specific reason (for example, an unresolved conduct matter). Reinstatement
requests are not subject to the inactivity thresholds again until the role
holder has been active for at least 30 days.

## 7. Review

This policy is reviewed at least once a year, or whenever the contributor ladder
or role definitions change. Changes are proposed through the normal governance
process described in `Governance/README.md` and must touch only the
`Governance/` folder.
