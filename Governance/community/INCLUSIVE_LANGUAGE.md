# Inclusive Language Guide

| Field | Value |
| --- | --- |
| Document | `Governance/community/INCLUSIVE_LANGUAGE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | All code, comments, documentation, commit messages, issues, pull requests, and community channels in `rinafcode/teachLink_backend` |
| Related | [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) · [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md) |

This guide records the language the project prefers and the language it avoids.
It exists so that everyone — regardless of background, first language, or
experience — can read our code and discussion without being excluded by an
avoidable word. It is a style guide, not a spelling test, and it is not a trap.

## 1. Preferred terms

Use terms that describe **what a thing does**, not a metaphor borrowed from
history, violence, or a person's identity.

| Prefer | Because |
| --- | --- |
| `primary` / `replica` | Describes the role in replication without a master/slave hierarchy. |
| `allowlist` / `denylist` | States the function directly. |
| `blocklist` (for content) | States the function directly. |
| `parent` / `child` (or `upstream` / `downstream`) | Describes the relationship. |
| `placeholder` / `dummy` (for a stand-in value) | Describes the value. |
| `main` / `default branch` | The repository's actual branch names. |
| `they` / `folks` / `everyone` | Gender-neutral and accurate for a mixed group. |
| `sanitize` / `normalize` / `validate` | Describes the transformation precisely. |
| `assets-person`, `contributor`, `maintainer` | Describes the role, not the person's identity. |

## 2. Terms to avoid

The following words are not permitted in new code, comments, documentation, or
community discussion. Where they already exist, replace them when you touch the
surrounding file rather than in a standalone rename-only change.

| Avoid | Use instead | Why |
| --- | --- | --- |
| `master` (branch or node) | `main`, `primary`, `replica` | Carries a master/slave connotation. |
| `slave` (node or process) | `replica`, `secondary`, `worker` | Carries a dehumanising connotation. |
| `whitelist` / `blacklist` | `allowlist` / `denylist` | Ties value to colour and race. |
| `blacklist` / `blackhole` (verb) | `block`, `drop`, `discard` | As above. |
| `dummy` (as an insult) | `placeholder`, `stub`, `sample` | Derogatory when aimed at a person. |
| `crazy`, `insane`, `psycho` | `unexpected`, `surprising`, `fragile` | Trivialises mental illness. |
| `crippled`, `lame` | `disabled`, `slow`, `underpowered` | Ableist. |
| `grandfathered` | `legacy`, `pre-existing`, `exempted` | Ties exemption to a voting-rights history. |
| `man hours` / `manpower` | `person-hours`, `staffing`, `effort` | Gendered. |
| `guys` (mixed group) | `folks`, `everyone`, `contributors` | Gendered when the group is mixed. |
| `he` / `she` (default pronoun) | `they` | Erases non-binary people. |
| Gendered or sexualised terms of address | The person's name or role | Harassment risk. |

This list is intentionally short. It covers the terms most likely to appear in a
backend repository; it is not an exhaustive dictionary.

## 3. Enforcing it

- **By default, gently and in the thread.** A reviewer flags an avoidable term
  with a `nit:` prefix and the preferred alternative; the author fixes it before
  merge. Most cases end there.
- **In code review, it is a blocking `nit:` only when the term is in the diff.**
  We do not require a contributor to rename unrelated pre-existing code in the
  same change.
- **Automation is welcome.** Where a term can be caught mechanically (an API
  field, a metric name, a constant), prefer a lint rule or a test over a
  reviewer's memory. Propose the rule in a follow-up issue.
- **Never weaponise this guide.** It is not a basis for policing accents, grammar,
  or a contributor's English. Intent and clarity come first; a good-faith
  wording slip is corrected, not punished.
- **Persistent bad-faith use** — slurs, harassment, or deliberately demeaning
  language — is a conduct matter and is handled under
  [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) and
  [`policies/MODERATION.md`](../policies/MODERATION.md), not by this guide.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
