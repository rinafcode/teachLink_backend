# Release Checklist

Use this checklist for each planned production release. Record the completed
checklist and approvals in the release pull request, tracking issue, or
deployment record so the release has an auditable trail. Emergency hotfixes
follow [`../processes/HOTFIX.md`](../processes/HOTFIX.md); complete the
applicable checks here as well.

Do not proceed while a required check is failing or a required approval is
missing. Exceptions are limited to those explicitly allowed by the linked
governance policies.

## Release Record

- **Version/tag:**
- **Release owner:**
- **Target date:**
- **Release pull request:**
- **Deployment record:**

## Pre-Release

- [ ] Confirm the release scope and target version; verify the release notes
      describe user- or operator-visible changes and known limitations.
- [ ] Confirm all intended changes are merged through the protected branch
      process. No direct pushes or skipped required checks.
- [ ] Confirm all required CI gates pass on the release commit: install, lint,
      format, type check, build, migration checks, unit tests, and end-to-end
      tests.
- [ ] Verify the release candidate in staging and complete change-specific
      smoke tests. Record results and any unresolved issues.
- [ ] If there is a database migration, confirm it has been applied and tested
      in staging. Obtain the separate production-apply approval required by
      [`../domains/DB_MIGRATION_GOVERNANCE.md`](../domains/DB_MIGRATION_GOVERNANCE.md)
      before running it in production.
- [ ] If configuration changes are included, satisfy
      [`../domains/CONFIG_CHANGE.md`](../domains/CONFIG_CHANGE.md).
- [ ] Generate and verify the SBOM for the exact release artifact; confirm it
      is ready to publish as required by
      [`../domains/SBOM_POLICY.md`](../domains/SBOM_POLICY.md).
- [ ] Document the specific rollback or recovery procedure, including any
      migration considerations, in the release record.
- [ ] Confirm monitoring and alerting are available for the affected services
      and workflows.

## Sign-Off Gates

Record approver names and approval links in the release pull request or
deployment record before production promotion.

- [ ] CI and all required branch-protection checks pass; review conversations
      are resolved.
- [ ] At least two maintainers approve the production promotion, including the
      code owner for the affected area.
- [ ] Obtain any additional required review: security-area review for
      authentication, authorization, encryption, or Confidential/Restricted
      data changes; payments-area review for payment processing or financial
      data changes; and an additional maintainer for destructive or
      irreversible migration steps.
- [ ] For a production database migration, record the required production
      apply approval separately from the pull request approval.
- [ ] Release owner confirms every applicable pre-release check is complete
      and authorizes the production deployment.

The approvals above follow
[`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md). A release with a
failed gate or missing approval is blocked.

## Release and Post-Release

- [ ] Promote the approved revision using the production deployment procedure;
      record the deployed commit and deployment time.
- [ ] Publish the release notes, version/tag, and release artifacts, including
      the matching SBOM.
- [ ] Verify deployment health and the key affected workflows with production
      smoke checks.
- [ ] Monitor service health, error rates, and relevant alerts for regressions;
      record the observation window and outcome.
- [ ] If verification fails or a regression occurs, follow the recorded
      rollback or recovery plan and the applicable rollback policy.
- [ ] Update the release record with verification results, incidents, and any
      rollback performed; assign owners and due dates to follow-up actions.
- [ ] Confirm any hotfix is back-merged to `develop` and complete required
      incident follow-up when applicable.

## Regression Tests Where Applicable

This checklist is a governance document and introduces no runtime behavior, so
it requires no dedicated regression test. Release candidates must pass the
existing CI and staging checks above. Changes to release tooling or deployment
behavior should include tests for that behavior in the same change.

## Review

Review this checklist when the release process, branch-protection gates, or
related governance policies change materially. Changes follow
[`../README.md`](../README.md) and remain within the `Governance/` folder.