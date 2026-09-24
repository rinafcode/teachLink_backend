# Contributor

This document defines **who a contributor is** for TeachLink Backend, the rights
and expectations that come with the role, and how a person becomes a
contributor.

The contributor role is the foundation of the project's membership ladder. The
other roles defined in this folder — reviewer, issue triager, committer,
maintainer, and lead maintainer — are reached from this baseline through the
documented promotion criteria process.

## Who Is a Contributor

A **contributor** is any person who participates in the project in good faith
and whose contributions are accepted into the repository. Participation includes:

- Opening well-formed issues that describe a problem or proposal;
- Commenting on and reviewing open issues and pull requests;
- Improving documentation in the `Governance/` folder and elsewhere;
- Submitting code changes that are merged into the repository.

A person becomes a contributor by having their first pull request merged into
the repository. Contributions follow the expectations below.

## Rights

Every contributor (and every person participating in the project):

- **Can propose changes** — open pull requests per `CONTRIBUTING.md` (branch
  strategy §3, commit convention §7, pull request requirements §8).
- **Can participate in review** — comment on any issue or pull request. Pull
  request review threads are resolved by the reviewer once satisfied
  (`CONTRIBUTING.md` §9).
- **Can participate in discussions** — raise concerns about any part of the
  project, including its governance, through the issue tracker.
- **Can apply for more responsibility** — progression to reviewer, issue
  triager, committer, maintainer, and lead maintainer follows the project's
  promotion criteria (see the roles in this folder and the promotion process).

## Expectations

Contributors are expected to:

- Follow the contribution and review policies in `CONTRIBUTING.md`, including
  the Conventional Commits format and the required quality gates (lint, format,
  typecheck, tests) named in §4;
- Keep changes **small and focused** — at most two files for a governance
  change, and never outside the `Governance/` folder for governance work
  (`Governance/README.md`);
- Respond to review comments, even if only to acknowledge them, and not
  force-push during review (`CONTRIBUTING.md` §9);
- Cite real evidence (reproducible steps, relevant code, prior art) when
  reporting issues;
- Act in line with the project's values and code of conduct.

## How to Become a Contributor

1. Read `CONTRIBUTING.md` and the setup guide in `docs/setup.md`.
2. Find an issue to work on (the `help wanted` / `good first issue` labels are
   good starting points) or propose a new one.
3. Open a pull request following §3, §7, and §8 of `CONTRIBUTING.md`.
4. Respond to reviewer comments until the pull request is approved and merged
   by a maintainer.

Once a contribution is merged, the author is a contributor of TeachLink
Backend.

## Ownership and Review

This document is owned by the maintainers. Changes to the contributor role are
made through a pull request limited to the `Governance/` folder and reviewed
per `CONTRIBUTING.md` §9 and §11.