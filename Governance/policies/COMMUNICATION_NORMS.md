# TeachLink Backend — Community Communication Norms

| Field      | Value                                               |
| ---------- | --------------------------------------------------- |
| Status     | Active                                              |
| Version    | 1.0.0                                               |
| Applies to | All contributors, maintainers, and triagers         |
| Scope      | Public repository communication (issues, PRs, chat) |
| Related    | [`CONTRIBUTING.md`](../../CONTRIBUTING.md)          |

This document is the versioned reference for **how** people communicate in this
project. It does not replace [`CONTRIBUTING.md`](../../CONTRIBUTING.md), which
remains authoritative for contribution mechanics (branching, commits, review
criteria, CI). Where the two overlap, `CONTRIBUTING.md` wins.

---

## 1. Scope and intent

These norms exist to keep collaboration on a large NestJS backend **fast,
legible, and welcoming**. They are a description of the behaviour we expect from
each other — a baseline, not a legal instrument.

They are deliberately short. If a rule here cannot be followed in practice,
that is a bug in the rule; raise an issue to change it.

**Out of scope.** These norms do not govern:

- Automated CI and bot output (`ci.yml`, `security.yml`, Dependabot).
- Incident response paging, which is defined by
  [`docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md) and
  [`docs/ESCALATION_POLICY.md](../../docs/ESCALATION_POLICY.md).
- Product/UI copy served to end users of the platform, which is a separate
  concern from project communication.

---

## 2. Tone and etiquette

The tone baseline is set by the Code of Conduct in
[`CONTRIBUTING.md` §1](../../CONTRIBUTING.md): _respectful, constructive, and
professional_. These norms make that baseline concrete.

### 2.1 Expected tone

| Do                                                     | Avoid                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Critique the code, not the person                      | Personal attacks, sarcasm at a contributor's expense         |
| Assume good faith and missing context                  | Mind-reading, accusations of bad intent                      |
| State what is wrong, and suggest a path forward        | Bare "this is wrong" with no reasoning or alternative        |
| Ask clarifying questions when scope is unclear         | Assuming scope and acting on it                              |
| Credit others for ideas, review, and fixes             | Taking credit for work that was collaborative                |
| Admit and correct mistakes plainly and quickly         | Defensive or adversarial responses to review feedback        |
| Disclose conflicts of interest when they affect review | Quietly steering a decision in a direction that benefits you |

### 2.2 Writing conventions

Because most technical discussion is asynchronous and read by search engines and
future maintainers:

- **Default to public.** Anything about the code, the process, or the roadmap
  belongs in a public issue or pull request, so that others benefit from the
  answer.
- **Use the repository's vocabulary.** Match `CONTRIBUTING.md` — conventional
  commit types, module names as scopes, and the NestJS layer names
  (controller / service / guard / interceptor / filter / module) rather than
  generic descriptions like "the handler" or "the endpoint file".
- **Reference evidence.** A technical claim should be traceable: a file and line
  reference, a failing test, a log line, a benchmark, or a reproduction
  procedure. An assertion without evidence is a hypothesis, and should be
  labelled one.
- **Quote the specific line** when reviewing code, so the author knows exactly
  what is meant.
- **Keep it scannable.** Short paragraphs, fenced code blocks, and lists. Do not
  paste large diffs into a chat message — link the commit or PR instead.
- **No secrets, ever.** Do not paste tokens, `.env` contents, connection
  strings, or customer data into any channel, including Telegram. See §4.4.

### 2.3 Review etiquette

These complement the reviewer/author duties in `CONTRIBUTING.md` §9:

- **Separate blocking from non-blocking.** Prefix comments with `nit:`, `optional:`
  or `question:` so the author knows what must change before merge.
- **Limit review rounds.** Prefer one thorough pass. A second pass should be
  reserved for changes that are genuinely substantive, not for style
  preferences discoverable from the tooling.
- **Never resolve your own review threads.** Reviewers resolve; authors answer
  (also required by `CONTRIBUTING.md` §9).
- **No force-push during review.** Add commits so reviewers can see the delta,
  and expect approvals to be invalidated (see `CONTRIBUTING.md` §9, _Stale review
  invalidation_).
- **Disagree explicitly.** If you are not persuaded by a change, say so plainly
  and state the condition under which you would be comfortable. Silent
  non-approval is not a review outcome.

### 2.4 Conduct that ends participation

Maintainers may remove a contributor's access for: discriminatory or harassing
language, sustained personal attacks, deliberate disruption of review threads,
publishing others' private information, or repeated refusal to follow these
norms. Removal is a last resort; a private word from a maintainer comes first
where the situation allows it.

---

## 3. Official channels

Use the channel that matches the intent. Escalating to a louder channel does not
make a technical question valid, and splitting one topic across channels loses
the record.

### 3.1 Channel table

