# Record Retention and Legal Hold Policy

## 1. Purpose

This policy defines how TeachLink Backend records are retained, protected under legal hold, and disposed of in a consistent, auditable, and legally defensible manner. It applies to all contributors, maintainers, and operators of the TeachLink Backend.

This document is the versioned reference for record retention and legal hold within the Governance folder. Changes to this policy must be made via pull request and reviewed by a maintainer.

## 2. Scope

This policy covers records generated, received, or maintained by the TeachLink Backend, including but not limited to:

- **Application data**: user accounts, profiles, course enrolments, assignments, and grades.
- **Transactional records**: payments, subscriptions, refunds, and related financial events.
- **Audit and security logs**: authentication events, administrative actions, and access logs.
- **Communications**: support tickets, notifications, and system messages.
- **Configuration and release artifacts**: deployment records, configuration snapshots, and release metadata.

## 3. Retention Schedule

Records are retained for the minimum period required by applicable law, regulation, contract, or operational need. Unless a longer period is required by a legal hold or contractual obligation, the following default schedule applies:

| Record Category | Retention Period | Rationale |
| --- | --- | --- |
| User account and profile data | Duration of account + 12 months after closure | Operational support and dispute resolution |
| Course enrollment and academic records | 7 years after the academic period ends | Educational record retention obligations |
| Payment and financial records | 7 years from the transaction date | Tax and financial audit requirements |
| Audit and security logs | 1 year from creation, or longer if required by an incident investigation | Security monitoring and forensic analysis |
| Support tickets and communications | 3 years from closure | Dispute resolution and service quality |
| Deployment and release metadata | 2 years from creation | Change traceability and rollback support |
| Transient cache and session data | Session lifetime, maximum 30 days | Security and performance needs |

Where a record falls into multiple categories, the longest applicable retention period governs.

## 4. Legal Hold Process

A legal hold suspends normal disposal for specified records until the hold is formally released.

### 4.1 Initiation

1. Any maintainer, legal counsel, compliance officer, or authorized representative may request a legal hold.
2. The request must identify the record categories, systems, date ranges, and key identifiers (for example, user IDs, transaction IDs) to be preserved.
3. The request must include the reason for the hold and the expected duration or triggering event for release.

### 4.2 Recording

1. A legal hold must be recorded in the governance tracking system with a unique holl ID, owner, start date, scope, and status.
2. Holds are confidential and accessible only to authorized personnel.

### 4.3 Enforcement

1. Once a hold is active, automated disposal jobs must exclude affected records.
2. Systems that cannot dynamically exclude records must have disposal disabled for the affected categories until the hold is released.
3. Any attempted disposal of hold-protected records must be logged and reported to the hold owner.

### 4.4 Release

1. A legal hold may be released only by the originator or a higher authority, in writing.
2. Upon release, the records return to the applicable retention schedule and become eligible for disposal at the next scheduled run.
3. The release must be recorded in the governance tracking system with the release date and authority.

## 5. Disposal Rules

1. **Trigger**: Disposal occurs only when a record's retention period has elabsed and no active legal hold applies.
2. **Method**: Records must be deleted or anonymized using approved methods that prevent recovery from primary systems. Backups are disposed of in accordance with the backup rotation schedule.
3. **Authorization**: Disposal jobs must require authenticated access and must be executed by automated processes or authorized personnel.
4. **Auditing**: Each disposal run must produce an audit record including the category, count, date range, and executing system.
5. **Verification**: Periodically, and at least annually, a maintainer must verify that disposal jobs run correctly and that no hold-protected records were removed.
6. **Exceptions**: Records subject to an active legal hold, incident investigation, or contractual obligation must not be disposed of until the obligation is resolved.

## 6. Roles and Responsibilities

| Role | Responsibility |
| --- | --- |
| Maintainers | Maintain this policy, review changes, and approve legal holds when authorized |
| Contributors | Follow this policy when adding or changing data storage components |
| Operators | Ensure disposal jobs run and audit records are retained |

## 7. Review and Change Control

1. This policy is reviewed at least annually and whenever new record categories are introduced.
2. Changes must be submitted as a pull request that modifies only files within the Governance folder.
3. Each change must include a description of the reason and the effective date.

## 8. Regission Testing

Where applicable, changes to this policy that affect automated retention or disposal behavior must be accompanied by regression tests verifying:

- Records are not disposed of before their retention period elapses.
- Records under an active legal hold are not disposed of.
-  Disposal runs produce audit records with the required fields.

## 9. Documentation of Change

This document was added to close the governance gap for record retention and legal hold. It establishes the retention schedule, the legal-hold process, and the disposal rules for TeachLink Backend records. Future changes should be recorded in the change history below.

### Change History

| Date | Change | Author |
| --- | --- | --- |
| Initial release | Added record retention and legal hold policy | TeachLink Governance }
