# Maintainer Nomination Template

This is the template every maintainer nomination in the TeachLink Backend
project starts from. A nomination proposes that a contributor take on
maintainer responsibilities and records the evidence and the community's
response.

This document is part of the project's **Governance** area. It lives
entirely inside the `Governance/` folder and does not change application
code. Nominations follow the lifecycle in `Governance/processes/NOMINATION.md`.

## How To Use This Template

Copy the section below into a new nomination issue, fill in every section,
and announce it in the project's discussion channel. Do not nominate
yourself without stating that fact plainly in the rationale.

---

## Template

```markdown
# Maintainer Nomination: <GitHub handle>

- **Date opened:** <YYYY-MM-DD>
- **Nominated by:** <GitHub handle>
- **Self-nomination:** Yes | No

## Nominee

The GitHub handle and current role of the person being nominated.

## Rationale

Why this person should be a maintainer: what responsibilities they would
take on, and why the project needs them held by this person now.

## Contribution Evidence

Specific, checkable evidence: merged pull requests (with links), issues
triaged, reviews submitted, incidents or releases handled. Link at least
three concrete artifacts; claims without links do not count.

## Seconding

- **Seconded by:** <GitHub handle(s)>

A nomination requires at least one second from an existing maintainer
before it proceeds to a vote. Each second is one line with a link to the
seconder's own comment.

## Vote

- **Vote opens:** <YYYY-MM-DD>
- **Vote closes:** <YYYY-MM-DD>
- **Result:** Approved | Rejected | Withdrawn
- **Tally:** <for> for, <against> against, <abstain> abstain

The vote follows the rules in `Governance/processes/FORMAL_VOTING.md`. The
result is recorded here and in the outcome comment; if the outcome is
Approved, the nominee is added to `Governance/registers/MAINTAINERS_REGISTER.md`
and onboarding under `Governance/processes/ONBOARDING.md` begins.
```

## Section Guidance

- **Contribution Evidence** — links are mandatory; the section's purpose is
  to let an absent maintainer decide from the evidence alone.
- **Seconding** — exactly what it says on the tin, no discussion content.
- **Vote** — leave the result fields empty while the vote is open; edit the
  same comment when it closes rather than posting a second nomination.
