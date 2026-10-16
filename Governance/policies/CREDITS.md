# Credits and Acknowledgements Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-29
- **Review cadence:** Annually, and after a material change to contribution or attribution practices

This policy defines how TeachLink Backend records and acknowledges project
contributions. It applies to code and non-code work, including documentation,
testing, design, review, triage, translations, operations, security response,
and community support. Its purpose is to make credit accurate, consistent,
evidence-based, and respectful of each contributor's preferred attribution.

Credit recognises work; it does not grant project permissions, imply employment
or endorsement, transfer intellectual-property rights, or replace the legal
notices required by the project's
[Attribution Policy](ATTRIBUTION.md) and
[Third-Party Licences Policy](THIRD_PARTY_LICENSES.md).

## 1. Principles

- **Recognise substantive work.** Credit contributions that were accepted,
  merged, released, or otherwise adopted by the project. This includes
  non-code contributions when their project value and acceptance can be
  verified.
- **Use evidence.** Every recorded acknowledgement must link to a public,
  durable project record where practical, such as a pull request, commit,
  issue, discussion, release, or incident record. Do not publish confidential
  or security-sensitive evidence.
- **Attribute by choice.** Ask contributors how they want to be identified.
  Use their public handle or chosen display name; do not publish a legal name,
  contact information, or other personal data without explicit consent.
  Contributors may request anonymous credit or no public acknowledgement.
- **Be inclusive and non-competitive.** Credit contributions of different
  kinds without ranking people, measuring worth by volume, or treating an
  acknowledgement as a condition of participation.
- **Keep the record accurate.** Correct factual errors promptly and respect a
  contributor's request to change or remove their personal attribution.

## 2. Eligibility and Recording

Maintainers may record an acknowledgement when the contribution has been
accepted by the project and can be described accurately. A contribution does
not need to be code or to have been made through a pull request. Examples
include accepted bug reports, useful reviews, documentation, tests, design,
release work, incident response, and sustained contributor support.

Credit is recorded in the project's credits register, maintained under
`Governance/`. When a register is first created, it must follow the structure
in §3. The policy itself is not a credits register. A maintainer verifies the
contribution and attribution preference before adding an entry. For joint
work, credit each contributor whose contribution can be identified; do not
infer authorship from a commit author field alone when the contributor has
stated a different preference.

For embargoed security work or other sensitive contributions, defer public
credit until disclosure is safe and the contributor agrees to publication.
Where public evidence cannot be shared, record only a suitably general
description with the contributor's consent, or omit the acknowledgement.

## 3. Credits File Structure

Credits registers in this project use Markdown and follow this structure in
order:

1. **Title:** `# TeachLink Backend Credits` (a scoped register may name its
   component instead).
2. **Metadata:** `Format version`, `Last reviewed`, and `Next review due`, each
   using the formats shown below.
3. **Contributors:** entries grouped by calendar year of first credit, newest
   year first. Keep each contributor's acknowledgements together under their
   chosen display name.
4. **Community acknowledgements:** optional entries for a group or community
   whose contribution is not appropriately listed as an individual entry.
5. **Change log:** a newest-first table recording the date, format version, and
   summary of each structural or policy-driven register update.

Use this entry format. Include a public handle only when the contributor wants
it included:

```markdown
## Contributors

### 2026

- **Display name** (`@public-handle`) — **First credited:** 2026-09-29.
  - **2026-09-29:** Concise description. **Evidence:** [PR #123](https://github.com/rinafcode/teachLink_backend/pull/123).
```

Each contributor entry must include the contributor's chosen display name and
the date first credited. Each acknowledgement bullet must include the credit
date, a concise and specific description of the accepted contribution, and at
least one evidence link unless disclosure or privacy requirements prevent it.
Use ISO `YYYY-MM-DD` dates. Append later acknowledgements to that person's
entry with their own date, description, and evidence; do not create duplicate
entries or reorder entries to suggest rank.
Do not include email addresses, private account details, contribution scores,
or unverified claims. Third-party works and dependencies belong in the
attribution notices, not in contributor entries.

The metadata must use these labels and formats:

```markdown
- **Format version:** 1.0.0
- **Last reviewed:** YYYY-MM-DD
- **Next review due:** YYYY-MM-DD
```

## 4. Review and Update Cadence

Maintainers own the credits register and use this versioned cadence reference
to keep it current:

| Trigger | Required action | Target |
|---|---|---|
| An eligible contribution is accepted or merged | Confirm the evidence and attribution preference, then append the acknowledgement to the register | Within 30 days, or after a security embargo ends and publication is approved |
| Quarterly reconciliation | Review merged work and accepted non-code contributions from the preceding quarter; add omissions, repair links, and record the review date | At least once every 3 months |
| Annual register review | Confirm entries remain accurate, check pending correction or removal requests, and update `Last reviewed` and `Next review due` | At least once every 12 months |
| Material change to this policy or register format | Review the affected entries and increment the relevant version according to §5 | In the same pull request as the change |

Entries are appended without removing historical credit when a contributor
becomes inactive. Corrections, privacy requests, or removals are handled
promptly by a maintainer and noted in the register change log without exposing
private details. A delayed acknowledgement should record the actual credit
date, not imply a different contribution date.

## 5. Versioning and Changes

The policy starts at version `1.0.0`. The policy and any credits register each
maintain their own version:

- **Major** (`X.0.0`): changes eligibility, contributor rights, or the meaning
  of an acknowledgement in a materially incompatible way.
- **Minor** (`1.Y.0`): adds a record field, section, or process without
  invalidating existing entries.
- **Patch** (`1.0.Z`): corrects wording, links, or examples without changing
  requirements.

Policy amendments follow the governance review process in
[`Governance/README.md`](../README.md). The policy change log is maintained
below; a register keeps its own change log as specified in §3.

## 6. Scope and Enforcement

This policy governs public project acknowledgements only. It does not change
the contribution, review, licensing, security-disclosure, or code-of-conduct
requirements. Maintainers are responsible for applying it consistently;
contributors may ask a maintainer to correct an omitted or inaccurate entry.
Changes to this policy are proposed through the normal governance process and
must remain within the `Governance/` folder.

## 7. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-29 | Initial policy: contribution credit, credits file structure, and versioned review cadence. |