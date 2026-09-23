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
