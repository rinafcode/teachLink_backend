# Release Automation Guide

This guide covers the automated release process for TeachLink backend.

## Overview

The release automation system provides:
- **Semantic Versioning** (Major.Minor.Patch)
- **Conventional Commits** support for automatic version determination
- **Automated Changelog Generation** using Keep a Changelog format
- **CI/CD Integration** with GitHub Actions
- **Multi-channel Notifications** (Slack, GitHub releases)

## Quick Start

### Manual Release Using CLI

```bash
# Dry run - see what will be released without committing
npm run release:dry-run

# Release patch version (0.0.1 → 0.0.2)
npm run release:patch

# Release minor version (0.0.1 → 0.1.0)
npm run release:minor

# Release major version (0.0.1 → 1.0.0)
npm run release:major

# Auto-detect version bump based on commits
npm run release:auto
```

### Manual Release Using Script

```bash
# Perform all validation and create release
bash scripts/bump-version.sh patch

# Preview what would be released
bash scripts/bump-version.sh minor --dry-run
```

## Automated Release (GitHub Actions)

### Trigger by Tag Push

Create a version tag to automatically trigger the release workflow:

```bash
# Create and push version tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# This will automatically:
# 1. Run full test suite
# 2. Generate changelog
# 3. Create GitHub release
# 4. Publish to npm
```

### Trigger via Workflow Dispatch

Use GitHub's manual workflow trigger:

