# Attribution Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-25
- **Review cadence:** Every 6 months, or after any material change to the project's dependencies or licensing

This policy defines when attribution is required for code, content, and other
material incorporated into the TeachLink Backend project, what form that
attribution must take, and how third-party notices are maintained. It exists
so that the project meets its legal obligations to upstream authors, makes its
own licensing situation transparent to downstream consumers, and gives
contributors a clear, consistent rule to follow rather than leaving attribution
to individual judgement.

This policy is part of the project's **Legal & IP** area. It lives entirely
inside the `Governance/` folder and does not change application code.

## 1. When Attribution Is Required

Attribution is required whenever any of the following is true:

1. **Third-party source code is copied or adapted** into the repository —
   including snippets, algorithms, patterns, or data structures taken from
   another project, regardless of whether the source file is modified.
2. **A dependency's licence requires it.** Any licence in the `Attribution
   Required` category (Apache 2.0, BSD, MIT with notice clauses, Creative
   Commons with BY, and any other licence whose text requires preservation of
   notices) mandates attribution whenever the licensed work is distributed.
3. **A verbatim copy of documentation, configuration, or test data** is included
   from an external source. Independently written documentation that describes
   the same concept does not require attribution.
4. **Artwork, icons, or brand assets** from a third party are included.

Attribution is **not** required for:

- Ideas, algorithms, or techniques that are re-implemented independently from
  first principles without copying code or text.
- Standards documents (RFCs, W3C specs, etc.) that are referenced by URL but
  not reproduced.
- Dependencies listed in `package.json` that are consumed as packages and not
  vendored; those are covered by the dependency's own distribution terms.

When in doubt, attribute. Over-attribution is never wrong; under-attribution
can create legal exposure.

## 2. Attribution Format

The required format depends on the type of attributed material:

### 2.1 Source code copied or adapted into a file

Add a comment block at the top of the file (or at the start of the copied
section if only part of the file is derived), before any imports:

```
// Portions of this file are derived from <Project Name> (<URL>)
// Copyright (c) <Year> <Copyright Holder>
// Licensed under the <Licence Name> (<Licence URL>)
```

If the upstream licence requires the full licence text to be reproduced, add it
in a comment block immediately after the notice above, or in an adjacent
`<filename>.LICENSE` file.

### 2.2 Copied documentation or configuration

Add a comment or a prose note at the top of the file:

```
# Adapted from <Project Name> (<URL>)
# Copyright (c) <Year> <Copyright Holder>
# Licensed under the <Licence Name>
```

### 2.3 Assets (icons, images, fonts)

Place a `NOTICE` file in the same directory as the asset containing the
copyright notice, licence name, and source URL.

### 2.4 The project-wide NOTICE file

All attribution entries are additionally consolidated in a single
`THIRD_PARTY_NOTICES.md` (or `NOTICE`) file at the repository root. Each entry
in that file must include:

| Field | Content |
|---|---|
| Component | Name of the upstream project or file |
| Source | URL of the upstream repository or release |
| Copyright | Copyright line(s) from the upstream source |
| Licence | SPDX identifier of the licence |
| Usage | Brief description of how the component is used |

This consolidated file is the primary reference for consumers who need to
satisfy their own attribution obligations when redistributing TeachLink Backend.

## 3. Third-Party Notice Handling

### 3.1 Adding a new third-party component

When a pull request introduces a new third-party component requiring
attribution:

1. The attribution comment or notice is added **in the same pull request** as
   the component itself.
2. The `THIRD_PARTY_NOTICES.md` entry is added in the same pull request.
3. The pull request body states the licence of the component and confirms the
   licence is compatible with the project's own licence.
4. A reviewer confirms the above three items before approving.

A pull request that introduces third-party material without attribution is not
merged. The reviewer who identifies the gap raises it as a blocking comment.

### 3.2 Licence compatibility

Before any third-party material is added, the author confirms that its licence
is compatible with the project's own licence and with the licences of existing
components. Strong copyleft licences (GPL family) require explicit maintainer
approval before inclusion. The compatibility determination is recorded in the
pull request body and, for novel cases, in
[`Governance/DECISION_LOG.md`](../DECISION_LOG.md).

### 3.3 Updating or removing a third-party component

When a third-party component is updated:

- If the new version carries the same licence and copyright holders, only the
  version reference in `THIRD_PARTY_NOTICES.md` is updated.
- If the copyright holders or licence change, the attribution is updated
  accordingly in the same pull request as the update.

When a third-party component is removed:

- The attribution comment is removed from the source.
- The entry is removed from `THIRD_PARTY_NOTICES.md`.
- If the removed component was the only use of a given licence in the project,
  the change is noted in the pull request body.

### 3.4 Automated dependency scanning

The CI pipeline checks that all packages in `package.json` carry recognised
open-source licences. A package whose licence is unrecognised, unlicensed, or
in a category requiring explicit approval (see §3.2) fails the pipeline. This
check is a complement to, not a replacement for, the manual review in §3.1.

## 4. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no tests
and requires none. The CI licence-scanning check described in §3.4 is the
functional enforcement mechanism for newly added dependencies. Existing lint,
typecheck, build, and test suites must continue to pass, and the change is
verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## 5. Review

This policy is reviewed at least every 6 months, or whenever the project's
licence, its dependency set, or the CI pipeline changes materially. Changes are
proposed through the normal governance process described in `Governance/README.md`
and must touch only the `Governance/` folder.

## 6. Related Documents

- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
- [`Governance/policies/CONTRIBUTOR_SIGNOFF.md`](CONTRIBUTOR_SIGNOFF.md) — the
  DCO sign-off mechanism for original contributions, which complements
  attribution for third-party code.
- [`Governance/DECISION_LOG.md`](../DECISION_LOG.md) — where novel
  licence-compatibility decisions are recorded.
- [`Governance/BRAND_USAGE.md`](../BRAND_USAGE.md) — brand asset usage rules,
  which interact with attribution for artwork and logos.
- [`Governance/domains/THIRD_PARTY_INTEGRATION.md`](../domains/THIRD_PARTY_INTEGRATION.md) —
  vetting and data-sharing limits for external service integrations.

## 7. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-25 | Initial attribution policy (when required, format, third-party notice handling). |
