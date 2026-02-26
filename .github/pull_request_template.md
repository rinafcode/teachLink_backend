## Linked Issue

<!-- Every PR must be tied to a GitHub Issue. Replace N with the issue number. -->
<!-- GitHub will automatically close the issue when this PR is merged.        -->

Closes #N

---

## What does this PR do?

<!-- A short paragraph (2–5 sentences) describing the change and the reasoning behind it. -->
<!-- Do not repeat the issue description verbatim — explain the implementation choice. -->

---

## Type of change

<!-- Check all that apply -->

- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that changes existing API behaviour)
- [ ] ♻️ Refactor (no functional change, no new feature)
- [ ] 🧪 Tests only (no production code changes)
- [ ] 📝 Documentation only
- [ ] 🔧 Chore (build, dependencies, CI config)

---

## Pre-merge checklist (required)

> **Do not remove items. Unchecked items without an explanation will block merge.**

**Branch & metadata**

- [ ] Branch name follows `feature/issue-<N>-<slug>` / `fix/issue-<N>-<slug>` convention
- [ ] Branch is up to date with the target branch (`develop` or `main`)
- [ ] All commits and the PR title follow the Conventional Commits format with issue reference

**Code quality & tests**

- [ ] `npm run lint:ci` — zero ESLint warnings
- [ ] `npm run format:check` — Prettier reports no changes needed
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run test:ci` — all tests pass, coverage ≥ 70%
- [ ] New service methods have corresponding `.spec.ts` unit tests
- [ ] New API endpoints are covered by at least one e2e test
- [ ] No existing tests were deleted (if any were, justification is provided in the PR description)

**Error handling & NestJS best practices**

- [ ] All new/updated DTOs use `class-validator` / `class-transformer` decorators and are wired through NestJS pipes (e.g. global `ValidationPipe` or explicit)
- [ ] All controller entry points validate external input at the boundary (no unvalidated raw `any`/`unknown` reaching the domain)
- [ ] Controllers/services throw appropriate NestJS HTTP exceptions (e.g. `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`) instead of generic `Error`
- [ ] Any new error shapes are handled by existing exception filters or the filters have been updated accordingly
- [ ] Logging goes through the shared logging abstraction (e.g. Nest `Logger` or central logger service) with meaningful, structured messages
- [ ] Authentication/authorization guards (e.g. `AuthGuard`, role/permissions guards, custom guards) are applied to all new/modified endpoints where appropriate
- [ ] If an endpoint is intentionally public, this is explicitly mentioned in the PR description with rationale

**API documentation / Swagger**

- [ ] Swagger / OpenAPI decorators are added or updated for all new/changed controller endpoints (including DTOs, responses, and error schemas)
- [ ] I have started the app locally and confirmed the `/api` (or Swagger UI) reflects new/changed endpoints correctly
- [ ] If there are **no** API surface changes, this is explicitly stated in the PR description

**Breaking changes**

- [ ] This PR does **not** introduce a breaking API change
- [ ] OR: this PR introduces a breaking change and it is documented below, with migration notes

---

## Breaking change description (if applicable)

<!-- If you checked "Breaking change" above, describe what changes and how consumers should migrate. -->
<!-- Include any feature flags, deprecation periods, or follow-up tasks. -->
<!-- Delete this section if not applicable. -->

---

## Test evidence (required)

<!-- Paste concrete evidence that the change was tested.  -->
<!-- Examples: exact npm scripts run with ✅ results, curl/Postman examples, screenshots of Swagger, Jest test names, etc. -->

**Commands run locally**

```text
# Example (edit as needed)
npm run lint:ci
npm run format:check
npm run typecheck
npm run test:ci
```

**Manual / API verification**

```text
# Example: describe manual tests, curl commands, or Postman collections used
```

---

## Screenshots / recordings (if applicable)

<!-- Add Swagger screenshots, error responses, or UI flows if they help reviewers. -->
<!-- Delete this section if not applicable. -->
