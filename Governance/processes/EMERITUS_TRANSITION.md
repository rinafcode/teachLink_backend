# Emeritus Transition Process

This document defines when a TeachLink Backend maintainer moves to
**Maintainer Emeritus** status, what privileges are retained, and how to
return to active status. It covers both the inactivity-triggered path already
named in `Governance/policies/INACTIVITY.md` §4 and a maintainer's own
voluntary step-back, giving both a single, consistent process.

This process is part of the project's **Roles & membership** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When A Member Moves To Emeritus

A maintainer moves to Emeritus status when either:

- **Inactivity.** The inactivity process in `Governance/policies/INACTIVITY.md`
  reaches its Section 4 consequence for the Maintainer role: the grace period
  after written notice expires without the maintainer resuming activity or
  requesting leave.
- **Voluntary step-back.** A maintainer who wishes to stop actively
  maintaining the project, but remain recognised for their contributions,
  may request Emeritus status at any time by informing the other maintainers
  — no inactivity threshold needs to be reached first.

Emeritus is a graceful off-ramp, not a demotion or a disciplinary outcome. It
is logged in `Governance/DECISION_LOG.md` with a short, respectful note, the
same as any other role change.

## Privileges Retained

An Emeritus maintainer:

- Keeps the **Maintainer Emeritus** title and public recognition as a former
  maintainer, including in any contributors or acknowledgements listing the
  project maintains.
- Retains authorship and attribution on all past contributions; nothing
  historical is altered or removed.
- May continue to participate in discussions, open issues, and submit pull
  requests as any contributor would.
- Is welcome at any public governance discussion, though — as with any
  non-maintainer — without a maintainer vote.

An Emeritus maintainer does **not** retain:

- Write access to the repository (branch push, merge rights).
- Eligibility to vote in a formal vote (`Governance/processes/FORMAL_VOTING.md`)
  or count toward quorum (`Governance/policies/QUORUM.md`) while Emeritus.
- Standing as a code owner for any module they previously owned — that
  ownership is reassigned per `Governance/domains/SERVICE_OWNERSHIP.md`
  before or at the point of transition.

## How To Return To Active Status

Returning from Emeritus is intentionally low-friction, mirroring the
reinstatement path in `Governance/policies/INACTIVITY.md` §6:

1. **Signal intent.** The Emeritus maintainer opens an issue or contacts a
   current maintainer stating they wish to resume the Maintainer role.
2. **Re-orientation.** They review the current `Governance/` documents and
   any changes made since their transition, and confirm familiarity with the
   current `CONTRIBUTING.md` and review policy.
3. **Reinstatement decision.** A simple majority of current maintainers
   confirms reinstatement, following the same voting mechanics as
   `Governance/processes/FORMAL_VOTING.md` (or lazy consensus, if no
   maintainer objects within its minimum waiting period — either is
   acceptable for a returning maintainer in good standing).
4. **Access restored.** Write access and any module ownership the returning
   maintainer resumes are restored, with a short refresher on anything that
   changed while they were Emeritus.

Reinstatement is expected to be granted unless there is a documented,
specific reason not to (for example, an unresolved conduct matter). A
returning maintainer is not immediately eligible to trigger a formal vote's
quorum on their own reinstatement thread and is not subject to inactivity
thresholds again until active for at least 30 days, matching
`Governance/policies/INACTIVITY.md` §6.

## Review

This process is reviewed whenever the inactivity policy or the maintainer
ladder changes materially. Changes are proposed through the normal governance
process described in `Governance/README.md` and must touch only the
`Governance/` folder.
