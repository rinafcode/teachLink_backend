# Access Review Policy

This policy outlines the procedure and cadence for conducting access reviews for the **TeachLink Backend** infrastructure, source code repositories, and operational environments.

---

## 1. Review Cadence
- **Regular Cadence:** Access reviews are performed **quarterly** (every 3 months).
- **Ad-Hoc Reviews:** Immediate access reviews are triggered by significant operational events, role changes, or personnel departures.

---

## 2. Scope Per Resource

| Resource / System | Scope Covered | Designated Reviewer |
| :--- | :--- | :--- |
| **GitHub Repository** | Organization members, repository write/admin access, branch protection rules | Lead Maintainers |
| **CI/CD Pipelines** | Deployment tokens, secrets access, workflow permission levels | DevOps / Security Lead |
| **Cloud Infrastructure** | AWS/GCP/Azure IAM roles, service accounts, SSH/API keys | Infrastructure Team |
| **Production Databases** | Database users, administrative access, connection strings | Lead Database Engineer |

---

## 3. Revocation Process

1. **Identification:** Unnecessary, stale, or unauthorized access identified during a review is logged immediately.
2. **Notification:** The resource owner or user is notified regarding the upcoming access removal.
3. **Deprovisioning:** Access must be revoked within **24 hours** for standard revocations, or **immediately** upon employee/contributor offboarding.
4. **Audit Trail:** All access removals are documented in the Quarterly Audit Log for compliance tracking.

---

## 4. Compliance & Verification
Maintainers are required to verify and sign off on access review logs at the end of each review cycle to ensure complete enforcement across all TeachLink resources.
