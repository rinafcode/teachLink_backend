# RFC Template

This is the template every RFC in the TeachLink Backend project starts from.
It exists so that every proposal is reviewable in the same shape, and so a
reviewer can find the information they need (the problem, the proposed
change, its impact) in the same place every time.

This document is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code. Usage of this template is governed by
`Governance/processes/RFC_PROCESS.md`.

## How To Use This Template

Copy the section below into a new file at `Governance/rfcs/NNNN-short-title.md`
(four-digit sequence number, matching the numbering scheme described in
`Governance/templates/ADR_TEMPLATE.md`, where one exists), or paste it into a
GitHub Discussion / issue if the RFC process runs there instead — whichever
`Governance/processes/RFC_PROCESS.md` specifies. Fill in every section; do
not delete a section because it feels premature — write "Not yet known" or
"N/A" with a one-line reason instead, so reviewers can see it was considered.

---

## Metadata Header

Every RFC opens with this header, filled in:

```markdown
- **RFC:** <sequence number, assigned when the RFC is opened>
- **Title:** <short, descriptive title>
- **Author(s):** <GitHub handle(s)>
- **Status:** Draft | In Review | Accepted | Rejected | Withdrawn | Superseded
- **Created:** <YYYY-MM-DD>
- **Discussion:** <link to the issue/PR/thread where this is discussed>
```

## Required Sections

### Summary

One paragraph, written so someone who has never seen the problem can
understand what is being proposed and why, without reading further.

### Motivation

What problem does this solve? What happens if we do nothing? Link to the
issue(s) or incident(s) that motivate this RFC where they exist.

### Detailed Design

The actual proposal, in enough detail that someone else could implement it
from this section alone: the approach, the key interfaces or schema changes,
and how it fits into the existing architecture. Include diagrams or examples
where they clarify more than prose.

### Alternatives Considered

At least one alternative approach, and why it was not chosen. An RFC with no
alternatives considered is a strong signal the design has not been stress
tested yet.

### Drawbacks

Honest costs of the proposal: added complexity, migration effort, new
dependencies, or anything a reviewer would otherwise have to find themselves.

### Impact

- **Breaking changes** — does this change an existing API, schema, or
  contract? Who/what is affected?
- **Migration path** — if breaking, how do existing consumers/data migrate?
- **Security & data** — any new data collected, stored, or shared; see
  `Governance/domains/THIRD_PARTY_INTEGRATION.md` if a new external
  dependency is involved.
- **Rollout** — can this ship incrementally, or does it require a
  coordinated cutover?

### Open Questions

Anything unresolved at the time the RFC is opened. It is expected an RFC
still has open questions when review starts — resolving them is part of
what review is for.

## Review Checklist

A maintainer moving an RFC out of Draft confirms:

- [ ] The metadata header is complete and the status is accurate.
- [ ] Motivation links to a real problem (an issue, an incident, or a
      concrete pain point), not a hypothetical one.
- [ ] Detailed Design is specific enough to implement from.
- [ ] At least one alternative is documented.
- [ ] Drawbacks are stated honestly, not omitted.
- [ ] Impact — breaking changes, migration, security/data, rollout — is
      addressed, even if the answer is "none."
- [ ] Open Questions are either resolved or explicitly deferred with an
      owner and a plan to resolve them.

## Review

This template is reviewed whenever the RFC process itself changes materially.
Changes are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.
