# Code of Conduct Appeals Process

| Field | Value |
| --- | --- |
| Document | `Governance/COC_APPEALS.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-09-28 |
| Review cadence | Every 6 months, or after any conduct appeal |
| Applies to | Everyone covered by the project's Code of Conduct |

This document defines how a person may **appeal** an enforcement decision taken
under the project's Code of Conduct. It exists because the Code of Conduct is
only credible if it is also *contestable*: a decision that cannot be reviewed is
indistinguishable from a decision that was never checked.

It is governance only. It changes no application behaviour, adds no runtime
dependency, and is scoped entirely to the `Governance/` folder.

## 1. Scope

The Code of Conduct — as stated in [`CONTRIBUTING.md` §1](../CONTRIBUTING.md) and
as applied through the project's enforcement practice — covers harassment,
discrimination, personal attacks, dismissive comments, and retaliation. This
process applies to any decision that *enforces* those standards, including:

- a warning, formal or informal;
- a requirement to edit or delete content;
- removal or muting from a repository, discussion, or community channel;
- a temporary suspension;
- a permanent ban;
- revocation of a governance privilege where the ground was a conduct violation
  (see [`policies/REVOCATION.md`](policies/REVOCATION.md) §1.2).

It does **not** cover ordinary technical disagreement or review feedback. A
rejected pull request, a closed issue, a `-1` on a proposal, or a reviewer asking
for changes is not an enforcement decision and is not appealable here. Use
[`processes/CONFLICT_RESOLUTION.md`](processes/CONFLICT_RESOLUTION.md) for
working disagreements and
[`processes/OBJECTION_HANDLING.md`](processes/OBJECTION_HANDLING.md) for
objections to a proposed governance decision.

## 2. Aims and principles

| Principle | What it means in practice |
| --- | --- |
| **Decisions are reasoned** | A sanction is accompanied by the conduct it responds to and the rule it applies. |
| **Appeals are heard by someone new** | No person who made, recommended, or investigated the original decision participates in deciding the appeal. |
| **No retaliation** | Raising an appeal, or participating in one in good faith, is never itself a conduct violation. |
| **Proportionality is reviewable** | An appeal may succeed on scope or duration even when the finding of fact stands. |
| **Confidentiality is the default** | Appeal materials are shared only with the people listed in §4 and §6. |
| **Timely** | Every stage carries a stated deadline (§5); a missed deadline by the project does not disadvantage the appellant. |

## 3. Who may appeal

**Any person subject to an enforcement decision may appeal that decision.** This
includes contributors, maintainers, reviewers, triagers, and community members
who are not contributors. Standing does **not** depend on role, tenure, or
whether the person is still active in the project.

Specifically:

- **The subject of the sanction** has standing, always.
- **A reporter** who believes a decision failed to address the conduct they
  reported may request review under §7 (Review of a no-action decision). The
  reporter is not a party to the subject's appeal and learns only the outcome
  category, not the reasoning or evidence in it.
- **A third party** has no standing to appeal a decision that concerns someone
  else. They may raise a *new* concern about their own experience through the
  normal reporting channel.

An appeal may be filed by the subject directly, or through a single named
advocate if the subject prefers not to correspond with the project directly.

## 4. The independent review requirement

This is the load-bearing rule of this document. Every appeal must be decided by
a panel that satisfies **all** of the following:

1. **No prior involvement.** No panel member may have made the original
   decision, recommended it, or investigated the underlying report.
2. **No reporting relationship to the appellant or the original decision-maker.**
   A panel member may not be the appellant's or the decision-maker's manager,
   mentee, or close collaborator on the project.
3. **No direct interest in the outcome.** A panel member who is a party to the
   underlying dispute, or who has publicly taken a firm position on it, is
   conflicted out.
4. **Three members where available.** The panel is three people: at least one
   maintainer who was not involved, and at least one community member who holds
   no governance privilege. Where the project cannot field three unconflicted
   people, the panel is two, and the shortfall is recorded in the decision.
5. **A declared recusal path.** Any panel member may recuse, and the appellant
   may request a recusal with a stated reason. A recusal request is granted
   unless the panel unanimously finds the reason does not go to independence;
   the finding is recorded.
6. **No panel member decides alone.** Every outcome requires agreement from
   every sitting panel member. A panel that cannot reach agreement escalates to
   the steering group under §5, step 6.

If no unconflicted panel can be assembled from within the project — for example,
a dispute between the only two maintainers — the appeal is reviewed by the
project lead and one external reviewer drawn from the wider Stellar/TeachLink
community, and that fact is recorded in the decision.

## 5. Appeal steps

| Step | Action | Owner | Deadline |
| --- | --- | --- | --- |
| 1 | **File the appeal.** Submit it in writing to the project lead by private email (the address in [`CONTRIBUTING.md` §13](../CONTRIBUTING.md)) or by direct message to `@rinafcode`. State: the decision being appealed, the date it was communicated, the grounds (§5.1), and the outcome sought. | Appellant | **14 days** from notification |
| 2 | **Acknowledge.** The project lead confirms receipt, states the deadline for the decision, and names the panel (§4) or explains why a panel could not be formed. | Project lead | **5 business days** of receipt |
| 3 | **Assemble the panel and disclose the record.** The panel receives the original decision, the evidence it rested on, and the appellant's filing. The appellant receives everything the panel receives, minus material that would identify or endanger a reporter. | Project lead | **10 business days** of acknowledgement |
| 4 | **Panel review.** The panel reads the record and may ask either side written questions. Each side may answer once. No hearings, no cross-examination of the reporter. | Panel | **21 days** of acknowledgement |
| 5 | **Written decision.** The panel issues a written decision to the appellant that states the outcome (§5.2), the reasons, and any dissent. | Panel | **21 days** of acknowledgement |
| 6 | **Final escalation.** If the panel cannot agree, or if the appellant believes the process in §4 was not followed, the steering group decides. Its decision is final. | Steering group | **21 days** of escalation |

Deadlines are counted in calendar days unless stated as business days. A
deadline may be extended once by up to 14 days, with written notice to the
appellant and a stated reason. Where a legal, security, or safeguarding
constraint prevents disclosure, the notice says that a constraint applies.

### 5.1 Grounds for appeal

An appeal must rely on at least one of:

- **Not established** — the conduct did not occur, or the evidence does not
  support the finding.
- **Wrong provision** — the conduct does not fall within the rule applied.
- **Disproportionate** — the sanction is heavier than comparable decisions for
  comparable conduct, or heavier than the policy provides.
- **Procedural unfairness** — the appellant was not told the substance of the
  allegation, was not given a chance to respond, or the decision-maker was not
  independent.
- **New evidence** — material facts that were not available at the time of the
  original decision.
- **Retaliation** — the sanction was imposed, in whole or part, because the
  appellant raised a concern, appealed, or participated in a prior process.

Disagreement with the outcome alone, without one of the above, is not a ground.

### 5.2 Outcomes

The panel issues exactly one of:

| Outcome | Effect |
| --- | --- |
| **Upheld** | The decision stands as issued. |
| **Modified** | The finding stands, but the scope or duration is reduced — a permanent ban may become a time-boxed suspension, a channel removal may become a warning. |
| **Overturned** | The decision is void. Any removed access, content, or privilege is restored as soon as practicable, and the record is annotated to say so. |
| **Remitted** | The decision is set aside and returned for a fresh decision by a different, unconflicted decision-maker because the process in §5.1 was not followed. |

### 5.3 Effect on the original decision

Filing an appeal does **not** suspend the sanction. A permanent ban, a security
removal, or a channel mute stays in force while the appeal is pending. If the
appeal is overturned or modified, the project acts promptly to undo the parts
that no longer apply, and states in the decision what has been undone.

## 6. Confidentiality and records

- The appellant, the panel, the project lead, and — where relevant — the
  reporter are the only people who see the appeal record.
- The decision is logged in [`DECISION_LOG.md`](DECISION_LOG.md) as an entry
  naming the outcome category and the date, with personal details minimised and
  the appellant not identified unless they ask to be.
- Evidence is retained only as long as needed to decide the appeal and any
  escalation, then deleted — except where a legal or security obligation
  requires retention, which is recorded.
- Retaliation against an appellant or a panel member is itself a Code of
  Conduct violation.

## 7. Review of a no-action decision

A person who reported conduct and was told that no action would be taken may ask
for that decision to be reviewed once. The review is conducted by the same
independent panel described in §4 and answers one question only: *was the
decision not to act reasonable on the evidence available?* The reporter receives
the outcome category and a short explanation, not the underlying evidence or the
other party's account. A no-action review may not be used to reopen a matter that
has already been decided on the merits against the reporter.

## 8. Relationship to other documents

| Document | Relationship |
| --- | --- |
| [`CONTRIBUTING.md` §1](../CONTRIBUTING.md) | States the conduct standard this process enforces. |
| [`policies/REVOCATION.md`](policies/REVOCATION.md) | §4 appeal path applies where the revocation ground was conduct; this document supplies the independent-review detail for that path. Where the two differ, the stricter independence requirement applies. |
| [`processes/CONFLICT_RESOLUTION.md`](processes/CONFLICT_RESOLUTION.md) | The route for working disagreements, which are not enforcement decisions. |
| [`processes/OBJECTION_HANDLING.md`](processes/OBJECTION_HANDLING.md) | The route for objections to a proposed governance decision. |
| [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md) | Conduct grounds for removal, and the mutually respectful tone expected of an appeal. |
| [`DECISION_LOG.md`](DECISION_LOG.md) | Where appeal outcomes are recorded. |

## 9. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-09-28 | 1.0.0 | **Initial release.** Defines who may appeal (§3), the independent review requirement (§4), the appeal steps and deadlines (§5), confidentiality and records (§6), and review of a no-action decision (§7). |
