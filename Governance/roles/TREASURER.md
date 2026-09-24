# Treasurer

This document defines the **treasurer** role for TeachLink Backend: the
treasurer's duties, spending authority limits, and reporting obligations.

The treasurer is part of the project's community and on-chain governance. The
project's governance model treats treasury, grants, and proposal governance as
a distinct area (`Governance/README.md`), and the TeachLink ecosystem includes
the Stellar/Soroban rewards contract the backend integrates with. The treasurer
is the role responsible for the community-side treasury that supports that
context.

## Duties

- **Custody of community funds** — hold and protect assets held for the
  community (for example the community treasury and grant funds), keeping them
  separate from personal funds and operationally distinct from the backend's
  own payment-processing flows, which are application code, not community
  treasury.
- **Approving and executing disbursements** — pay out approved expenses,
  rewards, and grants according to the spending authority limits below.
- **Keeping records** — maintain auditable records (ledger) of every income and
  disbursement, including the reason, approval reference, amount, and date.
- **Grant and rewards support** — support the grant and rewards process by
  validating proposed budgets and tracking paid and outstanding amounts, so
  that spend stays within approved allocations.
- **Reporting** — publish reporting per the obligations below.

## Spending Authority Limits

- **Small disbursements** (below the small-spend threshold established by the
  maintainers) may be executed by the treasurer directly, with a record line
  added to the ledger and disclosed in the next report.
- **Approved-spend disbursements** require a documented approval reference
  (for example an issue or decision record where maintainers approved the
  amount and purpose) **and** a signed record from the requester where
  applicable.
- **Material disbursements** (at or above the material-spend threshold
  established by the maintainers) require maintainer approval and, where the
  community governance process applies, community approval before the
  treasurer may execute them.
- The treasurer may never use community funds for personal expenses and may
  never disburse against a pending or contested approval reference.

## Reporting Obligations

- Publish a **regular public report** (at least quarterly) covering income,
  disbursements, outstanding obligations, and balances, in a channel the
  community can access.
- Report **immediately** any suspected loss, unauthorized transaction, or
  custody risk to the maintainers and the lead maintainer.
- Reconcile the ledger against actual balances on a fixed cadence and publish
  confirmation of each reconciliation.

## Selection and Removal

The treasurer is selected by the maintainers (see the promotion and appointment
process for the project's roles). The role is revoked if the treasurer fails to
meet the reporting obligations, mishandles funds, or steps aside voluntarily.

## Ownership and Review

This document is owned by the maintainers. Changes to the treasurer role are
made through a pull request limited to the `Governance/` folder and reviewed
per `CONTRIBUTING.md` §9 and §11.