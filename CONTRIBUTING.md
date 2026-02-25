# Contributing to TeachLink Backend

Thank you for investing time in TeachLink. This document is the single source of truth for how code moves from idea to production. Read it fully before opening your first PR.

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [Before You Start](#2-before-you-start)
3. [Branch Strategy](#3-branch-strategy)
4. [Branch Protection Rules](#4-branch-protection-rules)
5. [Setting Up Locally](#5-setting-up-locally)
6. [Development Workflow](#6-development-workflow)
7. [Commit Message Convention](#7-commit-message-convention)
8. [Pull Request Requirements](#8-pull-request-requirements)
9. [PR Review Policy](#9-pr-review-policy)
10. [CI Pipeline](#10-ci-pipeline)
11. [Merging](#11-merging)
12. [After Merge](#12-after-merge)
13. [Getting Help](#13-getting-help)

---

## 1. Code of Conduct

All contributors are expected to be respectful, constructive, and professional. Discriminatory language, personal attacks, or dismissive comments will result in removal from the project.

---

## 2. Before You Start

Every change — no matter how small — must be linked to a GitHub Issue. This keeps the project's backlog accurate and ensures contributors are not duplicating work.

**Steps before writing a single line of code:**

1. Search [open issues](../../issues) to confirm the problem or feature isn't already being worked on.
2. If no issue exists, open one and describe the problem, the proposed fix, and the modules affected.
3. Comment on the issue to claim it. A maintainer will assign it to you.
4. Only then create a branch and start coding.

> **PRs without a linked issue will not be reviewed and will be closed.**

---

## 3. Branch Strategy

```
main           ← production-ready code only; protected
develop        ← integration branch; all feature PRs target here
feature/*      ← new features and enhancements
fix/*          ← bug fixes
hotfix/*       ← urgent production fixes that target main directly
chore/*        ← non-functional changes (deps, docs, config)
```

### Naming convention

```
feature/issue-42-wallet-auth-refresh
fix/issue-88-notification-race-condition
hotfix/issue-101-dao-vote-overflow
chore/issue-55-update-nestjs-deps
```

Rules:

- Always prefix with the issue number: `issue-<N>-<short-slug>`
- Use kebab-case, all lowercase, no spaces
- Keep slugs under 40 characters
- Never commit directly to `main` or `develop` — branch protection will block it

---

## 4. Branch Protection Rules

The rules below are enforced by GitHub Branch Protection on both `main` and `develop`. They cannot be bypassed by any contributor, including repository admins.

### `main` — Production Branch

| Rule                              | Setting                                            |
| --------------------------------- | -------------------------------------------------- |
| Direct push                       | ❌ Disabled for everyone including admins          |
| Require PR                        | ✅ Required                                        |
| Required approvals                | **2 approvals** from project maintainers           |
| Dismiss stale reviews             | ✅ Enabled — new commits reset existing approvals  |
| Require review from code owners   | ✅ Enabled (see `CODEOWNERS`)                      |
| Required status checks            | ✅ Must pass before merge                          |
| Require branches to be up to date | ✅ Branch must be current with `main` before merge |
| Require conversation resolution   | ✅ All PR comments must be resolved                |
| Restrict merge methods            | ✅ Squash merge only                               |
| Allow force push                  | ❌ Disabled                                        |
| Allow deletions                   | ❌ Disabled                                        |

### `develop` — Integration Branch

| Rule                              | Setting                                               |
| --------------------------------- | ----------------------------------------------------- |
| Direct push                       | ❌ Disabled for everyone including admins             |
| Require PR                        | ✅ Required                                           |
| Required approvals                | **1 approval** from any team member                   |
| Dismiss stale reviews             | ✅ Enabled                                            |
| Required status checks            | ✅ Must pass before merge                             |
| Require branches to be up to date | ✅ Branch must be current with `develop` before merge |
| Require conversation resolution   | ✅ All PR comments must be resolved                   |
| Restrict merge methods            | ✅ Squash merge only                                  |
| Allow force push                  | ❌ Disabled                                           |
| Allow deletions                   | ❌ Disabled                                           |

### Required status checks (both branches)

All of the following GitHub Actions jobs must report `success` before any merge button is enabled. These correspond to the jobs defined in `.github/workflows/ci.yml`:

```
CI Passed         ← aggregate gate (set this as the sole required check)
```

The `CI Passed` job only passes when all upstream jobs succeed:

- ESLint (`--max-warnings 0`)
- Prettier format check
- TypeScript type check (`tsc --noEmit`)
- NestJS build
- Unit tests (Jest, coverage ≥ 70 %)
- E2E tests (Supertest against Postgres + Redis)

---

## 5. Setting Up Locally

### Prerequisites

| Tool              | Minimum version |
| ----------------- | --------------- |
| Node.js           | 20 LTS          |
| npm               | 10+             |
| PostgreSQL        | 15+             |
| Redis             | 7+              |
| Docker (optional) | 24+             |

### Install

```bash
git clone https://github.com/<org>/teachlink-backend.git
cd teachlink-backend
npm ci
cp .env.example .env
# Fill in .env values before starting
```

### Run checks before your first commit

```bash
npm run lint:ci         # ESLint — zero warnings allowed
npm run format:check    # Prettier — must pass with no changes
npm run typecheck       # TypeScript — zero type errors
npm run test:ci         # Unit tests + coverage
```

All four commands must exit with code `0` before a PR will be accepted.

---

## 6. Development Workflow

```
1.  Claim issue on GitHub
2.  git checkout develop && git pull origin develop
3.  git checkout -b feature/issue-<N>-<slug>
4.  Write code + tests
5.  npm run lint:ci && npm run format:check && npm run typecheck
6.  npm run test:ci
7.  git add . && git commit -m "feat(module): short description (#<N>)"
8.  git push origin feature/issue-<N>-<slug>
9.  Open PR on GitHub targeting `develop`
10. Fill in the PR template completely
11. Wait for CI to pass and reviewers to approve
12. Address all review comments
13. Maintainer squash-merges
```

---

## 7. Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description> (#<issue-number>)

[optional body]

[optional footer]
```

### Types

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature or endpoint                                 |
| `fix`      | Bug fix                                                 |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                                |
| `chore`    | Build process, dependency, or tooling changes           |
| `docs`     | Documentation only                                      |
| `perf`     | Performance improvement                                 |
| `ci`       | CI/CD configuration                                     |

### Scopes (match module names)

`auth`, `users`, `courses`, `payments`, `notifications`, `messaging`, `gamification`, `assessment`, `search`, `caching`, `queues`, `security`, `health`, `common`, `config`, `ci`

### Examples

```
feat(auth): add wallet-based JWT refresh endpoint (#42)
fix(notifications): resolve WebSocket race condition on reconnect (#88)
test(payments): add stripe webhook handler unit tests (#95)
chore(deps): upgrade NestJS to v11 (#55)
ci: add coverage threshold enforcement to pipeline (#12)
```

### Rules

- Subject line maximum 72 characters
- Use imperative mood — "add endpoint", not "added endpoint" or "adds endpoint"
- Always include the issue number in parentheses at the end of the subject line
- Do not end the subject line with a period

---

## 8. Pull Request Requirements

Every PR must satisfy **all** of the following before a reviewer will read the code:

### Checklist (enforced via PR template)

The GitHub pull request template (`.github/pull_request_template.md`) is **required for all contributors**.  
Do not delete sections or checklist items. Unchecked items without a clear explanation in the PR description are treated as **merge blockers**.

Key items the template enforces:

- **Linked issue**
  - [ ] This PR closes `#<issue-number>` using `Closes #<N>` / `Fixes #<N>` / `Resolves #<N>`

- **Branch & commits**
  - [ ] Branch is up to date with the target branch (`develop` or `main`)
  - [ ] Branch name follows the convention: `feature/issue-<N>-<slug>` / `fix/issue-<N>-<slug>` / `hotfix/issue-<N>-<slug>`
  - [ ] All commits and the PR title follow the Conventional Commits format and include the issue number

- **Code quality & tests**
  - [ ] `npm run lint:ci` passes with zero warnings
  - [ ] `npm run format:check` passes
  - [ ] `npm run typecheck` passes with zero errors
  - [ ] `npm run test:ci` passes and coverage threshold is maintained
  - [ ] All new code paths have appropriate unit and/or e2e tests

- **Error handling & NestJS best practices**
  - [ ] DTOs use `class-validator` / `class-transformer` and are wired through NestJS validation pipes
  - [ ] Inputs are validated at controller/module boundaries (no unvalidated raw payloads reaching services)
  - [ ] Proper NestJS HTTP exceptions are thrown instead of generic `Error`
  - [ ] Logging uses the shared logger with meaningful, structured messages
  - [ ] Guards (auth/role/permission or custom) protect all endpoints that require authentication/authorization

- **Documentation / Swagger**
  - [ ] Swagger / OpenAPI decorators are present and updated for all new/changed endpoints, including error responses
  - [ ] The author has verified locally that Swagger (e.g. `/api`) reflects the changes
  - [ ] `README.md` or `CONTRIBUTING.md` is updated if contributor workflow or API behaviour changes

- **Breaking changes**
  - [ ] Any breaking API change is explicitly called out in the dedicated template section
  - [ ] The linked issue is flagged with an appropriate label (for example, `breaking-change`)

In addition, the template includes a **Test evidence** section where authors must paste the exact commands run and any relevant manual/API verification steps.  
PRs without concrete test evidence will be asked for changes and are not eligible for approval.

### PR title format

```
feat(auth): add wallet refresh token rotation (#42)
^    ^       ^                                  ^
type scope   description                       issue
```

The PR title must match the same Conventional Commits format as individual commit messages.

### Linked issue requirement

The PR description must contain one of:

```
Closes #<N>
Fixes #<N>
Resolves #<N>
```

GitHub will automatically close the linked issue when the PR is merged. PRs that do not contain this line will be rejected during review.

---

## 9. PR Review Policy

### Who reviews what

A `CODEOWNERS` file at the repository root maps module directories to their responsible maintainers. GitHub automatically requests review from the relevant code owner when a PR touches their module.

```
# CODEOWNERS
*                         @teachlink/backend-maintainers
src/auth/                 @teachlink/auth-team
src/payments/             @teachlink/payments-team
src/web3/                 @teachlink/web3-team
.github/                  @teachlink/devops-team
```

### Review SLA

| Branch target | Required approvals         | SLA             |
| ------------- | -------------------------- | --------------- |
| `develop`     | 1                          | 2 business days |
| `main`        | 2 (including 1 code owner) | 3 business days |

### Reviewer responsibilities

Reviewers are expected to check:

- Correctness of logic — does the code do what the issue asked for?
- Security — no secrets in code, input validation present, auth guards applied
- Test coverage — all new paths have tests
- API contract — no silent breaking changes to existing endpoints
- Error handling — DTO validation, proper NestJS HTTP exceptions, logging via the shared logger, guards/filters applied consistently
- Module boundaries — NestJS dependency injection used correctly
- Performance — no N+1 queries, no unbounded loops on collections from DB

### Author responsibilities during review

- Respond to every comment, even if just to acknowledge
- Do not resolve reviewer threads yourself — the reviewer resolves after they are satisfied
- Do not force-push during review — add commits, so reviewers can see what changed
- If a suggestion is rejected, explain why in the thread

### Stale review invalidation

Pushing new commits to a PR under review automatically invalidates all existing approvals. The reviewer must re-approve after reviewing the new commits.

---

## 10. CI Pipeline

Defined in `.github/workflows/ci.yml`. Full documentation in [README.md](README.md#-ci--testing).

### What runs on every PR

| Job          | Description                  | Blocks merge |
| ------------ | ---------------------------- | ------------ |
| `install`    | `npm ci` with cache          | Yes          |
| `lint`       | ESLint zero-warning check    | Yes          |
| `format`     | Prettier check (no rewrite)  | Yes          |
| `typecheck`  | `tsc --noEmit`               | Yes          |
| `build`      | `nest build`                 | Yes          |
| `unit-tests` | Jest + coverage ≥ 70%        | Yes          |
| `e2e-tests`  | Supertest + Postgres + Redis | Yes          |
| `ci-success` | Aggregate gate               | Yes          |

### Reproducing a CI failure locally

```bash
# Lint failure
npm run lint:ci

# Format failure
npm run format:check

# Type error
npm run typecheck

# Unit test / coverage failure
npm run test:ci

# E2E failure (requires local Postgres + Redis)
npm run test:e2e
```

If CI fails on your PR, fix the issue locally, confirm it passes, then push. Do not ask reviewers to approve while CI is red.

---

## 11. Merging

### Who can merge

Only repository maintainers with the **Maintainer** GitHub role can merge PRs. Contributors cannot self-merge.

### Merge method

**Squash and merge only.** This produces a single, clean commit per feature on the target branch. The squash commit message must follow the Conventional Commits format and include the issue reference.

### When merging is permitted

All of the following must be true simultaneously:

1. ✅ `CI Passed` status check is green
2. ✅ Required approvals are present (1 for `develop`, 2 for `main`)
3. ✅ No unresolved review conversations
4. ✅ Branch is up to date with the target branch
5. ✅ PR description contains `Closes #<N>` (or equivalent)

If any condition is not met, the merge button is disabled by branch protection.

### Hotfixes to `main`

Hotfixes bypass `develop` and target `main` directly:

```bash
git checkout main && git pull origin main
git checkout -b hotfix/issue-<N>-<slug>
# fix the issue
git push origin hotfix/issue-<N>-<slug>
# Open PR targeting main — requires 2 approvals and CI passing
```

After the hotfix merges to `main`, immediately back-merge to `develop`:

```bash
git checkout develop && git pull origin develop
git merge --no-ff main
git push origin develop
```

---

## 12. After Merge

- The linked GitHub Issue is automatically closed by the `Closes #N` reference.
- Delete your feature branch — GitHub will prompt you on the merged PR page.
- If your change affects any documented API endpoint, update the Swagger annotations and re-verify `/api` renders correctly.
- Monitor the deployment pipeline for any unexpected failures post-merge.

---

## 13. Getting Help

| Channel                              | Purpose                                      |
| ------------------------------------ | -------------------------------------------- |
| GitHub Issues                        | Feature requests, bug reports, task tracking |
| GitHub Discussions                   | Architecture questions, RFC proposals        |
| [Telegram](https://t.me/teachlinkOD) | Community support, quick questions           |

For security vulnerabilities, do **not** open a public issue. Email the maintainers directly with full reproduction details.
