# Community Survey Policy

| Field | Value |
| --- | --- |
| Document | `Governance/community/SURVEY_POLICY.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Any survey, poll, or feedback form run by or for the project |
| Related | [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md) · [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md) · [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) |

This policy describes how surveys are run, how the privacy of responses is
protected, and how results are shared. It applies to contributor surveys,
community polls, and user-feedback forms run in the project's name.

## 1. How surveys are run

1. **State a purpose and an owner.** Every survey names the decision it informs,
   the maintainer who owns it, and the closing date. A survey with no decision
   attached is a sign the survey should not run.
2. **Open an issue first.** The proposal describes the purpose, the audience, the
   questions, the tool, and how results feed back. This lets the community
   object to a leading or unnecessary question before anyone is asked.
3. **Design it fairly.** Ask neutral, answerable questions; avoid leading
   wording; offer "prefer not to say" and "other" where an answer may not fit;
   keep it as short as the purpose allows.
4. **Say how long it takes** and how the results will be used. No dark patterns
   and no requirement to answer every question.
5. **Run it in the open.** Identify the survey as a project survey, and use a
   tool the project controls or a processor recorded under
   [`compliance/DPA_TEMPLATE.md`](../compliance/DPA_TEMPLATE.md).

## 2. Privacy of responses

- **Collect the minimum.** Ask only for what the purpose needs; do not collect
  identifiers (name, email, employer) unless required, and say why.
- **Anonymous by default.** Prefer anonymous responses. If a response must be
  attributable, tell respondents before they start and give the reason.
- **Honest about anonymity.** Do not describe a survey as anonymous if free-text
  answers, timestamps, or account linkage could identify a respondent.
- **Secure handling.** Responses are stored in a project-controlled, access-
  limited location, classified per
  [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md), and are
  not shared with a sponsor or third party without consent.
- **Consent and deletion.** Participation is opt-in and the consent and
  withdrawal rules in [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md)
  and [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md) apply.
- **Sensitive topics.** A survey that would surface personal or sensitive
  information is reviewed before launch, and never published as raw data.

## 3. How results are shared

- **Share a summary, not raw data.** Publish aggregate results and the key
  findings within a reasonable time of closing, linked from the survey issue.
- **Do not expose individuals.** Suppress or aggregate any cell small enough to
  identify a respondent; present free-text comments in a way that cannot be
  traced back without the author's agreement.
- **Explain the decision.** Say what the project will do with the findings, or
  explicitly that no change is planned. A survey whose results are never
  discussed discourages future participation.
- **Keep the data only as long as needed.** Raw responses are retained per the
  project's retention rules and then deleted; the published summary persists as
  the record.
- **Credit the work.** Acknowledge those who designed or analysed the survey, per
  [`RECOGNITION.md`](../RECOGNITION.md).

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
