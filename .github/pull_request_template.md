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

## Pre-merge checklist

**Branch**

- [ ] Branch name follows `feature/issue-<N>-<slug>` convention
- [ ] Branch is up to date with the target branch (`develop` or `main`)
- [ ] All commits follow the Conventional Commits format with issue reference

**Code quality** — run these locally and confirm they pass:

- [ ] `npm run lint:ci` — zero ESLint warnings
- [ ] `npm run format:check` — Prettier reports no changes needed
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run test:ci` — all tests pass, coverage ≥ 70%

**Testing**

- [ ] New service methods have corresponding `.spec.ts` unit tests
- [ ] New API endpoints are covered by at least one e2e test
- [ ] No existing tests were deleted (if any were, explain below)

**Documentation**

- [ ] JSDoc comments added to all new public service methods
- [ ] Swagger / OpenAPI decorators added for all new controller endpoints
- [ ] `README.md` or `CONTRIBUTING.md` updated if this changes contributor workflow

**Breaking changes**

- [ ] This PR does **not** introduce a breaking API change
- [ ] OR: this PR introduces a breaking change and it is documented below

---

## Breaking change description (if applicable)

<!-- If you checked "Breaking change" above, describe what changes and how consumers should migrate. -->
<!-- Delete this section if not applicable. -->

---

## Testing notes

<!-- Describe how reviewers can manually verify this change if needed. -->
<!-- Include example curl commands, Swagger routes, or Jest test names to run. -->

---

## Screenshots / recordings (if applicable)

<!-- Delete if not applicable -->
