# Code of Conduct Enforcement Ladder

| Field | Value |
| --- | --- |
| Document | `Governance/COC_ENFORCEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-09-29 |
| Review cadence | Every 6 months, or after any enforcement decision |
| Applies to | Everyone covered by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) §3 |

This document defines **what happens once a Code of Conduct report is upheld**:
the graduated steps available, the criteria that select between them, and who
may apply each.

It exists so that enforcement is predictable. A project that can impose any
sanction for any violation is one where the outcome depends on who is handling
the report and what sort of day they are having. A stated ladder makes a
decision reviewable — and [`COC_APPEALS.md`](COC_APPEALS.md) §5.1 lets a sanction
be appealed as *disproportionate*, which is only meaningful against a published
scale.

It is governance only. It changes no application behaviour, adds no runtime
dependency, and is scoped entirely to the `Governance/` folder.

## 1. Scope

This document applies where a report made under
[`COC_REPORTING.md`](COC_REPORTING.md) has been reviewed and a violation of
[`CODE_OF_CONDUCT.md` §4](CODE_OF_CONDUCT.md) established.

It does **not** apply to:

- provisional protective measures taken while a review is still open, which are
  governed by [`COC_REPORTING.md` §5](COC_REPORTING.md) and are not findings;
- revocation of a governance privilege on non-conduct grounds, which is governed
  by [`policies/REVOCATION.md`](policies/REVOCATION.md);
- ordinary review outcomes, which are not enforcement at all
  ([`CODE_OF_CONDUCT.md` §5](CODE_OF_CONDUCT.md)).

## 2. Principles

| Principle | What it means in practice |
| --- | --- |
| **Graduated by default** | Start at the lowest step that credibly addresses the conduct. Escalate for repetition or severity, not for annoyance. |
| **Proportionate** | The response matches the conduct, not the status of either party. |
| **Reasoned in writing** | Every sanction states the conduct, the provision applied, the step chosen, and its duration. |
| **Correction over punishment** | The aim is that the behaviour stops and the affected person can keep participating. A sanction that achieves that is sufficient. |
| **Consistent** | Comparable conduct receives comparable responses. Departures are explained in the decision. |
| **Always appealable** | Every step on this ladder carries the appeal right in [`COC_APPEALS.md`](COC_APPEALS.md). |
| **Never retaliatory** | A sanction imposed because someone reported, appealed, or participated in a process is itself a violation ([`CODE_OF_CONDUCT.md` §4.5](CODE_OF_CONDUCT.md)). |

Starting low is the default, not a requirement. Conduct that is severe on a
first occurrence is met at the step it warrants — §4.

## 3. The ladder

### Step 1 — Private correction

| | |
| --- | --- |
| **What** | A private, written note naming the conduct and the provision it engages, with a clear statement of what must change. Not recorded as a sanction. |
| **When** | A first, isolated lapse: a sharp review comment, a dismissive reply, a joke that landed badly. Conduct that most likely reflects carelessness rather than intent. |
| **Applied by** | Any maintainer. |
| **Duration** | None. It is a correction, not a restriction. |
| **Recorded** | Not logged in [`DECISION_LOG.md`](DECISION_LOG.md). Retained privately by the handler so repetition can be recognised. |

### Step 2 — Formal warning

| | |
| --- | --- |
| **What** | A written warning stating the conduct, the provision breached, and that a further violation will escalate. May require a specific action: editing or withdrawing a comment, or ceasing contact with a named person. |
| **When** | Repeated conduct after a step 1 correction, or a first violation too substantial for a private note — a personal attack, a discriminatory remark, sustained dismissiveness toward a contributor. |
| **Applied by** | Any maintainer, after consulting one other unconflicted maintainer. |
| **Duration** | The warning stands on the record for **12 months**. Conditions attached to it (such as no contact) continue until lifted in writing. |
| **Recorded** | Logged in [`DECISION_LOG.md`](DECISION_LOG.md) by outcome category and date, with the person not identified. |

### Step 3 — Temporary restriction

| | |
| --- | --- |
| **What** | Time-boxed removal of a specific ability: interaction with one thread or repository area, posting in a community channel, or reviewing. Other participation continues. |
| **When** | A violation continuing after a formal warning, or a single violation serious enough that leaving the interaction unchanged would expose someone to further harm. |
| **Applied by** | Two maintainers acting together, at least one unconflicted. |
| **Duration** | Stated at the outset, **7 to 90 days**. An open-ended restriction is not a step 3 measure. |
| **Recorded** | Logged in [`DECISION_LOG.md`](DECISION_LOG.md). |

### Step 4 — Suspension

| | |
| --- | --- |
| **What** | Time-boxed removal from **all** project spaces: repository, community channels, and calls. Any governance privilege is suspended for the same period. |
| **When** | A pattern established across previous steps; or serious conduct on a first occurrence — targeted harassment, doxxing, a threat, or retaliation against a reporter. |
| **Applied by** | The maintainer team, by the quorum in [`policies/QUORUM.md`](policies/QUORUM.md). The project lead may impose it alone where delay would leave someone at risk, and it is confirmed by quorum within **5 business days** or lapses. |
| **Duration** | Stated at the outset, **30 days to 12 months**. |
| **Recorded** | Logged in [`DECISION_LOG.md`](DECISION_LOG.md). Where a governance privilege is affected, [`policies/REVOCATION.md`](policies/REVOCATION.md) applies in parallel. |

### Step 5 — Permanent ban

| | |
| --- | --- |
| **What** | Permanent removal from every project space, with no route back except through appeal. |
| **When** | Reserved. Appropriate only where the conduct is grave — a credible threat of violence, sexual harassment, sustained targeted harassment, deliberate introduction of a vulnerability or backdoor — or where the pattern through steps 2 to 4 shows the behaviour will not change. |
| **Applied by** | The maintainer team by quorum, with the decision and its reasons recorded in full. Never by one person. |
| **Duration** | Indefinite. |
| **Recorded** | Logged in [`DECISION_LOG.md`](DECISION_LOG.md), and in the transparency reporting under [`policies/TRANSPARENCY_REPORTS.md`](policies/TRANSPARENCY_REPORTS.md) in aggregate form. |

## 4. Choosing a step

The starting point is step 1 and escalation is one step at a time — **unless**
one of the following applies, each of which permits entry higher on the ladder:

| Factor | Effect |
| --- | --- |
| **Severity** | Conduct under [`CODE_OF_CONDUCT.md` §4.1](CODE_OF_CONDUCT.md) involving threats, sexual harassment, or targeted harassment enters at step 4 or 5, first occurrence or not. |
| **Repetition** | A further violation while a step 2 warning stands (12 months) escalates by at least one step. |
| **Ongoing risk** | Where leaving the person in place would expose someone to further harm, enter at the lowest step that removes the risk. |
| **Abuse of position** | A violation using a maintainer or reviewer role ([`CODE_OF_CONDUCT.md` §4.3](CODE_OF_CONDUCT.md)) escalates by one step, because the power imbalance makes the conduct harder to resist and harder to report. |
| **Retaliation** | Retaliation against a reporter or appellant enters at **step 4 minimum**. It attacks the reporting process itself, which everything else here depends on. |
| **Impact on a newer contributor** | Aggravating. Conduct that drives away someone who has not yet established themselves does disproportionate damage. |

Mitigating factors, which may hold a response at a lower step:

- **Prompt, unprompted acknowledgement** and a genuine effort to repair.
- **A single lapse** against a long record of constructive participation.
- **Ambiguity** — where a reasonable person could have read the exchange
  differently, or where context was genuinely missing.

Mitigation does not apply to the conduct listed under **Severity** above.

## 5. Who applies what

| Step | Decided by | Second person required |
| --- | --- | --- |
| 1 — Private correction | Any maintainer | No |
| 2 — Formal warning | Any maintainer | Yes — one other unconflicted maintainer consulted |
| 3 — Temporary restriction | Two maintainers | Yes — at least one unconflicted |
| 4 — Suspension | Maintainer team by quorum | Yes — quorum per [`policies/QUORUM.md`](policies/QUORUM.md) |
| 5 — Permanent ban | Maintainer team by quorum | Yes — never a single decision-maker |

Applying at every step:

- **Nobody decides a matter they are party to.** A maintainer who is the subject
  of the report, who reported it, or who is directly involved takes no part in
  deciding it.
- **Nobody decides their own appeal.** Whoever takes the decision is excluded
  from the appeal panel ([`COC_APPEALS.md` §4](COC_APPEALS.md)).
- **Every decision is communicated in writing** to the person sanctioned,
  stating the conduct, the provision, the step, the duration, and the appeal
  route and its 14-day deadline.

## 6. Expiry and return

A time-boxed sanction ends on its stated date without anyone needing to act. It
is not extended silently; extending it requires a fresh decision at the
appropriate step, with its own appeal right.

**Return after a suspension.** A person returning at step 4 resumes ordinary
participation. Governance privileges suspended alongside are restored unless
they were separately revoked under
[`policies/REVOCATION.md`](policies/REVOCATION.md), in which case that document
governs their return.

**Record expiry.** A step 2 warning ceases to count toward escalation after 12
months. Steps 3 and 4 count for **24 months**. After those windows, the conduct
is not treated as a prior violation when selecting a step — though the log entry
itself is retained.

**A permanent ban** is lifted only by a successful appeal, or by a decision of
the maintainer team by quorum on fresh evidence.

## 7. Relationship to other documents

| Document | Relationship |
| --- | --- |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | The standard being enforced; §4 defines the violations this ladder responds to. |
| [`COC_REPORTING.md`](COC_REPORTING.md) | How a matter reaches this ladder, and the provisional measures that precede a finding. |
| [`COC_APPEALS.md`](COC_APPEALS.md) | The appeal right attaching to every step, and the independent panel that hears it. |
| [`policies/REVOCATION.md`](policies/REVOCATION.md) | Governance privileges: applies in parallel at steps 4 and 5, and governs return. |
| [`policies/QUORUM.md`](policies/QUORUM.md) | The quorum required at steps 4 and 5. |
| [`policies/TRANSPARENCY_REPORTS.md`](policies/TRANSPARENCY_REPORTS.md) | Aggregate reporting of enforcement activity. |
| [`DECISION_LOG.md`](DECISION_LOG.md) | Where outcomes from step 2 upward are recorded, in minimised form. |

## 8. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-09-29 | 1.0.0 | **Initial release.** Defines the enforcement principles (§2), the five-step ladder from private correction to permanent ban with criteria, authority and duration for each (§3), the aggravating and mitigating factors that select a step (§4), who may apply each step and the conflict rules (§5), and expiry, return and record windows (§6). |
