# Exception And Waiver Register

This register records every approved exception and waiver against the
project's policies: what was excepted, who approved it, when it expires,
and how it is being reviewed. A policy without a recorded exception process
gets followed in secret; this register keeps exceptions visible.

This document is part of the project's **Compliance** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Exception Fields

Each entry in the register carries these fields:

| Field | Meaning |
|---|---|
| ID | Sequential identifier, `EXC-NNNN`. |
| Policy excepted | The policy, standard, or control being excepted, referenced by document. |
| Scope | Exactly what is excepted — system, component, or process — and what is not. |
| Justification | Why compliance is impractical or undesirable right now, and the risk accepted. |
| Approver | The GitHub handle of the approver, per the authority table below. |
| Opened | Date the exception was approved and recorded. |
| Expiry | Date the exception lapses automatically. |
| Status | Active | Expired | Revoked | Remediated. |
| Review notes | What changed at each review; empty only while nothing has. |

## Approver And Expiry

- **Approver** — exceptions are approved by the owner of the excepted
  policy; exceptions affecting security or compliance additionally require
  a second approver from the maintainers. Self-approval is not permitted.
- **Expiry** — every exception expires. Maximum initial term is **90 days**;
  renewal requires a fresh justification and is recorded as a new review
  note, never by silently editing the expiry date. An exception past its
  expiry date is `Expired` regardless of whether anyone updated the row,
  and the underlying policy applies again.

## Review Process

- **Active exceptions are reviewed every 30 days** by the approver, or
  earlier if the justification no longer holds.
- Each review either renews (new expiry, recorded in review notes), remediates
  (status `Remediated`, with a link to the change that closed it), or revokes
  (status `Revoked`, with the reason).
- An `Expired` or `Revoked` entry is never deleted — it is the audit trail.
- The register as a whole is reviewed at each governance review
  (`Governance/runbooks/GOVERNANCE_REVIEW_RUNBOOK.md`); open exceptions
  older than one quarter are called out explicitly there.
