# Release Notes Template

This is the template every release note in the TeachLink Backend project
starts from. A release note tells contributors and operators what changed in
a release, what they need to do about it, and where to find the detail.

This document is part of the project's **Release** area. It lives entirely
inside the `Governance/` folder and does not change application code.

## How To Use This Template

Copy the section below into `CHANGELOG.md` (or the release's own notes file)
for each release, and fill in every section. Delete any section that has no
entries rather than leaving it empty.

---

## Template

```markdown
# Release <VERSION> (<YYYY-MM-DD>)

## Highlights

One short paragraph describing the most important thing in this release and
why it matters to someone upgrading. This is the section a reader skims
first — write it for a reader who will not read the rest.

## Change Categories

### Added
- New features or endpoints.

### Changed
- Changes to existing behaviour.

### Fixed
- Bug fixes.

### Deprecated
- Features that still work but will be removed.

### Removed
- Features or endpoints that no longer exist.

### Security
- Vulnerability fixes. Link the advisory if one exists.

## Upgrade Notes

- Steps an operator must take to upgrade, in order.
- Required configuration or environment changes.
- Database migrations or other manual steps.

## Breaking Changes

- Every behaviour or interface change that can break a consumer.
- The old behaviour, the new behaviour, and the migration path for each.

## Deprecations

- What is deprecated, since when, and the planned removal release.

## Contributors

- GitHub handles of everyone who contributed to this release.
```

## Section Guidance

- **Highlights** — one paragraph, maximum five sentences, focused on impact
  rather than implementation.
- **Change Categories** — every entry goes under exactly one category; when
  in doubt between `Changed` and `Fixed`, use `Fixed` only when the previous
  behaviour was incorrect.
- **Upgrade Notes** — write these for an operator following them at 2 a.m.;
  each step must be a command or a concrete action, never a suggestion.
- **Breaking Changes** — an entry belongs here if any consumer of the API,
  the SDK, or the configuration must change code or configuration to keep
  working.

## Versioning

Releases follow the versioning rules in `CONTRIBUTING.md`. The release note
filename and heading must use the same version string as the git tag.
