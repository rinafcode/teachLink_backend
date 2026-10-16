# Versioning Policy — TeachLink Backend

**Status:** Active
**Applies to:** `teachLink_backend` (NestJS, TypeScript, PostgreSQL, Redis)
**Owner:** TeachLink backend maintainers
**Last reviewed:** 2026-09-28

This document defines how versions are assigned, what forces each kind of bump, and how
pre-release builds are named. It is the normative reference for the repository version
recorded in `package.json` (`version`) and for the API contract surfaced through GraphQL
and the Swagger document at `/api`.

---

## 1. Table of Contents

1. [Version scheme](#1-version-scheme)
2. [What gets versioned](#2-what-gets-versioned)
3. [SemVer rules](#3-semver-rules)
4. [MAJOR — what constitutes a bump](#4-major--what-constitutes-a-bump)
5. [MINOR — what constitutes a bump](#5-minor--what-constitutes-a-bump)
6. [PATCH — what constitutes a bump](#6-patch--what-constitutes-a-bump)
7. [Pre-release conventions](#7-pre-release-conventions)
8. [Build metadata](#8-build-metadata)
9. [Deprecation policy](#9-deprecation-policy)
10. [Database migrations and versioning](#10-database-migrations-and-versioning)
11. [Release process](#11-release-process)
12. [Enforcement and compliance](#12-enforcement-and-compliance)

---

## 2. Version scheme

TeachLink Backend follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

- While the project is under active development and has not yet reached a stable public
  contract, releases are published as `0.x.y`. Under SemVer, `0.y.z` is explicitly the
  "initial development" range where **anything may change at any time**; the
  compatibility guarantees in sections 4–6 begin to bind once the project leaves `0.x.y`
  and reaches `1.0.0`.
- `1.0.0` is the declaration that the HTTP/GraphQL contract, the event schemas published
  on the queues, and the database shape are stable per the rules in this document.
- The version is recorded in `package.json` and is the single source of truth. Any other
  location that reports a version (deployment manifests, health endpoints, release
  notes) must mirror it rather than define it independently.

### Current version

`0.0.1` — initial development phase. Bumps remain frequent and PATCH-level changes may
still alter internal behaviour freely.

---

## 3. What gets versioned

| Surface                                    | Versioned by |
| ------------------------------------------ | ------------ |
| `package.json` `version`                   | This policy — the repository version |
| GraphQL schema (`src/graphql`)             | This policy — additive/mutating field changes are MAJOR while pre-`1.0.0`, MINOR after |
| REST endpoints under each module controller | This policy — breaking contract changes are MAJOR |
| Queue/event payloads (`src/queues`, `src/messaging`) | This policy — payload shape changes follow the same MAJOR/MINOR/PATCH logic |
| Environment configuration keys (`.env.example`) | MINOR when a key is added, MAJOR when a key is renamed or removed |
| Database schema (`src/migrations`)         | Follows the rules in section 10 |

Not versioned: internal refactors, test files, CI configuration, dependency patch bumps
that do not change observable behaviour, and documentation-only changes.

---

## 4. SemVer rules

```
MAJOR.MINOR.PATCH
```

A version is bumped **once per release**, choosing the highest level whose criteria are
met. A single PR that both adds a feature and breaks an existing contract takes a MAJOR
bump — the highest applicable level always wins.

- **MAJOR** — an incompatible change; consumers must take deliberate action.
- **MINOR** — a backwards-compatible addition; existing consumers keep working unchanged.
- **PATCH** — a backwards-compatible fix; behaviour only changes where it was wrong.

The version is never rewritten after publication. A published tag is immutable; a
correction is made by publishing a new version, not by moving an existing tag.

---

## 5. MAJOR — what constitutes a bump

Bump MAJOR when any of the following ships:

### API contract

- Removing or renaming a GraphQL type, field, query, mutation, or enum value.
- Changing a field's type in a non-backwards-compatible way (e.g. `String` → `Int`,
  a nullable field becoming non-null).
- Removing a REST endpoint, or changing its path, HTTP method, or authentication
  requirement.
- Removing a field from a request DTO or response payload, or narrowing a field's type.
- Tightening validation so that a previously accepted request is now rejected — for
  example adding a new required field, or changing a `@IsOptional()` field to required.
  (This is the most commonly missed MAJOR trigger: stricter input validation is a
  breaking change even though no code is deleted.)
- Changing an error response's status code or the documented error body shape.

### Behaviour

- Changing the meaning of an existing field, or the default value of an option whose
  default is documented.
- Changing pagination semantics, sort ordering guarantees, or idempotency behaviour of
  an existing endpoint.
- Removing or renaming an environment variable, or changing the format the service
  expects it to hold.
- Changing how an existing queue consumer interprets a published event payload.

### Operations

- Raising the minimum supported Node.js major version or the minimum PostgreSQL major
  version.

### Before `1.0.0`

While the version is in the `0.x.y` range, feature work that would be MINOR after
stability is generally shipped as a `0.y.0` bump (raising the minor segment) so that the
trajectory toward `1.0.0` is visible. Breaking changes are still called out explicitly in
the PR and the release notes even though SemVer does not require it at `0.x`.

---

## 6. MINOR — what constitutes a bump

Bump MINOR when a change is backwards-compatible and expands the contract:

- Adding a new GraphQL type, query, mutation, or field.
- Adding a new REST endpoint under an existing controller, or an optional query/path
  parameter to an existing one.
- Adding an optional field to a request DTO or response payload.
- Adding a new optional environment variable with a documented, safe default.
- Adding a new enum value **only where the consuming side is documented to tolerate
  unknown values**. If any client switches exhaustively on the enum, the addition is MAJOR.
- Publishing a new event type on the queues for existing consumers to discover.
- Adding a new migration that is purely additive (new table, new nullable column, new
  index) and does not modify or drop existing columns.
- Adding a new module that does not alter existing modules' public surface.

---

## 7. PATCH — what constitutes a bump

Bump PATCH for backwards-compatible corrections where the previous behaviour was a
defect:

- Fixing a bug that returned a wrong value, wrong status code, or wrong error body.
- Fixing a race condition, deadlock, or incorrect cache invalidation.
- Correcting a validation message or log message with no contract change.
- Dependency patch or minor updates that alter no observable behaviour.
- Internal refactors, performance improvements, and test changes.
- Documentation and governance updates, including this policy.

---

## 8. Pre-release conventions

Pre-releases are used for builds that are not yet safe for deployment to production.
The format is `<MAJOR>.<MINOR>.<PATCH>-<PRERELEASE>.<N>`, matching SemVer 2.0.0 ordering
rules: a pre-release has lower precedence than the associated release.

### Recognised pre-release identifiers

| Identifier        | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `alpha`           | Feature-incomplete. Schema and endpoints may change without notice. Not deployable to production. |
| `beta`            | Feature-complete for the target release. Breaking changes are permitted, but must be listed in the release notes. Not deployable to production. |
| `rc`              | Release candidate. Only blocker fixes. This is the artifact intended for final promotion. |
| `dev`             | Continuous integration build off a non-release branch. Never tagged for deployment. |

The numeric counter `<N>` after the identifier increments for each successive build of
the same base version, starting at `1`.

### Examples

```
0.1.0-alpha.1
0.1.0-alpha.2
0.1.0-beta.1
1.0.0-rc.1
1.0.0-rc.2
1.0.0
```

### Rules

- A pre-release is never published to, or promoted into, a production environment.
- `1.0.0-rc.N` is promoted to `1.0.0` only when the `CI Passed` gate is green and all
  migration dry-runs have been executed against a staging database.
- The pre-release counter is monotonic within a base version. A new base version resets
  the counter to `.1`; a previously published `alpha.3` is never re-published as
  `alpha.1` under a different base.
- Hotfixes produced against a published release are versioned from that release line —
  for example, a fix to `1.2.3` is `1.2.4`, never `1.3.0`, regardless of the change's
  apparent scope.
- `dev` builds are not tags; they are CI artifacts keyed by commit SHA.

---

## 9. Build metadata

Build metadata is permitted for non-semantic qualifiers — commit SHA, build number,
CI run ID:

```
1.2.3+build.1847
1.2.3+20260928T213110Z
1.2.3+exp.sha.9f3c1a2
```

Build metadata is ignored when determining precedence, so `1.2.3+a` and `1.2.3+b` are
the same version for comparison purposes. It must never be used to encode a functional
change.

---

## 10. Deprecation policy

A contract that is being removed follows this sequence:

1. **Announce** — the deprecation is stated in the PR description, in the release notes,
   and as a runtime warning or `Deprecation` response header where the surface is HTTP.
2. **Mark deprecated** — GraphQL fields are marked `@deprecated` with a replacement
   description; REST endpoints are documented as deprecated in Swagger.
3. **Observe** — deprecation ships for at least **two MINOR releases** before removal,
   giving consumers time to migrate.
4. **Remove** — removal is a MAJOR bump, taken no earlier than the release after the
   minimum observation window.

Anything else — a bug fix, a security fix, or a legal requirement — is exempt from the
observation window and may be removed in a MAJOR bump without it.

---

## 11. Database migrations and versioning

The schema is versioned by the ordered migration history in `src/migrations`. Because a
rollback may not be possible against production data, migrations have an additional rule:

- **Additive** migrations (new table, new nullable column, new index) may ship in a
  MINOR or PATCH release.
- **Destructive or reshaping** migrations — dropping or renaming a column or table,
  narrowing a type, adding a `NOT NULL` constraint without a backfill — are
  **expand/contract** changes and require a MAJOR bump. They are split across at least
  two releases: the release that adds the new structure, and a later release that removes
  the old one.

A MAJOR release that reshapes the schema must ship an operator-facing migration note
describing the order of operations and any backfill required.

---

## 12. Release process

1. All changes for the release are merged to the target branch under the workflow in
   [CONTRIBUTING.md](../../CONTRIBUTING.md).
2. The highest applicable level from sections 5–7 is determined by reviewing the merged
   PR set for breaking-contract items.
3. `package.json` `version` is updated to the new version in a dedicated `chore(release)`
   PR.
4. The release is tagged `v<version>` (for example `v1.2.0`, `v1.2.0-rc.1`).
5. Release notes list the version, its level, the pre-release identifier if any, and every
   breaking change with its migration instruction.

---

## 13. Enforcement and compliance

| Requirement                                                            | How it is met |
| ---------------------------------------------------------------------- | ------------- |
| Version bump is justified by a documented rule                          | PR description states the level and the trigger; reviewers verify against sections 5–7 |
| Breaking changes are identified                                         | Pull request template's "Breaking changes" section; linked issue labelled `breaking-change` |
| Bump level matches the change set                                       | Squash commit type — a `feat!:` or `BREAKING CHANGE` footer forces a MAJOR |
| Released version is immutable                                           | Tags are not moved; corrections ship as a new version |
| Policy is followed by contributors and maintainers                      | This document is referenced in the review checklist for any PR touching a versioned surface |

Because the repository's continuous integration enforces lint, format, typecheck, build,
unit, and E2E gates on every pull request, a release candidate is only produced from a
green `CI Passed` aggregate. Documentation-only changes under `Governance/` have no
associated automated test surface, so their compliance evidence is the pull request review
against this document rather than a test run.
