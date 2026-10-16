# Metrics Dashboard Governance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/reporting/METRICS_DASHBOARD_GOVERNANCE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All metrics dashboards for inafcode/teachLink_backend |

## 1. Metrics shown

The metrics dashboard must display:

- **CI/CD metrics**: Build pass rate, average build time, deployment frequency.
- **Code metrics**: Open issues, open PRs, code review turnaround time.
- **Contributor metrics**: Active contributors, new contributors, contribution frequency.
- **Security metrics**: Vulnerability count, mean time to remediation.

## 2. Data sources

| Metric category | Data source |
| --- | --- |
| CI/CD | GitHub Actions |
| Code | GitHub Issues and Pull Requests |
| Contributors | GitHub contributor statistics |
| Security | GitHub Security Advisories |

## 3. Ownership

The Maintainer Team owns the dashboard. A named maintainer is responsible for
ensuring data accuracy and dashboard availability. Dashboard access is limited
to maintainers and project stakeholders.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |