# Role Nomination Process

This document defines how contributors are nominated for project roles in the
TeachLink Backend project, how those nominations are supported, and how a
decision is reached. It gives the community a predictable, versioned path from
raising a nomination to confirming a new role holder.

This process is part of the project's **Roles & membership** and
**Decision-making** areas. It lives entirely inside the `Governance/` folder
and does not change application code.

## Roles In Scope

This process applies to nominations for the following roles:

- **Reviewer.** A trusted contributor who reviews and approves pull requests.
- **Maintainer.** A role holder who can merge pull requests and manage issues,
  labels, and releases.

Nominations may be for a contributor other than the nominator, or a
self-nomination. Both follow the same path.

## Raising A Nomination

A nomination is raised as a GitHub issue so the record stays versioned and
open to the community.

- Open an issue titled `Nomination: <candidate> for <role>`.
- State the role, the candidate, and the reason, with links to representative
  contributions such as merged pull requests, reviews, or triage work.
- Confirm the candidate is willing to take on the role. A self-nomination
  covers this by default.
- A maintainer applies the `governance` and `nomination` labels and confirms
  the candidate meets the baseline expectations for the role.

Incomplete nominations stay open for up to seven days for the missing detail to
be supplied, after which they may be closed and reopened later.

## Seconding Requirement

A nomination must be seconded before it moves to a decision. Seconding shows
the nomination has support beyond the person who raised it.

- At least one existing maintainer must second the nomination by commenting in
  support on the issue.
- The nominator cannot second their own nomination, and a self-nominated
  candidate cannot act as their own seconder.
- A second from a current holder of the role being nominated for carries the
  strongest weight and is preferred where one is available.
- If no maintainer seconds the nomination within fourteen days, it is closed as
  lapsed and may be raised again later once more supporting evidence exists.

## Decision Timeline

Once a nomination is seconded, it moves to a decision on a fixed timeline so
candidates are not left waiting.

- A discussion and objection window of seven days opens from the second.
- Maintainers signal support or raise concerns on the issue during the window.
  Concerns must be specific and actionable so the candidate can respond.
- A nomination is confirmed when it has majority support from maintainers and
  no unresolved blocking objection at the end of the window.
- A confirmed nomination is recorded by a maintainer, who grants the access for
  the role and closes the issue with the outcome.
- A nomination that does not reach majority support is closed with a short,
  respectful summary, and may be raised again after further contributions.
