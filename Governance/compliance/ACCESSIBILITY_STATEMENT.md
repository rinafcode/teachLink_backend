# Accessibility Statement Governance

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/ACCESSIBILITY_STATEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months, and after any major UI change |
| Applies to | The public accessibility statement for the platform's user-facing surfaces |
| Related | [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) · [`community/INCLUSIVE_LANGUAGE.md`](../community/INCLUSIVE_LANGUAGE.md) |

This document defines the **stated conformance level**, the **feedback channel**,
and the **review cadence** for the project's accessibility statement. It governs
the statement's process; the published statement itself may live outside this
repository, but it must follow the rules below so that what we claim matches what
we do.

## 1. Stated conformance level

- Our target is **WCAG 2.2 Level AA** for user-facing web surfaces of the
  platform. This is the level the published statement must claim.
- **Claims must be evidence-based.** The statement may only claim a conformance
  level that a documented evaluation supports. Where we are not yet conformant,
  the statement must say so plainly, list the known gaps, and give the
  remediation plan rather than overstating conformance.
- **Partial conformance is stated as partial.** If some surfaces meet AA and
  others do not, name the exceptions. A blanket "fully conformant" claim is not
  permitted while known gaps exist.
- **Third-party content** that the project does not control is called out
  separately, with the effort made to influence it.

## 2. What the statement must include

At minimum: the conformance target and current status; the date of the most recent
evaluation and who performed it; known limitations and the plan to fix them; the
feedback channel in §3; and the review cadence in §4. It should be reachable from
the product's footer or help pages, not buried in a repository.

## 3. Feedback channel

- Users can report an accessibility barrier through a **named, monitored
  channel** — a dedicated email address and the issue tracker — published in the
  statement itself.
- A report is **acknowledged within 3 business days** and triaged under
  [`processes/TRIAGE.md`](../processes/TRIAGE.md). Reports that describe a
  blocker for assistive-technology users are prioritised.
- Where a barrier has no quick fix, the report is tracked as an issue labelled
  for accessibility, with a target and an owner, and the reporter is told where
  to follow it.
- The feedback channel is not used for security reports; those follow
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md).
- The channel is open to everyone and the response is given respectfully, as
  required by [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md).

## 4. Review cadence

- The statement is **reviewed at least every 12 months**, and after any major
  change to a user-facing surface, so it does not drift from reality.
- Each review checks the conformance claim against a fresh evaluation, confirms
  the feedback channel still works, and updates the "last reviewed" date.
- The review is recorded in this document's change log with the reviewer and the
  outcome. If a gap is found, an issue is opened rather than only editing the
  statement.
- If a review is not performed within the cadence, the statement is amended to
  say the last evaluation is older than one year.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
