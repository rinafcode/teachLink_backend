# Good First Issue Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after contributor onboarding feedback

This policy defines when the `good first issue` label may be applied, who may
apply it, and what mentorship the project owes first-time contributors. It
lives entirely inside the `Governance/` folder and does not change application
code.

Related documents:

- Label catalog: [`LABEL_TAXONOMY.md`](../LABEL_TAXONOMY.md)
- Review expectations: [`REVIEW_SLA.md`](REVIEW_SLA.md)
- Communication norms: [`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md)

## 1. Purpose of the Label

`good first issue` signals that a task is suitable for someone new to this
repository. It is a mentorship commitment, not a backlog priority flag. Issues
with this label should be completable without deep historical context of the
codebase.

## 2. Criteria for Applying `good first issue`

An issue may receive the label only when **all** of the following hold:

1. **Scope is small** — typically one focused change (roughly a single PR that
   a new contributor can finish in a few focused hours, not multi-day design).
2. **Clear acceptance criteria** — the issue body states what “done” means in
   concrete, testable terms.
3. **Pointers provided** — the issue links or names relevant files, modules, or
   docs so the contributor is not left hunting.
4. **Low risk** — does not require production secret access, irreversible data
   migrations, or emergency hotfixes.
5. **Self-contained** — is not blocked on unmerged work or private design
   decisions.
6. **Mentorship available** — at least one maintainer or designated mentor is
   willing to answer questions within the review SLA for the duration the label
   remains applied.

Do **not** apply the label when the issue is mainly “help wanted” for an
experienced contributor, or when the description is still at the idea stage.

## 3. Who Applies the Label

| Actor | May apply? | Notes |
|-------|------------|--------|
| Maintainers | Yes | Primary owners of triage |
| Triagers with write access | Yes | After confirming criteria above |
| Automated bots | Only if configured by maintainers | Must still satisfy human-reviewable criteria |
| External contributors | No | May **request** the label in a comment |

Removing the label is appropriate when scope grows, blockers appear, or no
mentor can support the issue. Prefer explaining the removal in a short comment.

## 4. Mentorship Expectation

When `good first issue` is applied, the project commits to:

1. **Responsive answers** — questions from the assignee or first poster receive
   a substantive reply within the contributor-facing review SLA (see
   `REVIEW_SLA.md`), or a clear “we need more time” note.
2. **Constructive first review** — the first PR review focuses on guidance, not
   only rejection; request changes with specific next steps.
3. **No silent takeover** — maintainers should not silently implement the fix
   while a newcomer is actively working the issue; coordinate in comments if
   timelines slip.
4. **Credit** — merged work from first-time contributors is attributed normally
   (commit author, release notes as applicable).

Mentorship does not require pair-programming; async guidance is the default.

## 5. Issue Template Checklist (Recommended)

Before labeling, confirm the issue includes:

- [ ] Problem statement in plain language  
- [ ] Acceptance criteria (bullet list)  
- [ ] Suggested starting files or search terms  
- [ ] How to test locally (command or suite name)  
- [ ] Links to related docs or prior PRs if useful  

## 6. Change History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial good-first-issue policy (issue #1610) |
