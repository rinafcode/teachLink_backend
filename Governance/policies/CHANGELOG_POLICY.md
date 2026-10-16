# Changelog Policy

## Purpose

This policy defines how changes are recorded in the TeachLink Backend repository to ensure that all modifications are easily traceable and clearly communicated to contributors and maintainers. It establishes the required format, the categories of changes, and the circumstances under which an entry is required.

## Changelog Format

The repository follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. All entries must be added to the `CHANGELOG.md` file located at the root of the repository.

Each version entry must include:
- A version number and release date (e.g., `## [1.0.1] - 2026-09-28`).
- A list of categorized changes under appropriate subheadings.

## Change Categories

Changes must be grouped under one of the following categories:
- **Added**: for new features.
- **Changed**: for changes in existing functionality.
- **Deprecated**: for soon-to-be removed features.
- **Removed**: for now removed features.
- **Fixed**: for any bug fixes.
- **Security**: in case of vulnerabilities.
- **Governance**: for updates to project policies, processes, or roles.

## When Entries Are Required

A new changelog entry is **required** for:
- Any pull request that introduces a user-facing change or modifies public API contracts.
- Any bug fixes or performance improvements that impact existing functionality.
- Any updates to project governance or policies.
- Any security-related patches.

A changelog entry is **optional** (or not required) for:
- Minor documentation formatting fixes or typo corrections.
- Internal refactoring that does not affect functionality, performance, or public APIs.
- Updates to internal tests, build pipelines, or CI/CD configuration.

## Compliance and Enforcement

Pull requests that require a changelog entry will not be merged until the entry is present and correctly formatted in `CHANGELOG.md`. Reviewers are responsible for verifying compliance during the code review process.
