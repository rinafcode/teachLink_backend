# Community Health Report Policy

This document defines the community health reporting policy for the TeachLink Backend. It is the versioned reference for which health metrics are tracked, how often reports are produced, and where they are published.

## Purpose

The community health report provides maintainers and contributors with a regular, transparent view of the project's community and contribution health. It exists to make governance decisions data-informed and to highlight areas that need attention.

## Health Metrics

The following metrics are tracked in each report. Each metric includes a definition and the data source used to calculate it.

| Metric | Definition | Data Source |
| --- | --- | --- |
| Contributor activity | Number of unique contributors who opened pull requests or issues during the reporting period. | GitHub repository activity logs. |
| Review response time | Median time from pull request opening to first maintainer review. | GitHub pull request timeline API. |
| Merge throughput | Perod of opened pull requests that were merged within the reporting period. | GitHub pull request status records. |
| Issue response time | Median time from issue opening to first maintainer response. | GitHub issue timeline API. |
| Stale issues and pull requests | Count of open issues and pull requests with no update for more than 30 days. | GitHub issue and pull request metadata. |
| Build and test health | Pass rate of the default branch checks and test suite runs during the reporting period. | CI pipeline results. |
| Documentation coverage | Percentage of governance areas with an up-to-date policy document in the `Governance/` folder. | Manual audit of the `Governance/` folder. |

## Reporting Cadence

Community health reports are produced on a monthly cadence. Each report covers the previous calendar month and is published within the first seven calendar days of the following month.

Additional adhoc reports may be produced when a major release is shipped or when a maintainer requests one.

## Publication Location

Reports are published in the `Governance/reporting/` directory of this repository. Each report is stored as a dated Markdown file using the format `COMMUNITY_HEALTH_REPORT_<YYYY>-\<MM>.md`, for example `COMMUNITY_HEALTH_REPORT_2025-01.md`. This policy document itself is maintained at `Governance/reporting/COMMUNITY_HEALTH_REPORT.md`.

Reports are announced in the project's community channels with a link to the committed file.

## Responsibilities

- The maintainers are responsible for compiling and publishing the report on schedule.
- Contributors are encouraged to review reports and raise concerns through the standard issue process.
- Any changes to the metrics or cadence must be made in this document and noted in the corresponding report.

## Change Log

- 2025-01: Initial community health report policy added to close the governance gap in `Governance/reporting/`.
