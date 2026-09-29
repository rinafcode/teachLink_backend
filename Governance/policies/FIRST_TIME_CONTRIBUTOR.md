# First-Time Contributor Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-29
- **Review cadence:** Every 6 months, or after a material change to the contribution process

This policy defines the support a first-time contributor can expect when
making an initial contribution to TeachLink Backend. It makes the project's
welcome path explicit without changing the technical quality gates or giving
any contributor a bypass around review.

## 1. Scope

This policy applies to a person who has not yet had a pull request merged in
TeachLink Backend. It covers documentation, tests, tooling, and code changes.
Security-sensitive work, production credentials, and changes governed by a
formal vote are outside the first-time contributor path and must follow their
specialist process.

## 2. Reserved Good-First-Issue Pool

Maintainers reserve issues labelled `good first issue` for new contributors.
The pool should contain small, independently reviewable tasks such as:

- documentation corrections or examples;
- focused tests for an existing behavior;
- isolated validation, typing, or error-message improvements; and
- small maintenance changes with a clear acceptance test.

Maintainers should keep the pool discoverable from the repository issue list,
provide reproduction or acceptance criteria, and avoid assigning the same
issue to multiple people. An issue may be removed from the pool when it is
claimed, becomes stale, requires privileged access, or grows beyond a small
first contribution; the reason should be recorded in the issue.

## 3. Support Provided

For a first-time contributor who asks for help, a maintainer or designated
mentor will:

1. confirm the scope and point to the relevant code, documentation, or test
   command;
2. answer reasonable setup and design questions in the issue or pull request;
3. identify the smallest useful next step when the task is too broad; and
4. give actionable review feedback, including the failing command or required
   behavior, rather than silently rewriting the contribution.

The project aims to acknowledge an initial question within three business
days. This is a service target, not a promise of immediate implementation or
approval.

## 4. Mentorship Expectations

Mentorship is collaborative and time-bounded:

- The contributor remains responsible for reading `CONTRIBUTING.md`, choosing
  a reserved issue, keeping changes focused, and running the documented checks.
- The mentor explains project conventions and review feedback but does not
  request passwords, private keys, tokens, or access to personal accounts.
- Discussion stays in public project channels whenever possible. Private
  communication is used only for sensitive security reports and follows the
  security policy.
- A mentor may hand the task back to the maintainer team when it needs domain
  authority, privileged access, or more time than a first contribution should
  require.
- Contributors may ask for a different mentor or continue without one;
  requesting help must never affect review priority or eligibility.

## 5. Review and Acceptance

First-time contributions use the same pull-request requirements as every other
contribution: a clear description, focused scope, appropriate tests, and the
quality gates in `CONTRIBUTING.md`. A mentor may perform an early review, but
only an authorised maintainer can approve and merge the pull request.

Feedback should distinguish blocking requirements from optional suggestions.
Once the required changes are addressed and the checks pass, the contribution
is eligible for normal maintainer review and merge.

## 6. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-29 | Initial first-time contributor support, issue-pool, and mentorship policy. |
