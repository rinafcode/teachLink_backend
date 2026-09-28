# Hotfix Process

This process governs urgent production fixes for TeachLink Backend. A hotfix
protects users or restores a critical production service; it is not a shortcut
for ordinary feature work or the repository's review and branch-protection
requirements.

## When A Hotfix Is Warranted

Use the hotfix path when waiting for the normal `develop` release cycle would
materially increase harm or prolong a serious production failure, including:

- A critical or high-severity outage or degradation of a core workflow.
- Active exploitation, a serious security exposure, or unauthorized access.
- Ongoing loss, corruption, or disclosure of user or financial data.
- A production defect with severe, immediate customer or financial impact and
  no acceptable workaround.

The change must be the smallest safe correction that addresses the immediate
impact. If a workaround or normal release can adequately contain the issue,
use the normal process instead. For security vulnerabilities, do not open a
public issue; contact maintainers through the private security-reporting path
in `CONTRIBUTING.md`.

## Expedited Review And Release

1. **Coordinate response.** Notify the maintainers and incident lead through
   the appropriate incident channel. Record the impact, severity, affected
   services, mitigation options, and a rollback or recovery plan in the
   incident record or private security report.
2. **Prepare the fix.** Branch from the latest `main` using
   `hotfix/issue-<N>-<slug>`. Keep the diff narrowly scoped, add or update
   regression coverage where applicable, and verify the fix locally.
3. **Open a pull request to `main`.** Mark it as a hotfix and summarize the
   impact, root-cause understanding, validation performed, deployment risk,
   and rollback plan. Request maintainer and relevant code-owner review
   directly, and state the response urgency. Reviewers should prioritize it
   ahead of routine work and review only the risk and correctness needed to
   make a safe decision.
4. **Meet required merge gates.** Hotfixes still require two maintainer
   approvals, including one code-owner approval, passing required CI, resolved
   review conversations, and all other `main` branch-protection checks. No
   direct pushes, self-merges, or skipped required checks are permitted.
5. **Deploy and verify.** A maintainer merges using the required merge method.
   Release the fix through the production deployment procedure, confirm the
   affected workflow is restored, and monitor the service for recurrence or
   unintended effects. If the fix worsens the incident, use the prepared
   rollback or recovery plan and update the incident record.
6. **Back-merge immediately.** Bring the merged hotfix into `develop` as soon
   as possible using a pull request and the branch-protection-compliant merge
   process. Confirm the fix is present in `develop` before related work or
   releases proceed.

Urgency shortens the time to review; it does not remove independent review,
required checks, or the production release safeguards.

## Post-Hotfix Follow-Up

- Update the linked issue or incident record with the pull request, deployed
  revision, deployment and verification results, and any rollback performed.
- Complete a blameless postmortem when required by
  `Governance/domains/POSTMORTEM_POLICY.md`, including for emergency production
  changes. Record the timeline, impact, contributing conditions, and lessons
  learned.
- Create and track corrective actions for underlying causes and any deferred
  hardening, monitoring, test, or documentation work. Assign an owner to each
  action and verify completion through the incident follow-up process.
- Add regression tests or safeguards where appropriate, and confirm the
  corresponding changes are included in `develop`.

## Ownership And Review

Maintainers coordinate the expedited review and release; the incident lead
coordinates operational updates and follow-up. This process is maintained
through the normal governance pull-request process and reviewed when the
repository's incident response, release, or branch-protection rules change.
