# Community Health Report Policy

This document defines the community health reporting policy for the TeachLink Backend. It is the versioned reference for which health metrics are tracked, how often reports are produced, and where they are published.

## Purpose

The community health report provides maintainers and contributors with a regular, transparent view of the project's community and contribution health. It exists to make governance decisions data-informed and to give contributors a shared, versioned understanding of project health.

## Health Metrics

The following metrics are included in every community health report. Each metric is reported with its value for the reporting period and its trend compared to the previous period.

### Contribution Metrics

- **New contributors**: Number of first-time contributors whose first pull request was merged during the period.
- **Active contributors**: Number of distinct contributors who opened at least one pull request or issue during the period.
- **Returning contributors**: Number of contributors who contributed in both the current and the previous period.
- **Contributor retention rate**: Percentage of contributors from the previous period who contributed again in the current period.

### Pull Request Metrics

- **Pull requests opened**: Number of pull requests opened during the period.
- **Pull requests merged**: Number of pull requests merged during the period.
- **Merge rate**: Percentage of pull requests opened during the period that were merged.
- **Median time to first review**: Median duration between a pull request being opened and receiving its first review.
- **Median time to merge**: Median duration between a pull request being opened and being merged.
- **Stale pull requests**: Number of open pull requests with no update for more than 30 days at the end of the period.

### Issue Metrics

- **Issues opened**: Number of issues opened during the period.
- **Issues closed**: Number of issues closed during the period.
- **Median time to first response**: Median duration between an issue being opened and receiving its first maintainer response.
- **Stale issues**: Number of open issues with no update for more than 90 days at the end of the period.

### Review Metrics

- **Reviews completed**: Number of pull request reviews submitted during the period.
- **Review coverage**: Percentage of merged pull requests that received at least one review before merge.
- **Reviewer distribution**: Number of distinct reviewers and the share of reviews performed by the top contributor to highlight review burden concentration.

### Code Health Metrics

- **Test suite sttatus**: Pass/fail status of the project's test suite at the end of the period.
- **Coverage trend**: Change in test coverage percentage over the period, when coverage reporting is available.
- **Open bugs**: Number of open issues labeled as bugs at the end of the period.

### Community Metrics

- **Discussion activity**: Number of issue and pull request comments from non-maintainers during the period.
- **Contribution guideline compliance**: Percentage of merged pull requests that followed the project's contribution guidelines (for example, included tests and documentation where required).

## Cadence

Community health reports are produced on a monthly cadence.

- Reports cover the calendar month and are published within the first five business days of the following month.
- A consolidated quarterly summary report is published within ten business days of the end of each calendar quarter, aggregating the three monthly reports in that quarter.
- If a monthly report cannot be published on schedule, the delay and the reason are recorded in the next published report.

## Publication Location

Community health reports are published in the following locations:

- **Primary location**: `Governance/reporting/reports/`${YYYY-MM of the reporting period}.md` in this repository. Each report is a versioned, committed file so that its history is traceable through Git.
- **Secondary location**: A summary of the latest report is linked from the Governance readme or the project's public community channels.
- **Quarterly summaries**: Published as `Governance/reporting/reports/$[YYYY-Q] of the reporting quarter ].quarterly.md` in the same directory.

Reports are immutable once published. Corrections are made by publishing an addendum rather than editing a published report.

## Report Structure

Each community health report includes the following sections:

1. **Reporting period** and publication date.
2. **Summary** of key findings and any areas of concern.
3. **Metrics** organized by the categories above, each with value and trend.
4. **Highlights** of notable contributions and community efforts.
5. **Actions** taken or planned in response to the reported metrics.

## Responsibility

- The maintainers are responsible for compiling and publishing the report on schedule.
- Contributors are encouraged to raise any inaccuracies or concerns by opening an issue in the repository.
- Metric definitions in this document are the authoritative reference; changes to them are made through the standard pull request process.

## Change Log

| Date       | Change                                       |
|------------|--------------------------------------------------------|
| Initial    | Added community health report policy to close governance gap.    |
