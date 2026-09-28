# TeachLink Backend Scope

This document defines **what is in scope** for the TeachLink Backend repository,
its current boundaries, and how scope changes are proposed and recorded.

TeachLink Backend is the NestJS backend API for the TeachLink ecosystem — a
decentralized platform for sharing, analyzing, and monetizing knowledge. It is
the core service that the Web client, Mobile client, and the Stellar/Soroban
rewards contract build on (see the repository README).

## What Is In Scope

The repository is responsible for the platform's **API surface and its
cross-cutting concerns**. Functional areas currently in scope include:

- **Authentication and authorization** — session-based JWT authentication,
  multi-factor authentication, role-based access control, and account lifecycle
  (handled by the `auth`, `session`, and `rbac` modules).
- **Payments and payouts** — payment methods, invoices, subscriptions, payouts,
  provider integrations, reconciliation, and payment webhooks (the `payments`
  module).
- **Content and knowledge** — courses, cohorts, learning paths, assessment,
  gamification, and achievements (the `courses`, `learning-paths`,
  `assessment`, `gamification`, and `achievements` modules).
- **Interaction and collaboration** — collaboration, forum, and messaging
  (the `collaboration`, `forum`, and `messaging` modules).
- **Growth and community** — onboarding, recommendations, email marketing, and
  user preferences (the `onboarding`, `recommendations`, `email-marketing`, and
  `user-preferences` modules).
- **Trust and safety** — content moderation, compliance, audit logging, and
  security tooling (the `moderation`, `compliance`, `audit-log`, and `security`
  modules).
- **Platform operations** — notifications, queues and workers, caching, rate
  limiting, feature flags, internationalization, observability, monitoring,
  tracing, incident management, backup, data retention, and tenant/shard
  management (the `notifications`, `queues`, `workers`, `caching`,
  `rate-limiting`, `feature-flags`, `i18n`, `observability`, `monitoring`,
  `tracing`, `incident-management`, `backup`, `data-retention`, `tenancy`, and
  `sharding` modules).

This list describes the current state of the codebase (`src/`); it is not
exhaustive and evolves with the platform.

## Current Boundaries

- **API only** — this repository ships the backend service. It does not contain
  end-user interfaces; the Web and Mobile clients live in their own
  repositories.
- **Ecosystem integration points are fixed** — the backend integrates with the
  Stellar/Soroban rewards contract, but that contract itself is maintained in a
  separate repository.
- **Configuration is environment-driven** — service configuration is provided
  through environment files (`.env`, see the README quick-start); no
  environment is committed to this repository outside the example files.
- **Governance is self-contained** — all project governance lives in this
  `Governance/` folder and is documentation only.

## How Scope Changes Are Proposed

Scope changes follow the governance process described in `Governance/README.md`
(*Contributing to governance*):

1. A change to this document is proposed as an issue or a pull request that
   touches **only** the `Governance/` folder.
2. The proposal states the current boundary that is being expanded or
   restricted and the reasoning behind the change.
3. Maintainers review and merge the proposal per `CONTRIBUTING.md` §9 and §11.
4. The accepted scope takes effect on merge; the previous wording remains in
   the repository history.

## Ownership and Review

This document is owned by the maintainers. It should be reviewed when a
functional area is added to or removed from the repository, and at least once a
year. Reviews are tracked as issues and landed through the process above.