# TeachLink Backend Charter

This charter records the **purpose**, **scope**, and **governance authority** of the
TeachLink Backend repository. TeachLink Backend is the NestJS backend API that powers
the TeachLink ecosystem — the core service that the Web client, Mobile client, and the
Stellar/Soroban rewards contract build on (see the repository README).

Everything in `Governance/` is documentation and policy. This charter is the
foundation the other governance documents build on; the folder is organised around
it as described in `Governance/README.md`.

## Purpose

TeachLink is a decentralized platform for sharing, analyzing, and monetizing knowledge.
The TeachLink Backend repository exists to:

- Provide the core **API surface** for the platform's features — content, learning,
  payments, messaging, notifications, and administration.
- Enforce the platform's rules in code wherever they can be enforced — authentication,
  authorization, moderation, and compliance.
- Serve as the **single, versioned reference** for how the rest of the ecosystem
  integrates with the backend's data and services.

## Scope

The high-level boundaries of the project are defined in `Governance/SCOPE.md`.

In brief:

- **In scope** — the backend API for the TeachLink ecosystem, including the
  cross-cutting platform concerns (authentication, payments, content, moderation,
  notifications, and platform operations) that live in this repository.
- **Out of scope** — the Web and Mobile clients and the Stellar/Soroban rewards
  contract, which are maintained in their own repositories.

Decisions to expand or restrict scope are made through the governance process and
recorded in `Governance/SCOPE.md`.

## Who Holds Decision Power

The following bodies hold decision power in this project:

- **Maintainers** manage the repository. They review, approve, and merge change
  proposals, enforce the quality gates, and keep `main` production-ready. Only
  maintainers with the **Maintainer** GitHub role can merge pull requests
  (`CONTRIBUTING.md` §11 *Merging*).
- **Lead Maintainer** casts the deciding vote when the maintainers cannot reach
  consensus and escalates decisions the maintainers cannot settle.
- **Working Groups** own specific domains (for example security, payments, or
  documentation) and make the day-to-day decisions within their domains.
- **Contributors and the community** propose changes and raise concerns through
  issues and pull requests. Governance changes are adopted only through a pull
  request that touches **only** this `Governance/` folder (`Governance/README.md`
  *Contributing to governance*).

## How the Charter Is Amended

This charter — and every document in `Governance/` — is amended through the
standard governance process:

1. A proposal is opened as a pull request limited to the `Governance/` folder.
2. The proposal is discussed and review comments are resolved by its author
   (`CONTRIBUTING.md` §9 *PR Review Policy*).
3. Maintainers review the proposal and merge it per the merging rules
   (`CONTRIBUTING.md` §11 *Merging*).
4. The accepted text takes effect at merge time; previous versions remain
   available in the repository history.

A change to this charter is treated like any other governance change: small,
focused, documented, and limited to the `Governance/` folder.

## Ownership and Review

This document is owned by the maintainers. It should be reviewed when the
platform's purpose or the repository's authority changes, and at least once a
year. Reviews are tracked as issues and, when they change this document, are
landed through the amendment process above.