| Channel                                                                       | Use for                                                                             | Do not use for                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **GitHub Issues** (this repository)                                           | Bug reports, feature requests, task tracking, governance changes                    | General questions, support requests                                |
| **GitHub Pull Requests**                                                      | Code review and change delivery; every PR must link an issue (`CONTRIBUTING.md` §2) | Open-ended discussion that no issue captures                       |
| **GitHub Discussions**                                                        | Architecture questions, RFC-style proposals, design debate that outgrows an issue   | Bug reports; anything requiring a code change                      |
| **Telegram** — <https://t.me/teachlinkOD>                                     | Community support, quick questions, coordination between contributors               | Security reports, code review, anything needing a traceable record |
| **Email to maintainers** (see [`CONTRIBUTING.md` §13](../../CONTRIBUTING.md)) | **Vulnerability reports and other sensitive matters** — must stay private           | Anything that should be public, or anything non-urgent             |
| **Repository documentation** — [`docs/`](../../docs)                          | Authoritative reference for how the system works                                    | —                                                                  |

The Telegram community and the Issues tracker are linked from the
[Contributing section of the README](../../README.md#-contributing).

### 3.2 Choosing a channel

1. **Is it about a change to the code?** → Issue first (every change must be
   linked to one), then a PR. This is non-negotiable: _"PRs without a linked
   issue will not be reviewed and will be closed"_ (`CONTRIBUTING.md` §2).
2. **Is it a security or privacy concern?** → Private email. Never a public
   issue, PR, Discussions post, or Telegram message. See §4.4.
3. **Is it a question with no code change attached?** → Discussions, or Telegram
   if it is quick and social.
4. **Is it blocking you right now?** → Telegram, and link the issue so the
   answer is recorded. If a maintainer replies "works for me", move the
   resolution into the issue so the next person finds it.

### 3.3 Channels that are not official

Anything not listed in §3.1 — personal DMs, unlisted group chats, AI-generated
summary accounts, or third-party forums — carries no maintainer authority and
creates no obligation to respond. Bounties, partnerships, or recruitment offers
received through such channels should be treated as unverified.

---

## 4. Response-time expectations

### 4.1 What these numbers are

The targets below are **community norms, not service-level agreements.** No one
is contractually obligated to meet them, and the project has no staffing
guarantee. Treat a missed target as a reason to help or escalate — never as
grounds for pressure on an individual, and never as permission to open a
duplicate issue or a public complaint thread.

"Business days" excludes weekends and public holidays in the maintainers'
primary timezone.

### 4.2 Targets by channel and kind

| Kind of communication                      | Acknowledgement | Substantive response | Notes                                        |
| ------------------------------------------ | --------------- | -------------------- | -------------------------------------------- |
| **Security report** (private email)        | 1 business day  | 3 business days      | Acknowledge receipt before investigating     |
| **Bug report** (Issue)                     | 2 business days | 7 business days      | Triage may ask for a reproduction procedure  |
| **Feature request** (Issue)                | 3 business days | No target            | Silence is not a rejection; ask a maintainer |
| **Question** (Discussions / Telegram)      | 1 business day  | 3 business days      | Telegram best-effort only                    |
| **PR awaiting initial review** → `develop` | 1 business day  | 2 business days      | Review SLA, `CONTRIBUTING.md` §9             |
| **PR awaiting initial review** → `main`    | 1 business day  | 3 business days      | Review SLA, `CONTRIBUTING.md` §9             |
| **PR changes requested — author responds** | —               | 2 business days      | Applies to the author of the PR              |
| **Re-review after new commits**            | —               | 1 business day       | Approvals are invalidated by new commits     |
| **Stale PR (no activity 14 days)**         | —               | —                    | Expect to be closed or asked to update       |

The PR rows restate, and do not change, the review SLA in
[`CONTRIBUTING.md` §9](../../CONTRIBUTING.md). If this table and that one ever
disagree, `CONTRIBUTING.md` governs.

### 4.3 What is exempt from these targets

- Outside contributors' expected availability, and periods when no maintainer is
  on rotation.
- Pull requests targeting `main` during a release freeze.
- Anything genuinely unmaintainable until a maintainer returns from leave — the
  honest response to a missed target is to pick up the work, not to chase it.
- Issues closed as duplicates or out of scope, which need no substantive reply
  beyond the closing note.

### 4.4 Security and sensitive reports

- Report vulnerabilities privately by email to the maintainer contacts in
  `CONTRIBUTING.md` §13. **Do not** open a public issue, PR, Discussions post, or
  Telegram message, and do not include secrets in the report.
- Wait for a maintainer response before disclosing publicly. Do not open a PR
  that demonstrates the vulnerability until a maintainer agrees to a disclosure
  date.
- Cross-project disclosure (for example, a dependency or an upstream
  infrastructure flaw) is fine to pursue, but tell the maintainers first so they
  are not blindsided.

---

## 5. Enforcement and changes to this document

- These norms are **advisory**, except for §2.4, which describes grounds for
  removal of access.
- Maintainers may act on a conduct issue without a public record. If you are
  subject to a decision you believe is mistaken, ask a maintainer you trust to
  review it privately.
- This document is versioned in the table at the top. Substantive changes are
  proposed as a pull request with `Closes #<issue>`, following
  `CONTRIBUTING.md` §8, and take effect on merge to `main`.
- When this document conflicts with [`CONTRIBUTING.md`](../../CONTRIBUTING.md),
  raise an issue to reconcile the two. Do not silently rely on whichever is more
  convenient.
