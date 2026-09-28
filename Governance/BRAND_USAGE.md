# Brand Usage Guidelines

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](README.md#structure))
- **Last reviewed:** 2026-09-25
- **Review cadence:** Every 12 months, or after any change to project branding or assets

This document governs how the TeachLink name, logo, and related brand assets
may be used by contributors, maintainers, integrators, and third parties. It
exists so that the project's identity is applied consistently and that use of
the brand does not create confusion about official endorsement or affiliation.

This document is part of the project's **Legal & IP** area. It lives entirely
inside the `Governance/` folder and does not change application code.

## 1. Scope

These guidelines apply to:

- The **TeachLink name** and any stylised variations (TeachLink Backend,
  TeachLink API, etc.).
- The **TeachLink logo** (wordmark, icon, and any combination marks).
- Any **colour palette, typography, or visual identity** elements that are
  distinctively associated with the TeachLink project.
- **Domain names, social-media handles, and app-store listings** that include
  "TeachLink".

These guidelines do **not** restrict:

- Referring to TeachLink by name in documentation, blog posts, tutorials, or
  press coverage, provided the reference is accurate and not misleading.
- Using the name in a pull request, issue, commit message, or code comment
  within this repository.
- Forking the repository under a different name, as permitted by the project
  licence, provided the fork is clearly distinguished from the official project.

## 2. Logo and Name Usage Rules

### 2.1 Permitted uses

- **Attribution.** You may display the TeachLink logo or name to accurately
  attribute the project — for example, "Built with TeachLink Backend" or
  "Powered by TeachLink" — provided the display is truthful and clearly
  identifies TeachLink as an upstream project, not as the product or
  organisation of the person displaying it.
- **Documentation and tutorials.** Screenshots, the logo, and the project name
  may be used in documentation, tutorials, course materials, and conference
  presentations that describe the project or its use.
- **Compatible integrations.** A plugin, adapter, or integration that works
  with TeachLink Backend may use the name in its description (e.g. "A TeachLink
  Backend plugin for X") but must not use the logo as the primary branding of
  the integration.

### 2.2 Prohibited uses

- **Implying official endorsement.** Do not use the name or logo in a way that
  implies the TeachLink project or its maintainers endorse, sponsor, or are
  affiliated with your product, service, or organisation, unless a written
  agreement with the maintainers exists.
- **Modified logos.** Do not alter the logo's colours, proportions, typeface,
  or layout. Do not combine the logo with other logos or graphics in a way that
  creates a new composite mark.
- **Primary branding of a fork.** A fork of this project must not use the
  TeachLink name or logo as its primary brand identity. Forks must adopt a
  clearly distinct name.
- **Domain and handle squatting.** Do not register domain names, social-media
  accounts, package names, or app-store listings that incorporate "TeachLink"
  in a way that could be mistaken for the official project.
- **Commercial products named TeachLink.** Do not use "TeachLink" as the name
  or prominent part of the name of a commercial product or service without
  written permission from the maintainers.

## 3. Do and Don't Examples

| Context | ✅ Do | ❌ Don't |
|---|---|---|
| Describing your integration | "My adapter connects TeachLink Backend to Redis." | "TeachLink Redis Adapter — official extension." |
| Tutorial or blog post | Include the logo as a reference image with an attribution caption. | Redesign or recolour the logo for your own blog's header. |
| Conference slide | "We used TeachLink Backend to power our platform." | "TeachLink — a product by [Your Company]." |
| Open-source fork | Name the fork "ForkLink" and note "Forked from TeachLink Backend". | Publish the fork as "TeachLink Enterprise Edition". |
| npm package | `teachlink-plugin-payments` (clearly a plugin) | `teachlink-backend` (implies it is the official package) |

## 4. Asset Location

Official brand assets — the logo in SVG and PNG formats, the approved colour
palette, and the typeface specification — are stored in:

```
Governance/assets/brand/
```

If that directory does not yet exist, contact a maintainer to obtain the
current assets before publishing any use of the logo. Do not reconstruct the
logo from screenshots or other unofficial sources.

Maintainers are responsible for keeping the assets in that directory up to date
when the brand is refreshed.

## 5. Requesting Permission

If your intended use is not clearly covered by §2.1, or if you are unsure
whether a use is permitted, open an issue in this repository with the label
`brand-usage` and describe the intended use. A maintainer will respond within
**14 days**. Written permission granted through that process is recorded in
[`Governance/DECISION_LOG.md`](DECISION_LOG.md).

## 6. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no tests
and requires none. Existing lint, typecheck, build, and test suites must
continue to pass, and the change is verified by the standard CI pipeline
described in `CONTRIBUTING.md`.

## 7. Review

This document is reviewed at least once a year, or whenever the project
refreshes its brand identity or visual assets. Changes are proposed through the
normal governance process described in `Governance/README.md` and must touch
only the `Governance/` folder.

## 8. Related Documents

- [`Governance/README.md`](README.md) — the governance structure this document
  belongs to.
- [`Governance/policies/ATTRIBUTION.md`](policies/ATTRIBUTION.md) — attribution
  requirements for third-party assets used within the project.
- [`Governance/DECISION_LOG.md`](DECISION_LOG.md) — where brand-usage
  permission decisions are recorded.

## 9. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-25 | Initial brand usage guidelines (logo/name rules, do/don't examples, asset location). |