1. Go to: [GitHub Actions → Release Automation](https://github.com/teachLink/teachLink_backend/actions/workflows/release.yml)
2. Click "Run workflow"
3. Select release type: `patch`, `minor`, or `major`
4. Choose whether to do a dry run
5. Click "Run workflow"

## Version Bumping Strategy

### Semantic Versioning

Version format: `MAJOR.MINOR.PATCH`

| Type | Increment | When | Example |
|------|-----------|------|---------|
| Major | X.0.0 | Breaking API changes, major features | 1.0.0 → 2.0.0 |
| Minor | X.Y.0 | New features, backwards compatible | 1.0.0 → 1.1.0 |
| Patch | X.Y.Z | Bug fixes | 1.0.0 → 1.0.1 |

### Conventional Commits

The system automatically detects version bumps from commit messages:

```
feat!: breaking change → MAJOR
feat: new feature → MINOR
fix: bug fix → PATCH
chore: no version bump
```

## Changelog Generation

Changelog is automatically generated from commits using the [Keep a Changelog](https://keepachangelog.com/) format.

### Commit Categories

Commits are organized by type:

| Type | Changelog Section | Example |
|------|------------------|---------|
| `feat!:` or `BREAKING CHANGE:` | ⚠️ Breaking Changes | `feat!: change API endpoint` |
| `feat:` | Added | `feat: add email notifications` |
| `fix:` | Fixed | `fix: resolve null pointer error` |
| `perf:` | Performance | `perf: optimize query execution` |
| `refactor:` | Changed | `refactor: simplify validation logic` |
| `docs:` | Documentation | `docs: update API guide` |
| `test:` | Tests | `test: add unit tests for auth` |
| `chore:` | Skip | `chore: update dependencies` |

### Example Changelog Entry

```markdown
## [0.1.0] - 2026-04-28

### ⚠️ BREAKING CHANGES

- Changed authentication endpoint from `/auth/login` to `/api/v1/auth/login` (#123)

### Added

- Email notification service (#124)
- Rate limiting for API endpoints (#125)

### Fixed

- Resolved memory leak in socket connections (#126)
- Fixed timezone handling in course scheduling (#127)

### Performance

- Optimized database query for course listing (50% faster) (#128)
```

## Release Workflow Steps

### 1. Preparation

```bash
# Ensure you're on main branch and up-to-date
git checkout main
git pull origin main

# Verify working directory is clean
git status
```

### 2. Pre-Release Validation

The release workflow automatically:
- ✓ Runs all tests
- ✓ Checks linting
- ✓ Verifies TypeScript types
- ✓ Builds the distribution
- ✓ Generates changelog
- ✓ Validates git state

### 3. Version Bump & Commit

```bash
# Scripts update:
# - package.json version field
# - package-lock.json
# - CHANGELOG.md

# Example commit message:
# chore: bump version to 0.1.0
```

### 4. Git Tag & Push

```bash
# Creates annotated tag:
git tag -a v0.1.0 -m "Release v0.1.0"

# Pushes to main branch with tags:
git push origin main --follow-tags
```

### 5. GitHub Release Creation

- Creates GitHub release with tag
- Includes full changelog
- Marks as pre-release if version contains `-` (e.g., `0.1.0-beta.1`)

### 6. npm Publishing

- Publishes to npm registry (if not a pre-release)
- Uses `NPM_TOKEN` secret for authentication

### 7. Notifications

- Posts success message to Slack (`#releases` channel)
- Includes version number and link to GitHub release

## Release Checklist

Before releasing, ensure:

- [ ] All tests passing (`npm run test:ci`)
- [ ] Code linted (`npm run lint:ci`)
- [ ] Types check (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] CHANGELOG.md up-to-date
- [ ] On `main` branch
- [ ] Git working directory clean
- [ ] Latest changes pulled from remote
- [ ] No concurrent releases in progress

## Dry Run Mode

Preview a release without committing changes:

```bash
# Via npm script
npm run release:dry-run

# Via bash script
bash scripts/bump-version.sh patch --dry-run

# Via GitHub Actions
# 1. Go to Release Automation workflow
# 2. Click "Run workflow"
# 3. Check "Perform a dry run without creating release"
```

Dry run shows:
- Next version number
- Changelog preview
- Files to be modified
- Steps that will be executed

## Troubleshooting

### Release Stuck in Progress

```bash
# Check workflow status
gh workflow view release.yml --repo teachLink/teachLink_backend

# Cancel stuck workflow
gh run cancel <RUN_ID> --repo teachLink/teachLink_backend
```

### Version Mismatch Between package.json and Git Tags

```bash
# Check current version
node -p "require('./package.json').version"

# Check latest git tag
git describe --tags

# If mismatch, manually sync:
git tag v$(node -p "require('./package.json').version")
git push origin v$(node -p "require('./package.json').version")
```

### npm Publish Failed

**Cause**: `NPM_TOKEN` secret not configured or expired

**Solution**:
1. Regenerate npm token: https://www.npmjs.com/settings/tokens
2. Update secret in GitHub: Settings → Secrets → NPM_TOKEN

### Slack Notification Not Received

**Cause**: `SLACK_WEBHOOK_RELEASES` secret not configured

**Solution**:
1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Update secret in GitHub: Settings → Secrets → SLACK_WEBHOOK_RELEASES

## Environment Variables & Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables):

| Secret | Description | Example |
|--------|-------------|---------|
| `NPM_TOKEN` | npm authentication for publishing | `npm_xxxx...` |
| `SLACK_WEBHOOK_RELEASES` | Slack webhook for notifications | `https://hooks.slack.com/services/...` |

## Scripts Reference

### get-next-version.js

Calculate next semantic version based on conventional commits.

```bash
# Auto-detect by analyzing commits
node scripts/get-next-version.js auto

# Explicit version bump
node scripts/get-next-version.js patch
node scripts/get-next-version.js minor
node scripts/get-next-version.js major

# For tag-based releases (GitHub Actions)
node scripts/get-next-version.js tag
```

Output: `new_version` variable and `.next_version` file

### generate-changelog.js

Generate changelog from commits since last tag.

```bash
node scripts/generate-changelog.js <version>
```

Updates `CHANGELOG.md` with new entries and outputs changelog text for GitHub release.

### bump-version.sh

Complete release automation script.

```bash
# Automated patch release
bash scripts/bump-version.sh patch

# Minor release with confirmation prompt
bash scripts/bump-version.sh minor

# Major release (dry run - no commits)
bash scripts/bump-version.sh major --dry-run

# Auto-detect version bump
bash scripts/bump-version.sh auto
```

Actions:
1. Validates git state
2. Calculates next version
3. Generates changelog
4. Prompts for confirmation
5. Updates version in package.json
6. Runs build and tests
7. Commits changes
8. Creates git tag
9. Pushes to remote

## Best Practices

### 1. Use Conventional Commits

```bash
# Good ✓
git commit -m "feat: add email notifications"
git commit -m "fix: resolve null pointer in auth"
git commit -m "feat!: change API endpoint format (breaking)"

# Avoid ✗
git commit -m "updated stuff"
git commit -m "bug fixes and improvements"
```

### 2. Test Before Releasing

```bash
npm run test:ci
npm run build
npm run lint:ci
```

### 3. Review Changelog

```bash
# See what will be in changelog
npm run changelog:generate | head -30
```

### 4. One Release at a Time

- Don't push multiple tags in quick succession
- Wait for workflow to complete
- Check Slack notification for success

### 5. Keep main Branch Stable

- All releases come from `main` branch
- Only merge tested, reviewed PRs to `main`
- Release frequently (weekly or bi-weekly)

## Release Frequency Recommendations

| Project Size | Recommended Frequency |
|--------------|----------------------|
| Small | Weekly or bi-weekly |
| Medium | 2-4 times per month |
| Large | On-demand (multiple times daily) |

For TeachLink: **Weekly releases** (every Monday morning)

## Monitoring Releases

### GitHub Actions

Monitor releases in real-time:
- Dashboard: [Actions → Release Automation](https://github.com/teachLink/teachLink_backend/actions/workflows/release.yml)
- Get status: `gh workflow view release.yml`

### npm Registry

Verify published package:
- https://www.npmjs.com/package/teachLink_backend

### GitHub Releases

View all releases:
- https://github.com/teachLink/teachLink_backend/releases

## Support & Questions

For issues or questions about the release process:

1. Check this documentation
2. Review workflow logs in GitHub Actions
3. Ask in `#infrastructure` Slack channel
4. Check recent issues: [Release Automation Label](https://github.com/teachLink/teachLink_backend/labels/release%20automation)

---

**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering  
**Related Issues**: [#444](https://github.com/teachLink/teachLink_backend/issues/444)
