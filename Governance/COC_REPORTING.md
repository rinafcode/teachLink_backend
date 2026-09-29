# Code of Conduct Reporting Process

| Field | Value |
| --- | --- |
| Document | `Governance/COC_REPORTING.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-09-29 |
| Review cadence | Every 6 months, or after any conduct report |
| Applies to | Everyone covered by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) §3 |

This document defines **how to report** a Code of Conduct concern: where the
report goes, how quickly you get a response, and what confidentiality you are
guaranteed.

A Code of Conduct with no usable reporting route is decoration. The purpose of
this document is to make reporting predictable enough that someone will actually
do it: you should be able to know, before you write anything, who will read it,
how long it will take, and what will happen to what you send.

It is governance only. It changes no application behaviour, adds no runtime
dependency, and is scoped entirely to the `Governance/` folder.

## 1. Scope

Use this process to report conduct covered by
[`CODE_OF_CONDUCT.md` §4](CODE_OF_CONDUCT.md) — harassment, privacy violations,
abuse of position, bad-faith participation, and retaliation — occurring in any
space listed in [`CODE_OF_CONDUCT.md` §3](CODE_OF_CONDUCT.md).

**Use a different route for:**

| Situation | Route |
| --- | --- |
| A security vulnerability | [`SECURITY_POLICY.md`](SECURITY_POLICY.md) and [`processes/VULN_DISCLOSURE.md`](processes/VULN_DISCLOSURE.md) |
| A technical disagreement | [`processes/CONFLICT_RESOLUTION.md`](processes/CONFLICT_RESOLUTION.md) |
| An objection to a proposed governance decision | [`processes/OBJECTION_HANDLING.md`](processes/OBJECTION_HANDLING.md) |
| Contesting an enforcement decision already taken | [`COC_APPEALS.md`](COC_APPEALS.md) |

If you are not sure which applies, report it here anyway. Routing it correctly
is the project's job, not yours.

## 2. Who may report

**Anyone.** You do not need to be a contributor, to have commit access, or to
have been the target of the conduct.

- **The person affected** may report.
- **A witness** may report conduct directed at someone else. Where the affected
  person is identifiable, the project will normally ask them before taking
  action naming them — except where waiting would leave someone at risk.
- **A third party** who was told about the conduct may report it, and should say
  that their account is second-hand.

You may report **anonymously** (§3.3), with the limits that necessarily carries.

A report made in good faith that turns out to be mistaken is **not** a
violation. Only a knowingly false report is
([`CODE_OF_CONDUCT.md` §4.4](CODE_OF_CONDUCT.md)).

## 3. How to report

### 3.1 Channels

Report through **one** of the following. All are private; none creates a public
record.

| Channel | Address | Use when |
| --- | --- | --- |
| **Email** | `conduct@teachlink.example` (replace with the project's published conduct contact if different) | The default. Best for anything detailed, and the only channel that leaves you a copy. |
| **Direct message** | `@rinafcode` on GitHub or [Telegram](https://t.me/teachlinkOD) | Quicker, or when email is inconvenient. |
| **Any maintainer** | See [`roles/MAINTAINER.md`](roles/MAINTAINER.md) | When your report concerns the project lead, or anyone you would otherwise have to report *to*. |

**Never open a public issue or pull request to report a conduct concern.** Doing
so exposes the people involved before anyone has looked at the facts, and makes
a proportionate response harder.

### 3.2 Reporting a maintainer, or the project lead

Report to any other maintainer directly. A report is never handled by its
subject: whoever receives it hands it to someone unconflicted, and the person
reported takes no part in assessing it, in deciding it, or in any appeal of it
([`COC_APPEALS.md` §4](COC_APPEALS.md)).

If every maintainer is conflicted, say so in your report. The matter is then
referred to the steering group, or to an external reviewer drawn from the wider
Stellar/TeachLink community, and that referral is recorded in the decision.

### 3.3 Anonymous reports

You may report without identifying yourself, by email from an account that does
not carry your name.

An anonymous report is taken seriously and is assessed on what it contains. Two
consequences follow unavoidably:

- **We cannot ask you follow-up questions,** so include as much detail as you
  can up front.
- **We cannot tell you the outcome,** because there is nobody to tell.

Where an anonymous report describes conduct that is independently verifiable —
something in a public thread, a commit, or a review — it can usually be acted on
regardless. Where it rests entirely on an account only you can give, it may not
be possible to reach a conclusion.

### 3.4 What to include

Nothing here is mandatory. A short report is better than no report.

- **What happened**, in your own words.
- **Where** it happened — a link to the issue, pull request, review comment, or
  chat message, if there is one.
- **When** it happened, approximately.
- **Who** was involved, and whether anyone else saw it.
- **Whether it is ongoing**, and whether you feel unsafe.
- **What you would like to happen**, if you have a view. You are not obliged to
  have one, and the project is not bound by it — but it is taken into account.

Screenshots and copied text help, particularly where content may be edited or
deleted later.

## 4. Response timeline

| Step | What happens | Owner | Deadline |
| --- | --- | --- | --- |
| 1 | **Acknowledgement.** You are told your report has been received and who is handling it. No assessment of the merits at this stage. | Recipient | **2 business days** |
| 2 | **Conflict check and assignment.** The report is assigned to a handler with no involvement in the matter (§3.2). If that changes who is handling it, you are told. | Maintainer team | **5 business days** |
| 3 | **Initial assessment.** The handler decides whether the report falls under [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and whether any immediate protective step is needed (§5). | Handler | **5 business days** |
| 4 | **Review.** The handler reviews the evidence and gives the person reported a fair chance to respond, including the substance of the allegation. | Handler | **21 calendar days** of acknowledgement |
| 5 | **Decision and notification.** A decision is taken under [`COC_ENFORCEMENT.md`](COC_ENFORCEMENT.md). The reporter is told the outcome category and that the matter is closed. | Handler | **21 calendar days** of acknowledgement |

Deadlines may be extended **once**, by up to 14 days, with written notice to the
reporter and a stated reason. A deadline missed by the project never counts
against the reporter, and never shortens the appeal window in
[`COC_APPEALS.md` §5](COC_APPEALS.md).

**What the reporter is told at step 5:** the outcome category — that action was
taken, or that no action was taken — and that the matter is closed. Reporters
are **not** told the specific sanction applied to another person, which is that
person's private information. If you believe a no-action decision was wrong, you
may request one review under
[`COC_APPEALS.md` §7](COC_APPEALS.md).

## 5. Immediate protective measures

Where conduct is ongoing and someone is at risk of further harm, the handler may
act before the review in §4 concludes. Available immediate steps are limited to:

- muting or temporarily removing someone from a channel;
- hiding or removing specific content;
- temporarily restricting repository interaction.

An immediate measure is **provisional, not a finding**. It is time-boxed, it is
communicated to the person affected with the reason, and it is confirmed,
varied, or lifted when the review concludes. It carries the same appeal right as
any other decision.

Permanent sanctions are never applied as an immediate measure.

## 6. Confidentiality

This is the guarantee the rest of the document depends on.

**What the project commits to:**

1. **Your report is shared only with the people who need it to act** — the
   handler, any unconflicted maintainer they must consult, and, on appeal, the
   panel under [`COC_APPEALS.md` §4](COC_APPEALS.md). It is not discussed with
   the wider maintainer team, in public channels, or with anyone else.
2. **Your identity is not disclosed to the person reported** without your
   consent, unless the substance of the allegation cannot be put to them without
   it. Where that is the case, **you are told before it happens**, and you may
   withdraw the report instead.
3. **The person reported is told the substance of the allegation**, because a
   decision taken against someone who was never told what they were accused of
   is not a decision anyone can defend.
4. **Records are minimised.** Enforcement outcomes are logged in
   [`DECISION_LOG.md`](DECISION_LOG.md) by outcome category and date, with the
   reporter not identified.
5. **Evidence is retained only as long as needed** to decide the matter and any
   appeal, then deleted — except where a legal or safeguarding obligation
   requires retention, which is recorded.
6. **Retaliation for reporting is itself a violation**, and a serious one
   ([`CODE_OF_CONDUCT.md` §4.5](CODE_OF_CONDUCT.md)). This holds whether or not
   your report was upheld.

**The limits, stated plainly:**

- Confidentiality cannot be absolute where there is a credible risk to someone's
  physical safety, or where a legal obligation requires disclosure. If that
  point is reached, you are told what must be disclosed and to whom, before it
  happens where that is possible.
- Anonymity limits what can be done with a report (§3.3).

## 7. Withdrawing a report

You may withdraw a report at any time before a decision is taken, and the
project will normally close the matter.

It will not close it where the conduct described is serious enough that the
project must act to protect others — ongoing harassment, a credible threat, or a
safeguarding concern. If that applies, you are told, and the matter proceeds
without requiring anything further from you.

## 8. Relationship to other documents

| Document | Relationship |
| --- | --- |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | The standard this process enforces; §3 sets where it applies and §4 what counts as a violation. |
| [`COC_ENFORCEMENT.md`](COC_ENFORCEMENT.md) | What happens after a report is upheld — the graduated ladder and who applies it. |
| [`COC_APPEALS.md`](COC_APPEALS.md) | Contesting a decision (§5), and review of a no-action decision (§7). |
| [`SECURITY_POLICY.md`](SECURITY_POLICY.md) | The equivalent route for security vulnerabilities, which do not come here. |
| [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md) | Official channels and response-time norms for ordinary communication. |
| [`DECISION_LOG.md`](DECISION_LOG.md) | Where outcomes are recorded, in minimised form. |

## 9. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-09-29 | 1.0.0 | **Initial release.** Defines scope and routing (§1), who may report (§2), channels including the route for reporting a maintainer and anonymous reports (§3), the response timeline with deadlines (§4), provisional protective measures (§5), the confidentiality guarantee and its limits (§6), and withdrawal (§7). |
