# TeachLink Backend — Governance

Home for the project's governance documents. Governance documents state **how we
work together**; they are kept separate from `src/` and from the build so that
they never affect application behaviour.

## What belongs here

```
Governance/
├── README.md                              # this file
└── policies/
    └── COMMUNICATION_NORMS.md             # tone, channels, response times
```

A governance document is in scope if it describes contributor or maintainer
behaviour, process, or standards. Anything that changes what the application
_does_ is a code change and belongs in a pull request against `src/`, not here.

## Current documents

| Document                                                             | Version | Status | Covers                                                              |
| -------------------------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------- |
| [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md) | 1.0.0   | Active | Tone and etiquette · official channels · response-time expectations |

### [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md)

The versioned reference for how contributors, maintainers, and triagers
communicate. It defines:

- the expected tone and writing conventions, with review etiquette that
  complements the reviewer and author duties in `CONTRIBUTING.md` §9;
- the official channels — GitHub Issues, Pull Requests, Discussions, the
  [Telegram community](https://t.me/teachlinkOD), and private email for
  sensitive reports — and how to choose between them;
- response-time targets per channel and per kind of communication, marked
  explicitly as community norms rather than service-level agreements.

It deliberately does **not** restate contribution mechanics. Branching, commit
format, review criteria, and CI are governed by
[`CONTRIBUTING.md`](../CONTRIBUTING.md), which remains authoritative. Where the
two documents overlap, `CONTRIBUTING.md` wins, and the communication norms say so.

Related operational references it points to, but does not duplicate:
[`docs/RUNBOOKS.md`](../docs/RUNBOOKS.md),
[`docs/ESCALATION_POLICY.md`](../docs/ESCALATION_POLICY.md), and
[`docs/api-security-best-practices.md`](../docs/api-security-best-practices.md).

## Relationship to other documents

| Document                                                    | Owns                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md)                     | How to contribute: branch strategy, commits, PR checklist, review SLA, CI       |
| [`docs/testing-standards.md`](../docs/testing-standards.md) | How to test: unit and E2E standards, mocking, coverage                          |
| `policies/COMMUNICATION_NORMS.md`                           | How to communicate: tone, channels, response times, conduct grounds for removal |

## Change log

Entries are added newest-first. Format: date · version · summary · pull request.

| Date       | Version | Change                                                                                                                                                                         | PR                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 2026-09-28 | 1.0.0   | **Initial release.** Added `policies/COMMUNICATION_NORMS.md` and created the `Governance/` tree. Covers tone and etiquette, official channels, and response-time expectations. | This pull request |

### 2026-09-28 — v1.0.0 (initial)

**Added**

- `Governance/policies/COMMUNICATION_NORMS.md` — tone and etiquette (§2),
  official channels (§3), response-time expectations (§4), and enforcement and
  amendment rules (§5).
- `Governance/README.md` — this index.

**Rationale.** The governance set had no versioned reference for community
communication; expected tone, the authoritative channel for each kind of
message, and response-time expectations were undocumented and scattered across
`README.md` and `CONTRIBUTING.md`. Contributors and maintainers had no single
place to look, and no stated baseline for tone.

**Scope.** Self-contained to the `Governance/` folder — two files, no changes
anywhere else in the repository. This was deliberate: it keeps the governance
change auditable and independent of application code.

**Regression tests.** Not applicable. This change is documentation-only: it adds
two Markdown files and modifies no TypeScript, configuration, schema, or
dependency. `Governance/` is outside the Jest root (`jest.config.js` sets
`rootDir: 'src'`), outside the TypeScript build (`tsconfig.build.json`
compiles `src/`), and already covered by the `*.md` exclusion in
`.dockerignore`. No existing test, build step, or runtime path is affected, so
no new test was added and none was modified.

**Verification performed.** Scope confirmed as exactly two new files, both under
`Governance/`; `git diff` against `main` shows no other paths; every relative
link in both documents was checked to resolve on disk; every `CONTRIBUTING.md`
section reference (§1, §2, §8, §9, §13) was checked against the current file;
and the restated review SLA was compared against the table in
`CONTRIBUTING.md` §9 to confirm the two agree.

**Known limitation.** The repository does not currently contain a standalone
Code of Conduct, a `SECURITY.md`, or a governance index outside
`CONTRIBUTING.md`. The communication norms reference the Code of Conduct as it
exists today — the three-line summary in `CONTRIBUTING.md` §1 — and describe
security reporting as `CONTRIBUTING.md` §13 does. If fuller documents are added
later, the cross-references here should be updated to point at them.

## Contributing to governance

Governance documents follow the same contribution mechanics as code: a linked
issue, a branch, and a pull request (`CONTRIBUTING.md` §2). Two additional
expectations:

- **Propose, do not decree.** A change to these norms should arrive as a pull
  request that states the problem it solves. If you are proposing a rule you
  cannot follow, say so — that is useful signal.
- **Keep it short.** A governance document nobody reads has no effect. Prefer
  editing an existing section over adding a new file, and prefer a table row
  over a paragraph.
