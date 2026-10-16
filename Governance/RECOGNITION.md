# Contributor Recognition Program

This document defines the **contributor recognition program** for TeachLink
Backend: the recognition tiers, the criteria for each, and the process for
nominating and conferring recognition. It gives contributors a clear, versioned
reference for how sustained and valuable work is acknowledged, and complements
the role documents in `Governance/roles/` and the promotion criteria in
`Governance/processes/PROMOTION_CRITERIA.md`.

This program is part of the project's **Roles & membership** and
**Community & conduct** areas. It lives entirely inside the `Governance/`
folder and is documentation only: it does not affect application code or runtime
behaviour.

## Purpose

Recognition exists to:

- Acknowledge contributions that go beyond the ordinary, whether code,
  documentation, review, triage, or governance.
- Make appreciation **predictable and fair** by tying it to objective,
  evidence-based criteria.
- Encourage participation without gatekeeping: recognition is optional, never
  required, and never a substitute for the role-based promotion ladder.
- Keep an auditable record of who was recognized, for what, and when.

Recognition is **complementary to** — and distinct from — role promotion. A
person may hold a role without a recognition tier, and may be recognized
without holding a role. Recognition does not grant repository permissions;
those follow the promotion process in
`Governance/processes/PROMOTION_CRITERIA.md`.

## Recognition Tiers

Recognitions are awarded in the following tiers, from lowest to highest. Each
tier is cumulative in spirit: the criteria below describe the contribution the
tier is meant to honour, and the tiers are independent of the membership ladder.

| Tier | Name | What It Recognizes |
| --- | --- | --- |
| 1 | **Contributor Shout-out** | A single notable contribution of clear value. |
| 2 | **Outstanding Contribution** | A sustained, high-impact contribution over a cycle. |
| 3 | **Community Champion** | Broader impact beyond code: growing the community and contributors. |
| 4 | **Distinguished Contributor** | Long-term, exceptional service across areas. |

### Tier 1 — Contributor Shout-out

Awarded for a single contribution that is **notable, self-contained, and of
clear value** to the project. Examples include a well-scoped bug fix, a new
test that closes a real gap, a documentation improvement, a strong review on a
tricky pull request, or a well-argued governance proposal.

Criteria:

- The contribution is **merged or otherwise accepted** (for governance, adopted).
- The contribution is **self-contained** and follows project standards
  (`CONTRIBUTING.md` §4, §7, and §8).
- The value is **specific and demonstrable** — it can be linked and explained,
  not merely asserted.

### Tier 2 — Outstanding Contribution

Awarded for a **sustained, high-impact** body of work over a contribution cycle
(roughly a quarter). It recognizes repeated quality rather than a single change.

Criteria:

- A series of **merged contributions** within the cycle that individually meet
  the Tier 1 bar.
- **Measurable impact** on the project — for example, shipping a feature,
  improving reliability or performance, closing a class of bugs, or removing
  meaningful toil.
- A record of following the **quality gates and review policy**
  (`CONTRIBUTING.md` §4 and §9), including sensible scoping and no
  force-pushing during review.

### Tier 3 — Community Champion

Awarded for **growing the project and its community** beyond individual work.

Criteria:

- Demonstrated help to **other contributors** — onboarding, mentoring, or
  consistently thoughtful review and triage activity.
- Contributions to **project health** — documentation, guides, governance, or
  community support that make it easier for others to participate.
- Evidence that others have **benefited**, such as contributors citing the
  person's help, or issues and pull requests the person unblocked.

### Tier 4 — Distinguished Contributor

Awarded for **long-term, exceptional service** recognized across a substantial
period and, usually, across multiple areas.

Criteria:

- A **sustained track record** well beyond a single cycle, with contributions
  at or above the Tier 2 bar over time.
- Demonstrated **impact across areas** — for example code plus review, or
  documentation plus community, or governance plus mentorship.
- The **trust of the maintainers**, evidenced by an approval decision recorded
  on the nomination (see below).

## Nomination Process

Recognition is **evidence-based and awarded by the maintainers**; it is never
self-awarded. Nominations follow the same transparent, versioned path as role
nominations (`Governance/processes/NOMINATION.md`) so the record stays
auditable.

1. **Raise the nomination.** Open a GitHub issue titled
   `Recognition: <nominee> for <tier>`. State the tier, the nominee, and the
   reason, with links to the evidence.
2. **Provide evidence.** Attach, as evidence on the issue:
   - **Merged contributions** — links to the pull requests or commits being
     recognized, with the relevant part called out.
   - **Review / triage / community activity** — links to specific comments,
     reviews, issues, or discussions.
   - **Impact statement** — a short, specific statement of the value delivered
     and how it was observed.
   - **Policy adherence** — examples of the nominee following the commit
     convention, quality gates, and the no-force-push / no-self-merge rules.
3. **Second the nomination.** A nomination must be seconded by at least one
   maintainer before it moves to a decision. A nominee cannot second their own
   nomination. A second from a maintainer who worked closely with the nominee
   carries the strongest weight.
4. **Review by maintainers.** A **Tier 1 (Contributor Shout-out)** nomination
   may be confirmed by any maintainer and recorded in the governance log. For
   **Tiers 2–4**, maintainers discuss the nomination during a **seven-day
   window**; concerns must be specific and actionable so the nominee or
   nominator can respond.
5. **Decision.** A Tier 2 or Tier 3 recognition is confirmed with **majority
   support** from maintainers and no unresolved blocking objection. A **Tier 4
   (Distinguished Contributor)** recognition requires a **two-thirds
   supermajority** of maintainers (see
   `Governance/policies/SUPERMAJORITY.md`). The lead maintainer carries the
   deciding voice if no consensus forms (`Governance/roles/MAINTAINER.md`).
6. **Record and confer.** A maintainer records the outcome on the issue,
   thanks the nominee, and adds the recognition to the governance record. A
   nomination that does not pass is closed with a short, respectful summary and
   may be raised again after further contributions.

Nominations are reviewed continuously. Incomplete nominations stay open for up
to seven days for missing detail to be supplied, after which they may be closed
and reopened later.

## Rules

- **Evidence only.** Recognition is based on visible, auditable repository
  activity. Off-platform work that cannot be linked is not considered.
- **No self-nomination for a decision.** A person may prepare evidence, but the
  nomination and seconding must come from others.
- **No revocation of credit.** Recognition is permanent. If a recognized person
  later becomes inactive, the recognition remains; inactivity is handled under
  `Governance/policies/INACTIVITY.md` and never removes historical credit.
- **Never disciplinary.** This program is only additive. It must never be used
  to withhold, downgrade, or condition standing, and it does not replace the
  code of conduct or enforcement processes.
- **Small and documented.** Changes to this document follow a pull request
  limited to the `Governance/` folder, reviewed per `CONTRIBUTING.md` §9 and
  §11.

## Ownership and Review

This document is owned by the maintainers. It should be reviewed at least once
a year, together with the role documents it references and the promotion
criteria. Changes to this program follow the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.
