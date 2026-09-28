# Proposal Lifecycle Process

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-27
- **Review cadence:** Every 6 months, or after any change to the decision-making processes it coordinates

This document defines the lifecycle through which all proposals in the
TeachLink Backend project progress — from initial draft to review, formal
evaluation, decision, and post-decision execution or retirement. It specifies
the designated owners at each stage, unambiguous entry and exit criteria, and the
integration points with the project's consensus, voting, and objection-handling
processes.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application code.

---

## 1. Scope and Proposal Types

This lifecycle applies to all formal proposals across the TeachLink Backend
repository, including:

- **Requests for Comments (RFCs):** Substantive architectural changes, new module
  boundaries, public API alterations, or cross-cutting technical patterns
  governed by `Governance/processes/RFC_PROCESS.md`.
- **Governance Amendments:** New or modified policies, processes, roles, and
  templates residing in the `Governance/` folder.
- **Architectural Decision Records (ADRs):** Concrete technical decisions
  documented using `Governance/processes/ADR_PROCESS.md` and
  `Governance/templates/ADR_TEMPLATE.md`.
- **Working Group Charters:** Formation and dissolution of specialized working
  groups governed by `Governance/processes/WORKING_GROUP_FORMATION.md` and
  `Governance/processes/WORKING_GROUP_DISSOLUTION.md`.

Informal suggestions, bug reports, and minor engineering pull requests (such as
routine bug fixes or non-breaking refactors within a single module) do not
require this full proposal lifecycle; standard issue triage and code-review
procedures apply.

---

## 2. Lifecycle Stages

Every proposal advances through five distinct stages:

```
[ 1. Draft ] ──> [ 2. In Review ] ──> [ 3. Decision Window ] ──> [ 4. Decision ] ──> [ 5. Implementation / Archival ]
      │                  │                     │                         │
      │                  │                     │                         ├─> Accepted
      │                  │                     │                         ├─> Rejected
      └──────────────────┴─────────────────────┴─────────────────────────┴─> Withdrawn
```

---

### Stage 1: Draft (Ideation & Authoring)

The author formulates the problem statement, evaluates potential solutions, and
drafts the proposal using the appropriate project template.

- **Stage Owner:** Proposal Author (contributor or maintainer).
- **Key Responsibilities:**
  - Select the appropriate template (e.g., `Governance/templates/RFC_TEMPLATE.md`
    or `Governance/templates/ADR_TEMPLATE.md`).
  - Articulate the background, motivation, scope, and technical or governance design.
  - Evaluate at least one viable alternative and detail the trade-offs.
  - Assess potential impacts on security, backward compatibility, performance, and
    migration.
  - Conduct a self-review to verify compliance with repository guidelines and
    markdown standards.
- **Entry Criteria:**
  - A contributor or maintainer identifies an architectural requirement, governance
    gap, or significant change.
- **Exit Criteria:**
  - The appropriate template is fully completed with no placeholder sections.
  - Motivation and detailed design are clearly articulated.
  - Impact and alternative solutions are documented.
  - Proposal is submitted as a GitHub pull request or formal issue titled
    `[Proposal/RFC]: <Title>` and assigned the initial `status:draft` label.
- **Next Stage:** Stage 2 (In Review), or Withdrawn if abandoned by the author.

---

### Stage 2: In Review (Community & Technical Feedback)

The proposal is published for community discussion, peer review, and maintainer
feedback. The author actively responds to questions, refines the text, and
addresses critiques.

- **Stage Owner:** Proposal Author (driving responses and edits) and Assigned
  Reviewers / Maintainers (conducting thorough evaluations).
- **Key Responsibilities:**
  - Reviewers evaluate technical soundness, security implications, maintainability,
    and alignment with `Governance/CHARTER.md` and project principles.
  - Author updates the proposal to address valid critique and clarify ambiguous
    specifications.
  - Parties raise and address any specific objections in accordance with
    `Governance/processes/OBJECTION_HANDLING.md`.
  - At least one maintainer acts as the **Sponsoring Maintainer** to guide the
    proposal through the review and shepherd it toward a decision.
- **Entry Criteria:**
  - All Stage 1 exit criteria are met.
  - The author updates the status to `In Review` and requests formal review from
    relevant code owners or maintainers.
- **Exit Criteria:**
  - Mandatory minimum review period has elapsed:
    - **72 hours** for straightforward governance adjustments or minor clarifications.
    - **7 days** for RFCs, new policies, or substantive governance alterations
      (matching `Governance/policies/ASYNC_DECISIONS.md`).
  - All substantive comments, technical questions, and open review discussions have
    been addressed by the author.
  - Any formal objections have been resolved through discussion or escalated to
    mediation per `Governance/processes/OBJECTION_HANDLING.md`.
  - The Sponsoring Maintainer confirms the proposal is mature and ready for a decision.
- **Next Stage:** Stage 3 (Decision Window), or Withdrawn.

---

### Stage 3: Decision Window (Deliberation & Consensus)

The proposal enters a time-bounded formal decision window to determine the project's
binding assent or rejection.

