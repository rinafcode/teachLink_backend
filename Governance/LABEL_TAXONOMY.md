# Label Taxonomy

**Document:** `Governance/LABEL_TAXONOMY.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This document defines all labels used in the TeachLink Backend repository, their intended meaning, and the rules for applying them. A consistent label taxonomy makes triage, filtering, and reporting predictable for contributors and maintainers alike.

---

## Label Categories

Labels are organised into the following categories. Each category uses a consistent prefix so labels can be quickly filtered in the GitHub UI.

---

### 1. Type Labels (`type:`)

Classify *what kind of issue or PR* this is.

| Label | Colour | Description |
|---|---|---|
| `type: bug` | `#D73A4A` (red) | Existing functionality is broken or behaving incorrectly |
| `type: feature` | `#0075CA` (blue) | A new capability is being requested |
| `type: improvement` | `#A2EEEF` (teal) | Enhancement to existing behaviour without adding new capabilities |
| `type: docs` | `#0075CA` (blue) | Documentation gap, error, or improvement |
| `type: governance` | `#5319E7` (purple) | Policy, process, or governance document |
| `type: chore` | `#E4E669` (yellow) | Maintenance, dependency updates, CI, tooling, refactoring |
| `type: question` | `#D876E3` (pink) | General question; consider redirecting to Telegram |
| `type: security` | `#B60205` (dark red) | Security-related finding or hardening task |
| `type: performance` | `#FEF2C0` (cream) | Performance regression or optimisation task |

**Rules:**
- Apply exactly **one** `type:` label per issue or PR.
- If an issue spans multiple types, choose the primary intent.

---

### 2. Priority Labels (`priority:`)

Indicate *how urgently* the issue or PR needs attention.

| Label | Colour | Criteria |
|---|---|---|
| `priority: critical` | `#B60205` (dark red) | Production broken, security vulnerability, or data-loss risk |
| `priority: high` | `#E11D48` (rose) | Major feature blocked or significant user impact |
| `priority: medium` | `#FBCA04` (amber) | Noticeable issue; a workaround exists |
| `priority: low` | `#C2E0C6` (light green) | Minor inconvenience; cosmetic or edge-case |

**Rules:**
- Apply exactly **one** `priority:` label per issue or PR.
- Critical issues must be escalated immediately to `@rinafcode/maintainers`.

---

### 3. Status Labels (`status:`)

Communicate *where the issue or PR currently stands* in the workflow.

| Label | Colour | Description |
|---|---|---|
| `status: needs triage` | `#EDEDED` (grey) | Issue has not been reviewed by a maintainer yet |
| `status: triaged` | `#0E8A16` (green) | Issue has been reviewed and categorised |
| `status: in progress` | `#0075CA` (blue) | Someone is actively working on this |
| `status: blocked` | `#D73A4A` (red) | Work is blocked by a dependency or decision |
| `status: on hold` | `#E4E669` (yellow) | Intentionally paused pending a decision |
| `status: stale` | `#EDEDED` (grey) | No activity for 60+ days |
| `status: wontfix` | `#FFFFFF` (white) | Acknowledged but out of scope; will not be addressed |
| `status: duplicate` | `#CFD3D7` (light grey) | Duplicate of an existing issue |

**Rules:**
- Every open issue should carry one `status:` label.
- Only maintainers may apply `status: wontfix`.

---

### 4. Area Labels (`area:`)

Identify *which part of the codebase or domain* is affected.

| Label | Colour | Description |
|---|---|---|
| `area: auth` | `#1D76DB` (dark blue) | Authentication and authorisation |
| `area: api` | `#0075CA` (blue) | REST or GraphQL API surface |
| `area: database` | `#5319E7` (purple) | Database schema, migrations, queries |
| `area: ci-cd` | `#E4E669` (yellow) | CI/CD pipelines and automation |
| `area: docs` | `#A2EEEF` (teal) | Documentation and README |
| `area: payments` | `#0E8A16` (green) | Payments and Stripe integration |
| `area: notifications` | `#D876E3` (pink) | Notifications module |
| `area: search` | `#FEF2C0` (cream) | Search and Elasticsearch |
| `area: governance` | `#5319E7` (purple) | Governance documents and processes |
| `area: security` | `#B60205` (dark red) | Security hardening and vulnerabilities |
| `area: infra` | `#FBCA04` (amber) | Infrastructure and deployment |

**Rules:**
- Apply one or more `area:` labels as appropriate.
- Create a new `area:` label if a consistently relevant area is missing (requires maintainer approval).

---

### 5. Needs Labels (`needs:`)

Signal *what the issue is waiting on* before it can move forward.

| Label | Colour | Description |
|---|---|---|
| `needs: more info` | `#EDEDED` (grey) | Waiting for clarification from the author |
| `needs: design` | `#FEF2C0` (cream) | Requires a design or architecture decision first |
| `needs: discussion` | `#D876E3` (pink) | Open question requiring broader team input |
| `needs: review` | `#0075CA` (blue) | PR is ready for review |
| `needs: rebase` | `#E4E669` (yellow) | PR has conflicts and needs to be rebased |

---

### 6. Programme Labels

Used by specific open-source or contribution programmes.

| Label | Colour | Description |
|---|---|---|
| `Stellar Wave` | `#5555FF` (blue-purple) | Part of the Stellar Wave contributor programme |
| `good first issue` | `#7057FF` (purple) | Suitable for first-time contributors |
| `help wanted` | `#008672` (teal) | Extra help is welcome; not reserved for a specific person |

---

## Rules for Applying Labels

1. **Triage first:** Do not apply labels before triaging. `status: needs triage` is the default.
2. **Minimum required labels:** After triage, every issue must have at least one `type:`, one `priority:`, and `status: triaged`.
3. **Keep labels current:** Update status labels as the issue progresses. A closed issue should not retain `status: in progress`.
4. **No label spam:** Do not apply labels that are not relevant. Noisy labels obscure filters.
5. **Label creation:** New labels must be proposed via a PR to this document before being created in GitHub.

---

## Label Maintenance

Labels should be reviewed quarterly. Unused labels (no issues in 6 months) should be archived. Renamed labels must update all existing issues.

---

## Related Documents

- `Governance/processes/TRIAGE.md` — Issue triage process
- `Governance/processes/MILESTONE_GOVERNANCE.md` — Milestone governance
- `CONTRIBUTING.md` — General contribution guidelines
