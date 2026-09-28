# Security Response Team Charter

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or when membership changes

This charter defines the Security Response Team (SRT) for TeachLink Backend:
membership, responsibilities, and on-call expectations. It lives entirely
inside the `Governance/` folder and does not change application code.

Related documents:

- [`SECURITY_POLICY.md`](SECURITY_POLICY.md)
- [`processes/VULN_DISCLOSURE.md`](processes/VULN_DISCLOSURE.md)
- [`processes/COORDINATED_DISCLOSURE.md`](processes/COORDINATED_DISCLOSURE.md)
- [`policies/EMBARGO.md`](policies/EMBARGO.md)
- Operational on-call domain notes: [`domains/ON_CALL.md`](domains/ON_CALL.md)

## 1. Purpose

The SRT is the accountable group for receiving, triaging, remediating, and
disclosing security vulnerabilities that affect this repository’s supported
version lines. It coordinates with maintainers and, when needed, downstream
operators on the embargo list.

## 2. Membership

| Role | Who | Privileges |
|------|-----|------------|
| **SRT Lead** | A designated maintainer | Final escalation for severity/timing disputes; ensures coverage |
| **SRT Members** | Maintainers (and optionally trusted security reviewers) granted GitHub Security Advisory access | Triage, private advisory drafts, fix coordination |
| **On-call rotator** | Subset of SRT Members | First responder for new private reports during their shift |

Membership changes are recorded in the Governance changelog and, when
appropriate, the decision log. Access to private security advisories must be
revoked when someone leaves the team.

The public-facing contact remains the channels in `SECURITY_POLICY.md`;
individual personal emails are not required to be published.

## 3. Responsibilities

SRT Members collectively:

1. **Monitor** private reporting channels (GitHub Security Advisories and the
   security inbox).
2. **Acknowledge and triage** reports per `processes/VULN_DISCLOSURE.md`.
3. **Coordinate fixes** on supported branches with code owners.
4. **Uphold embargo rules** in `policies/EMBARGO.md`.
5. **Prepare advisories** using `templates/ADVISORY_TEMPLATE.md` and run
   coordinated disclosure per `processes/COORDINATED_DISCLOSURE.md`.
6. **Post-incident** — ensure lessons learned feed into postmortems when an
   issue reached production impact (`domains/POSTMORTEM_POLICY.md`).

The SRT Lead additionally ensures the on-call rotation is published to members
and that no report sits unacknowledged beyond policy targets.

## 4. On-Call Rotation

- **Cadence:** Weekly shifts (timezone coverage as agreed among members; default
  is calendar-week UTC).
- **Primary duty:** First acknowledgement of new private reports; escalate to
  additional members for validation and fix ownership.
- **Handoff:** Outgoing on-call summarizes open private cases to the incoming
  member (private channel or advisory comments).
- **Backup:** If the primary cannot respond, the SRT Lead is the default
  backup.
- **Alignment with product on-call:** Security on-call may overlap engineering
  on-call (`domains/ON_CALL.md`) but security triage priority follows this
  charter and the security policy response times.

Rotation schedule is maintained by the SRT Lead in the team’s private ops
channel (not required to be public).

## 5. Decision Authority

| Decision | Authority |
|----------|-----------|
| Severity rating | SRT Member performing triage; escalate to Lead on disagreement |
| Embargo extension beyond defaults | SRT Lead + documented reporter agreement (`EMBARGO.md`) |
| Public disclosure timing | SRT Lead within coordinated disclosure + embargo rules |
| Membership changes | Maintainers per project charter |

## 6. Change History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial security response team charter (issue #1614) |