- **Stage Owner:** Sponsoring Maintainer.
- **Decision Mechanism Routing:**
  - **Lazy Consensus (`Governance/processes/LAZY_CONSENSUS.md`):** Default path for
    routine governance proposals, non-contentious RFCs, and seconded role
    nominations. Requires no active "yes" votes; adoption occurs if no blocking
    objection is lodged during the window.
  - **Formal Vote (`Governance/processes/FORMAL_VOTING.md`):** Required for charter
    amendments, maintainer role grants/revocations, decisions requiring a
    supermajority under `Governance/policies/SUPERMAJORITY.md`, or proposals with
    unresolved objections escalated from mediation.
- **Key Responsibilities:**
  - Sponsoring Maintainer formally posts an announcement comment declaring the open
    decision window, specifying the decision path (lazy consensus or formal vote),
    duration, eligible voting body, and deadline.
  - Participants lodge votes or specific, actionable objections on the thread.
  - Sponsoring Maintainer monitors the window and enforces objection/voting rules.
- **Entry Criteria:**
  - Stage 2 exit criteria are fully satisfied.
  - Proposal is in a stable, final draft state without pending structural revisions.
- **Exit Criteria:**
  - The designated decision window has formally closed.
  - For **Lazy Consensus:** The minimum waiting period (72 hours or 7 days) has
    expired with zero unresolved blocking objections.
  - For **Formal Vote:** The voting window has closed, quorum has been confirmed
    per `Governance/policies/QUORUM.md`, and the vote tally meets either simple
    majority or supermajority per `Governance/policies/SUPERMAJORITY.md`.
  - Sponsoring Maintainer confirms and tallies the final result.
- **Next Stage:** Stage 4 (Decision).

---

### Stage 4: Decision (Outcome Determination & Recording)

The outcome of the decision window is finalized, formally published to the
community, and permanently recorded in the project's historical logs.

- **Stage Owner:** Sponsoring Maintainer and Lead Maintainer.
- **Possible Outcomes:**
  - **Accepted:** The proposal met the lazy consensus or voting threshold. It is
    approved for implementation and incorporation into project standards.
  - **Rejected:** The proposal failed to achieve required votes, failed quorum, or
    encountered an irreconcilable blocking objection. The rationale is recorded.
  - **Withdrawn:** The author voluntarily retracted the proposal at any point prior
    to finalization (e.g., superseded by another approach or no longer relevant).
- **Key Responsibilities:**
  - Sponsoring Maintainer publishes a closing summary comment on the thread stating
    the outcome, voting breakdown (if applicable), and key conclusions.
  - Sponsoring Maintainer updates the proposal document header metadata (Status:
    `Accepted`, `Rejected`, or `Withdrawn`).
  - Sponsoring Maintainer appends an entry into `Governance/DECISION_LOG.md`
    following the project's append-only schema:
    ```markdown
    | Date | Decision | Type | Reference | Maintained by |
    | YYYY-MM-DD | <Brief summary of decision> | <vote|lazy-consensus|policy|other> | <PR/Issue #> | @<maintainer> |
    ```
  - For accepted governance documents, the pull request is merged into `main`. For
    rejected or withdrawn proposals, the pull request/issue is closed with the
    decision record linked.
- **Entry Criteria:**
  - Stage 3 decision window has ended and results are validated.
- **Exit Criteria:**
  - Decision announcement comment posted to the discussion thread.
  - `Governance/DECISION_LOG.md` updated with the final decision.
  - Proposal metadata header reflects the final terminal state (`Accepted`,
    `Rejected`, or `Withdrawn`).
  - PR merged or closed accordingly.
- **Next Stage:** Stage 5 (Implementation & Archival) if Accepted; Terminal if
  Rejected or Withdrawn.

---

### Stage 5: Implementation & Archival (Execution & Lifecycle Maintenance)

For accepted proposals requiring engineering, infrastructure, or operational work,
implementation proceeds under traceable issues and pull requests.

- **Stage Owner:** Implementation Lead / Proposal Author (delivering work) and
  Maintainers (reviewing and verifying implementation).
- **Key Responsibilities:**
  - Implementation Lead creates tracking issues linking back to the accepted
    proposal.
  - Implementation pull requests reference the accepted proposal ID/URL in their
    descriptions.
  - Any material divergence from the accepted design discovered during execution is
    brought back to maintainers for review rather than silently incorporated.
  - Maintainers confirm all acceptance criteria and deliverables are verified in
    production or staging.
  - When an accepted proposal is eventually replaced by a newer standard, maintainers
    update its status metadata to **Superseded** and link to the replacement proposal.
- **Entry Criteria:**
  - Proposal status is `Accepted` and recorded in `Governance/DECISION_LOG.md`.
- **Exit Criteria:**
  - All planned implementation items are completed, merged, tested, and released.
  - Associated implementation tracking issues are closed.
  - Proposal document remains archived under `Governance/rfcs/`, `Governance/adr/`,
    or `Governance/` permanently for historical reference.
- **Next Stage:** None (Terminal / Superseded).

---

## 3. Summary of Stages, Owners, and Exit Criteria

