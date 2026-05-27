# feat(api): API Versioning, Response Standardization & OpenAPI Documentation

- Add API versioning interceptor and module with global response transform
- Add global exception filter for standardized error responses
- Add OpenAPI spec generation scripts and GitHub Pages deployment workflow
- Update controllers to align with versioned API structure
- Add flakiness reporter and improve test utilities

## Linked Issue

<!-- Every PR must be tied to a GitHub Issue. Replace N with the issue number. -->
<!-- GitHub will automatically close the issue when this PR is merged.        -->

Closes #618

---

## What does this PR do?

This PR introduces a global `ApiVersionInterceptor` that reads the `X-API-Version` header on every request and rejects unsupported versions before they reach any controller. A `ResponseTransformInterceptor` wraps all successful responses in a consistent `{ success, data, correlationId }` envelope, and a `GlobalExceptionFilter` normalises every error into the same predictable shape. On the documentation side, `scripts/generate-api-docs.js` generates a fully-typed OpenAPI 3.0.3 spec and a self-contained ReDoc site under `docs/site/`, which is automatically deployed to GitHub Pages on every push to `main` via the new `api-docs.yml` workflow. The implementation was chosen to be purely additive through NestJS global interceptors so no controller needed bespoke changes beyond removing hand-rolled `{ success: true }` wrappers.

---

## Type of change

<!-- Check all that apply -->

- [x] ✨ New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [x] 💥 Breaking change (fix or feature that changes existing API behaviour)
- [ ] ♻️ Refactor (no functional change, no new feature)
- [ ] 🧪 Tests only (no production code changes)
- [x] 📝 Documentation only
- [x] 🔧 Chore (build, dependencies, CI config)

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
- [x] New API endpoints are covered by at least one e2e test
- [ ] No existing tests were deleted (if any were, justification is provided in the PR description)

**Error handling & NestJS best practices**

- [x] All new/updated DTOs use `class-validator` / `class-transformer` decorators and are wired through NestJS pipes (e.g. global `ValidationPipe` or explicit)
- [x] All controller entry points validate external input at the boundary (no unvalidated raw `any`/`unknown` reaching the domain)
- [x] Controllers/services throw appropriate NestJS HTTP exceptions (e.g. `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`) instead of generic `Error`
- [x] Any new error shapes are handled by existing exception filters or the filters have been updated accordingly
- [x] Logging goes through the shared logging abstraction (e.g. Nest `Logger` or central logger service) with meaningful, structured messages
- [x] Authentication/authorization guards (e.g. `AuthGuard`, role/permissions guards, custom guards) are applied to all new/modified endpoints where appropriate
- [ ] If an endpoint is intentionally public, this is explicitly mentioned in the PR description with rationale

**API documentation / Swagger**

- [x] Swagger / OpenAPI decorators are added or updated for all new/changed controller endpoints (including DTOs, responses, and error schemas)
- [x] I have started the app locally and confirmed the `/api` (or Swagger UI) reflects new/changed endpoints correctly
- [ ] If there are **no** API surface changes, this is explicitly stated in the PR description

**Breaking changes**

- [ ] This PR does **not** introduce a breaking API change
- [x] OR: this PR introduces a breaking change and it is documented below, with migration notes

---

## Breaking change description (if applicable)

| Area | Before | After |
|---|---|---|
| Success response shape | Raw controller return value | `{ success: true, data: <value>, correlationId: <id> }` |
| Error response shape | NestJS default exception body | `{ success: false, statusCode, message, path, timestamp, correlationId }` |
| `X-API-Version` header | Ignored | Required (defaults to `"1"`); invalid version → `400 Bad Request` |

**Migration:** Consumers must unwrap `.data` from all success responses. Consumers that already key on `success: true` in the response body are unaffected by the success shape change. All clients should begin sending `X-API-Version: 1` on every request; omitting the header falls back to the default version (`"1"`) so existing integrations will not break immediately, but relying on the default is discouraged.

---

## Test evidence (required)

**Commands run locally**

```text
npm run lint:ci       ✅
npm run format:check  ✅
npm run typecheck     ✅
npm run test:ci       ✅
npm run docs:generate ✅  — wrote docs/site/index.html, docs/site/openapi-spec.json
```

**Manual / API verification**

```text
# Verified response envelope on the root health endpoint
curl http://localhost:3000/
# → { "success": true, "data": { "message": "TeachLink API is running", "timestamp": "..." }, "correlationId": "..." }

# Verified versioning rejection
curl -H "X-API-Version: 99" http://localhost:3000/
# → 400 { "success": false, "statusCode": 400, "message": "Unsupported API version \"99\". Supported versions: 1", ... }

# Verified docs site
npm run docs:generate && open docs/site/index.html
# ReDoc rendered all endpoints from the generated openapi-spec.json
```

---

## Screenshots / recordings (if applicable)

<!-- Add Swagger screenshots, error responses, or UI flows if they help reviewers. -->
<!-- Delete this section if not applicable. -->
