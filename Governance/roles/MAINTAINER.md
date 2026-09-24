# Maintainer

This document defines the **maintainer** role for TeachLink Backend: the
maintainer's responsibilities, decision authority, and accountability
expectations.

Maintainers are the group that manages this repository day to day. They sit
above the reviewer, issue triager, and committer roles in the membership ladder
and report to the lead maintainer (see `Governance/roles/LEAD_MAINTAINER.md`).

## Responsibilities

Maintainers are responsible for the health and steady evolution of the
repository:

- **Review and merge** — review pull requests within the service-level
  agreement (`CONTRIBUTING.md` §9) and merge approved changes using squash
  and merge only (`CONTRIBUTING.md` §11).
- **Enforce quality gates** — only merge when the **CI Passed** check is green
  (ESLint, Prettier, TypeScript, NestJS build, unit and e2e tests) and branch
  protection is honoured (`CONTRIBUTING.md` §4).
- **Own modules** — take review responsibility for the areas they own, as
  mapped by the repository's `CODEOWNERS` definition (`CONTRIBUTING.md` §9).
- **Keep `main` production-ready** — `main` is production-ready code only;
  regular feature work targets `develop` and hotfixes target `main` directly
  and are back-merged (`CONTRIBUTING.md` §3 and §11).
- **Maintain governance** — the `Governance/` folder is the single, versioned
  home for project policies; maintainers adopt governance changes through pull
  requests limited to that folder (`Governance/README.md`).

## Decision Authority

- Maintainers can **approve and merge** pull requests subject to the review
  policy. For `main`, two approvals are required, including one code owner
  (`CONTRIBUTING.md` §9).
- Maintainers **cannot bypass** branch protection rules with respect to
  already-required checks (`CONTRIBUTING.md` §4).
- In ordinary operation, maintainer decisions are made by consensus. When
  consensus cannot be reached, the lead maintainer holds the deciding voice.
- Scope and governance decisions follow the process in
  `Governance/SCOPE.md` and the charter.

## Accountability

- Reviewers are expected to respond within the SLA and authors are expected to
  respond to every review comment (`CONTRIBUTING.md` §9).
- Maintainers must not force-push during review and must not resolve reviewer
  threads themselves (`CONTRIBUTING.md` §9).
- Decisions and the reasoning behind them are recorded in the repository (issue
  comments, decision records, and PR descriptions) so the process stays
  transparent and auditable.
- Maintainers who cannot keep up with their responsibilities step aside through
  the offboarding process, so the role stays active.
- Maintainers are expected to model the expectations set on contributors and
  reviewers: follow the commit convention, keep changes small and documented,
  and treat code-owner review responsibility with care.

## Ownership and Review

This document is owned by the maintainers. Changes to the maintainer role are
made through a pull request limited to the `Governance/` folder and reviewed
per `CONTRIBUTING.md` §9 and §11.