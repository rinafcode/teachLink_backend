# Rate Limit Governance

This document governs how rate limits are set for the TeachLink Backend API,
how exemptions are granted, and how often the limits are reviewed. It exists
so that contributors and maintainers have a single, versioned reference for
why limits are what they are, who can change them, and how exceptions are
handled.

This policy is part of the project's **Contribution governance** and
**Security & disclosure** areas. It lives entirely inside the
`Governance/` folder and does not change application code.

## Scope

This policy covers every rate limit applied to the API:

- **Default throttling** — the global limit applied by NestJS throttling
  (`THROTTLE_TTL` and `THROTTLE_LIMIT`, default 60-second window / 10
  requests), configured in `.env.example` under the *Rate Limiting* section.
- **Per-route and per-user-type limits** — limits defined in
  `config/routing.json` (for example, the *Rate Limit by User Type* rule that
  applies different limits per user type, such as a free-tier limit).
- **Adaptive limits** — limits adjusted under load by
  `AdaptiveRateLimitingService` (see `docs/api-security-best-practices.md`).
- **Limit exemptions** — any client, route, or role exempted from a limit.

## How Limits Are Set

- Limits are **configured, not hardcoded**. The default window and request
  budget live in environment variables (`THROTTLE_TTL`, `THROTTLE_LIMIT`) and
  in `config/routing.json` for route-specific rules, so they can be tuned per
  environment without a code change.
- A limit is set by answering, for the route or client class it applies to:
  - What is the legitimate peak request rate for a well-behaved client?
  - What is the cost (compute, database, third-party quota) of serving one
    request, and what is the abuse risk if the limit is too high?
  - What is the impact on legitimate users when the limit is hit — is a 429
    response acceptable, or does the route need a queue or degraded mode?
- Limits are **tiered by user type** where it makes sense (free vs. paid tiers,
  anonymous vs. authenticated), and the tier boundaries are documented in
  `config/routing.json` alongside the rule that enforces them.
- A limit that is changed must be changed in **one place** — the configuration
  it is defined in — never by special-casing inside a controller or
  middleware.

## Exemption Process

- Exemptions are **granted explicitly and narrowly**. An exemption is a
  documented exception for a specific client, route, or role, recorded in
  this policy's exemption list with a reason, an owner, and an expiry date.
- **Who may request an exemption:** a service owner (see
  `Governance/domains/SERVICE_OWNERSHIP.md`) or a maintainer, with a stated
  operational need (internal tooling, a partner integration, a load test).
- **Approval:** an exemption requires a maintainer with security
  responsibility to approve it; internal tooling that never reaches production
  traffic may be exempted by its service owner alone.
- **Expiry:** every exemption has an expiry. An expired exemption is removed
  automatically at the next review cycle; an exemption that is still needed
  must be renewed.
- **No blanket exemptions.** An exemption must not disable a limit for an
  entire class of traffic without a stated reason. If a client genuinely
  needs a *higher* limit, that is a limit change, not an exemption.
- Exemptions are **audited**: each exemption grant or renewal is recorded in
  the audit log.

## Review Cadence

- **Quarterly.** Maintainers review every rate limit and every active
  exemption: confirm each limit still matches the traffic it governs, remove
  stale exemptions, and check that limits have not drifted from their
  documented values.
- **After a traffic pattern change.** A sustained change in request volume,
  the addition of a high-volume client, or a new abuse pattern triggers an
  out-of-cycle review.
- **After an incident.** Any incident where rate limiting was a factor (a
  limit was too high and allowed abuse, or too low and blocked legitimate
  traffic) is reviewed as part of the incident postmortem
  (`Governance/domains/POSTMORTEM_POLICY.md`), and the limit is adjusted if
  warranted.
- **Annually.** This policy itself is reviewed, alongside the rate-limiting
  configuration, to confirm the overall posture is still appropriate.

## Regression Tests

Rate-limit behavior is covered by the project's test suite:

- Unit and integration tests for the throttling configuration and per-route
  rules confirm that configured limits are enforced as intended and that a
  429 response is returned at the limit boundary.
- Tests cover the exemption path: an exempted client is not limited, and an
  expired exemption is no longer honored.
- A change to a rate limit or to the exemption process must update or add
  coverage here, per the project's test conventions.

## Review

This policy is reviewed at least once a year, or whenever the rate-limiting
mechanism, configuration format, or exemption process changes materially.
Changes are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.