| Stage | Stage Owner | Primary Responsibilities | Entry Criteria | Exit Criteria | Next Transition |
| --- | --- | --- | --- | --- | --- |
| **1. Draft** | Proposal Author | Authoring motivation, technical/governance design, alternatives, and impact analysis using templates. | Identified technical or governance need. | Template completed; problem and design clear; PR/issue created with draft status. | Stage 2 (In Review) or Withdrawn |
| **2. In Review** | Author & Reviewers | Iterating based on critique; addressing comments; resolving objections per objection-handling rules. | Stage 1 exit criteria met; review requested. | Review window observed (72h / 7d); comments resolved; zero blocking objections; sponsor approval. | Stage 3 (Decision Window) or Withdrawn |
| **3. Decision Window** | Sponsoring Maintainer | Stewarding lazy consensus or formal voting window; enforcing timeframes and participation rules. | Stage 2 exit criteria met; formal window opened. | Window closed; consensus confirmed with no objections, or vote tallied with quorum and required threshold met. | Stage 4 (Decision) |
| **4. Decision** | Sponsoring Maintainer | Finalizing outcome (`Accepted`, `Rejected`, `Withdrawn`); updating metadata; recording in `DECISION_LOG.md`. | Decision window completed. | Summary comment posted; `DECISION_LOG.md` entry appended; PR merged or closed with link. | Stage 5 (if Accepted) or Terminal |
| **5. Implementation** | Implementation Lead & Maintainers | Delivering implementation PRs; tracking deliverables; archiving records; marking superseded when obsolete. | Proposal status is `Accepted`. | All deliverables merged and deployed; tracking issues closed; proposal preserved as immutable record. | Superseded (if replaced) |

---

## 4. Special Paths and Exception Handling

### 4.1. Substantive Revisions
If a proposal undergoing Stage 2 (Review) or Stage 3 (Decision Window) undergoes a
substantive revision — such as altered scope, changes to technical architecture, or
modified policy thresholds — the review or decision window **resets** from the
revision date, as mandated by `Governance/policies/ASYNC_DECISIONS.md`. Minor typo
corrections, formatting updates, and non-semantic clarifications do not reset the
timer.

### 4.2. Handling Objections and Impasses
If a reviewer lodges a specific, actionable objection during Stage 2 or Stage 3:
1. Lazy consensus is immediately paused per `Governance/processes/LAZY_CONSENSUS.md`.
2. The author and objector engage in discussion to find a mutually acceptable
   compromise per `Governance/processes/OBJECTION_HANDLING.md`.
3. If an impasse persists after 14 days, a neutral maintainer mediates.
4. If mediation fails, the proposal is escalated to Stage 3 as a Formal Vote
   (`Governance/processes/FORMAL_VOTING.md`) where current maintainers cast binding
   votes.

### 4.3. Stalled and Abandoned Proposals
A proposal in Stage 1 or Stage 2 that receives no author updates, responses, or
activity for more than **30 calendar days** is considered stalled.
- A maintainer posts an inactivity warning giving a 7-day grace period.
- If no response is received, the proposal is transitioned to `Withdrawn` and closed
  without prejudice, referencing `Governance/policies/INACTIVITY.md` principles.
- The author or another contributor may reopen the proposal at a later date when ready
  to resume active stewardship.

### 4.4. Fast-Track and Emergency Changes
Urgent production remedies, security hotfixes, and critical operational changes do
not follow the standard proposal lifecycle:
- Production incidents and critical security vulnerabilities follow
  `Governance/processes/HOTFIX.md`.
- Emergency operational or disaster recovery adjustments follow
  `Governance/policies/ASYNC_DECISIONS.md` §2.5 and
  `Governance/domains/DR_GOVERNANCE.md`, with retrospective documentation and log
  recording completed after the emergency is resolved.

---

## 5. Relationship to Other Governance Documents

- `Governance/processes/RFC_PROCESS.md`: Specific criteria and requirements for
  Request for Comments documents.
- `Governance/processes/ADR_PROCESS.md`: Process for Architectural Decision Records.
- `Governance/processes/LAZY_CONSENSUS.md`: Consensus rules governing async approval
  when no objections are raised.
- `Governance/processes/FORMAL_VOTING.md`: Voting mechanics, ballot options, and
  tallies.
- `Governance/policies/QUORUM.md`: Minimum participation thresholds required for
  binding votes.
- `Governance/policies/SUPERMAJORITY.md`: Defines high-impact decisions requiring a
  two-thirds affirmative vote.
- `Governance/processes/OBJECTION_HANDLING.md`: Framework for raising, evaluating,
  and resolving dissent.
- `Governance/policies/ASYNC_DECISIONS.md`: Timeline and window standards for
  asynchronous deliberations.
- `Governance/DECISION_LOG.md`: The immutable, append-only repository log of all
  finalized project decisions.
- `Governance/processes/HOTFIX.md`: Expedited path for emergency fixes and production
  remedies.

---

## 6. Review and Maintenance

This lifecycle document is maintained by the TeachLink Backend Maintainers. It is
reviewed every six months or whenever any referenced decision-making or voting
process is amended. Any proposed modifications must be submitted via pull request
strictly confined to the `Governance/` directory in accordance with
`Governance/README.md`.
