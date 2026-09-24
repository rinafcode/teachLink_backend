# Contributor Offboarding

Version: 1.0
Last updated: 2026-09-24

## Purpose

This document defines the TeachLink Backend contributor offboarding process. It ensures that access is revoked in a timely, auditable way, knowledge is handed over, and running systems remain secure and operable after a contributor leaves or loses access.

## Scope

- Applies to employees, contractors, vendors, and maintainers with access to TeachLink Backend repositories, infrastructure, and services.
- Covers code repositories, CI/CD, cloud infrastructure, databases, monitoring, secrets, and documentation handover.
- This document is a governance procedure; technical steps referenced here must map to existing runbooks and owner-specific checklists.

## Roles & Responsibilities

- Manager / Team Lead: initiates offboarding, coordinates knowledge transfer, assigns owners for follow-up tasks.
- IT / Platform: revokes SSO, VPN, and corporate accounts; disables device access where applicable.
- Security / Ops: rotates credentials and service account keys that the departing contributor managed; verifies secrets haven't leaked.
- Repo Owners / Maintainers: remove repository access, reassign outstanding PRs, and update ownership of scheduled jobs.
- HR / Legal: complete any required exit interviews, obtain required acknowledgements, and retain records per retention policy.

## Offboarding Checklist

The following checklist should be used as a baseline. Owners may add project-specific steps in related runbooks.

1. Notify stakeholders
   - Manager initiates offboarding and informs team, Security, IT, and Platform owners.

2. Freeze or reassign in-flight work
   - Reassign open issues and PRs to maintainers or an assigned owner.
   - Document the current state of work in the issue tracker.

3. Knowledge handover
   - Request the departing contributor to record critical knowledge (runbooks, architecture notes, credentials location, scheduled tasks).
   - Arrange a handover meeting and record meeting notes in the team wiki.

4. Revoke access
   - Remove repository and organization-level access (GitHub org, teams, and third-party integrations).
   - Disable CI/CD user tokens, and remove agent keys if user-managed.
   - Revoke access to cloud providers (AWS, GCP, Azure), monitoring dashboards, and logging tools.
   - Remove access to databases (Postgres), Redis, and other managed data stores.
   - Disable VPN and SSO accounts; collect and inventory any company devices.

5. Rotate credentials
   - Rotate service account keys and tokens the contributor had access to.
   - Rotate any shared passwords or secrets stored in vaults that included the contributor.

6. Audit and verification
   - Confirm access removal via audit logs (identity provider, GitHub, cloud IAM).
   - Verify that scheduled jobs and deploy pipelines still run under valid service accounts.
   - Ensure no orphaned secrets remain in code, commits, or repos (scan with existing secret-scanning tooling).

7. Update documentation and ownership
   - Assign new owners for runbooks, on-call rotations, and recurring tasks.
   - Update CODEOWNERS and team-maintained documentation as needed.

8. Legal / compliance steps
   - Complete exit interview and required compliance signoffs.
   - Archive any required artifacts (email threads, approvals) into the Governance records.

## Timeline

- Immediate (Day 0): Notify stakeholders; begin access revocation.
- Short-term (Day 1–3): Complete access revocation and credential rotation; perform verification.
- Follow-up (Day 7–30): Address any lingering ownership items, finalize documentation updates, and perform an audit verification.

## Emergency Access

If emergency access to a departed contributor's account is required, follow the Emergency Access procedure in the platform runbook and obtain required approvals from Security and Engineering leadership. Record all actions and approvals.

## Audit & Record Keeping

- Record the offboarding event, completed checklist, and verification evidence in the Governance/processes directory (or designated Records area) for auditability.
- Retain records according to the organization's retention policy.

## Exceptions

Any deviations from this procedure must be approved in writing by Security and the Engineering Manager, and documented with the reasons for the exception.

## Related documents

- Governance/processes/ — other governance procedures and record templates
- infra/ and docs/ — refer to platform runbooks and technical runbooks for the concrete revocation steps

## Change log

- 1.0 (2026-09-24): Initial version — adds offboarding procedure to Governance/processes.

## Contact

For questions about this procedure, contact the Security team or the Engineering Manager for the relevant module.
