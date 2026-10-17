# Social Media Policy

| Field | Value |
| --- | --- |
| Document | `Governance/community/SOCIAL_MEDIA.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Anyone posting from, or on behalf of, a TeachLink social account |
| Related | [`community/MEDIA_POLICY.md`](MEDIA_POLICY.md) · [`community/REPRESENTATION.md`](REPRESENTATION.md) · [`policies/MODERATION.md`](../policies/MODERATION.md) |

This policy states who may post officially for the project on social media, the
tone and disclosure rules those posts follow, and how a problem with an official
account is escalated. It covers project-operated accounts (for example, the
project's accounts on X, LinkedIn, Mastodon, and the Telegram community), not an
individual's personal account.

## 1. Who may post officially

- **Official accounts are operated by the maintainer team.** Access is granted
  per account to named maintainers and, where needed, to a designated community
  manager. The current holders are listed in the repository's maintainer records.
- **Only the listed holders may publish** to an official account. Drafting a post
  for someone else to publish is fine; publishing from the wrong account is not.
- **Access is least-privilege and reviewed.** Each holder has their own login,
  MFA is required, and access is removed when a person leaves the project
  ([`processes/OFFBOARDING.md`](../processes/OFFBOARDING.md)).
- **Governance and moderation decisions** are announced from the repository (issue
  or release notes) first; social posts link to that record rather than being the
  only source.

## 2. Tone and disclosure rules

| Do | Avoid |
| --- | --- |
| Match the tone in [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md): respectful and factual | Snark, dunking on other projects, or personal attacks |
| Credit contributors and link the relevant PR or issue | Announcing shipped work with no public record |
| Disclose when you are a maintainer speaking in that capacity | Presenting official positions as personal opinion, or vice versa |
| Disclose affiliations and sponsors when they are relevant | Undisclosed promotion of a company you are tied to |
| Correct mistakes openly, with a follow-up post | Quietly deleting a post that made a factual error |

- **No secrets or personal data.** Never post tokens, `.env` values, unpublished
  vulnerability details, or user data — the same rule as
  [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md) §4.4.
- **No unverified claims.** Security, legal, and roadmap claims must be sourced
  from a public issue, release note, or advisory. If it is not written down, do
  not post it.
- **Personal accounts.** You are free to post as yourself. If you identify as a
  maintainer, note that you speak for yourself unless the post is an
  announcement; see [`community/REPRESENTATION.md`](REPRESENTATION.md).

## 3. Account security

- MFA and a unique password are mandatory; shared passwords are not permitted.
- Access changes and loss of a device are reported to the maintainer team
  immediately so the credential can be rotated. See
  [`policies/SECRET_ROTATION.md`](../policies/SECRET_ROTATION.md).
- If an account is compromised, follow
  [`processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md): regain
  control, then post a short factual notice. Do not argue from the compromised
  account.

## 4. Escalation for issues

1. **A problematic post or reply:** report it privately to a maintainer. Do not
   start a public argument from an official account.
2. **A conduct or harassment issue:** handle under
   [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) and
   [`policies/MODERATION.md`](../policies/MODERATION.md); the social account is
   not the place to resolve it.
3. **A security or privacy concern** raised through social media: move it to the
   private channel in [`SECURITY_POLICY.md`](../SECURITY_POLICY.md). Never discuss
   an unpatched vulnerability publicly.
4. **A factual error or a legal/compliance concern:** take the post down or
   correct it promptly, keep a record of the original, and inform the maintainers.
5. **A missing or departed account holder:** a maintainer with access rotates the
   credential and updates the holder list.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
