# Tagging Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-10-16
- **Review cadence:** Every 6 months, or after any change to the release process,
  release automation, or signing configuration

This policy defines the Git tags this repository publishes: how a tag is named,
who may create one, and the signing requirement a release tag must satisfy. It
lives entirely inside the `Governance/` folder and does not change application
code.

Version **numbers** are not defined here —
[`VERSIONING.md`](VERSIONING.md) owns the scheme, the bump rules, and the release
steps. This document owns the tag **objects** that point at released commits.

## 1. Scope

**Applies to** every tag pushed to this repository's canonical remote that
identifies a released version: release tags, pre-release tags, and tags cut for
a hotfix or a maintenance line.

**Covers** the tag naming convention (§2), who is authorized to create a tag
(§3), the signing requirement and its verification (§4), the tag creation
procedure (§5), and the handling of a non-conforming tag (§4.5).

**Does not cover:**

- Version numbering, bump levels, and pre-release identifiers, which are fixed
  by [`VERSIONING.md`](VERSIONING.md) §§2–8.
- Release go/no-go authority and the checks that precede tagging, which are
  fixed by [`processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §§2–4.
- Branch naming, which is a contribution mechanic rather than a release
  artifact.
- Environment promotion. Tags identify released versions, not environments;
  staging and production promotion is tracked by deployment records under
  [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md).

## 2. Tag Naming Convention

A release tag is the letter `v` followed by the exact version string recorded in
`package.json`:

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>.<N>]
```

| Tag            | Identifies                                                  |
| -------------- | ----------------------------------------------------------- |
| `v0.0.1`       | A PATCH-level release in the initial development range       |
| `v0.1.0`       | A MINOR-level release                                        |
| `v0.1.0-beta.1`| A pre-release build that is not deployable to production     |
| `v1.0.0-rc.2`  | A release candidate intended for promotion                   |
| `v1.2.4`       | A hotfix on the `1.2.3` release line                         |

Rules:

1. **One tag per released version.** A version is tagged once. Re-publishing the
   same version under a second tag is prohibited.
2. **The tag matches `package.json`.** The tag string, minus the leading `v`,
   must equal the `version` field of `package.json` at the tagged commit. A
   mismatch is a release defect, not a naming preference.
3. **Lowercase, no build metadata.** Pre-release identifiers are lowercase
   (`-rc.1`, not `-RC.1`). Build metadata that
   [`VERSIONING.md`](VERSIONING.md) §9 permits on CI artifacts must not appear in
   a tag — the tag is `v1.2.3`, never `v1.2.3+build.1847` — so that one tag maps
   to exactly one version and to one commit.
4. **Annotated tags only.** Every tag is an annotated tag object carrying a
   message and a tagger identity. Lightweight tags (`git tag v1.2.3`) are
   prohibited for releases.
5. **Tags are immutable.** A published tag is never moved, re-pointed, or
   deleted. A correction ships as a new version, per
   [`VERSIONING.md`](VERSIONING.md) §4. The single narrow exception for a
   non-conforming tag is §4.5.
6. **`dev` builds are not tagged.** CI artifacts off a non-release branch are
   keyed by commit SHA, per [`VERSIONING.md`](VERSIONING.md) §8.
7. **No environment or ad-hoc tags.** `staging-*`, `release-candidate-final`, and
   similar markers are not release artifacts and are not pushed to the canonical
   remote.

## 3. Who May Tag

Tagging is a maintainer action, not a contributor action. A tag is the
attestation that a reviewed, authorized release has shipped, so the authorization
to create one follows final release authorization rather than review or merge
rights.

| Role                                                             | May create a release tag |
| ---------------------------------------------------------------- | ------------------------ |
| Contributor                                                      | No                       |
| Reviewer, issue triager, committer                               | No                       |
| Maintainer                                                       | Yes, for a release they are authorized to cut |
| Release manager ([`../roles/RELEASE_MANAGER.md`](../roles/RELEASE_MANAGER.md)) | Yes — the tagging step in §2.6 of that role |
| Lead maintainer                                                  | Yes                      |

Rules:

1. **Tag only after the go decision is recorded.** The go/no-go decision and its
   evidence are recorded on the release pull request before merging or tagging,
   per [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4. Tagging ahead
   of that record bypasses the release gate.
2. **Final authorization is not delegated to the tagger.**
   [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4 keeps final
   authority with the lead maintainer, or a pre-named acting lead maintainer. A
   release manager tags once every gate is green and never in place of that
   authorization.
3. **The tagger signs with their own key.** A tag object must be signed by a key
   belonging to the maintainer creating it (§4). Shared keys, role accounts, and
   bare CI identities do not satisfy the signing requirement, and a tag created
   unsigned by automation is not made compliant by the fact that a maintainer
   ran the automation.
4. **Tag the reviewed commit.** The tag points at the release commit on `main` —
   the squashed `chore(release)` commit whose version bump matches the tag — per
   [`VERSIONING.md`](VERSIONING.md) §12. Tagging an
   unreviewed commit, a local-only commit, or a commit that is not on `main` is
   prohibited.
5. **Tagging access follows maintainership.** Signing keys and tagging access are
   removed on offboarding per
   [`../processes/OFFBOARDING.md`](../processes/OFFBOARDING.md), and a maintainer
   who becomes inactive follows [`INACTIVITY.md`](INACTIVITY.md).

## 4. Signing Requirement

**Every release tag must be an annotated, cryptographically signed tag.** An
unsigned tag, or one signed by an unregistered key, does not identify a released
version for the purposes of this repository.

### 4.1 Creating a signed tag

```bash
# Sign the tag with your registered key
git tag -s v1.2.3 -m "Release v1.2.3"

# Verify it before pushing
git tag -v v1.2.3

# Push the tag explicitly
git push origin v1.2.3
```

Maintainers are encouraged to make signing the default so an unsigned tag cannot
be produced by accident:

```bash
git config --global tag.gpgSign true
```

SSH signing, where configured with
`git config --global gpg.format ssh`, is accepted on the same terms: the key must
be the maintainer's own and must be registered as a signing key on their GitHub
account.

### 4.2 Key requirements

- The key belongs to the individual maintainer and to no one else. It is not
  shared between maintainers, not held by a bot account, and not stored in
  repository secrets.
- The private key is protected by a passphrase and kept in an encrypted store.
- The public key is registered on the maintainer's GitHub account as a **signing**
  key, so the tag carries a verified signature on the remote.
- Keys meet current strength guidance — RSA 4096-bit or an Ed25519 key — and are
  rotated on a schedule the maintainers set, and immediately on suspected
  compromise.
- A key is removed from service when its holder leaves the maintainer group, per
  [`../processes/OFFBOARDING.md`](../processes/OFFBOARDING.md), and any tag
  created with a compromised key is treated as unattested (see §4.5).

### 4.3 Verification

A signed tag is verified **before** it is pushed and again after, against the
remote:

| Check                        | How                                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| Signature is present         | `git cat-file -p v1.2.3` shows a `-----BEGIN PGP SIGNATURE-----` block  |
| Signature is good            | `git tag -v v1.2.3` reports a good signature from a registered key      |
| Signer is the right maintainer | The reported key ID belongs to a current maintainer, not a retired one |
| Tag matches the version      | The tag string equals `v` + `package.json` `version` at that commit     |
| The remote carries the same object | `git ls-remote --tags origin` reports the tag, and the local and remote objects agree |

`git tag -v` returning "no signature" or "BAD signature" is a failed release
gate, not a warning to note and move past.

### 4.4 Prohibited practices

- Lightweight tags.
- Annotated but unsigned tags.
- Tags signed by a key that is not the individual maintainer's registered key,
  including shared or bot keys.
- Creating or pushing a tag before final release authorization is recorded.
- Tagging a commit other than the reviewed release commit on `main`.
- Moving, re-pointing, or deleting a published tag. The only exception is the
  correction of a non-conforming tag on its existing commit under §4.5.
- Tagging from a working tree that does not match the tagged commit, or from a
  branch that has not been merged.
- Emergency handling that drops the signature requirement. Urgency shortens
  review and coordination time; it never removes the signature, exactly as
  [`processes/HOTFIX.md`](../processes/HOTFIX.md) requires of the review and
  approval gates.

### 4.5 Handling a non-conforming tag

For an unsigned, lightweight, or wrongly signed tag:

1. **Stop and do not announce.** If the tag has not been announced and no
   artifact, package, or release note has been published from it, the tag is
   corrected in place: it is deleted and re-created as a signed tag **on the same
   commit**, so the version and the commit it identifies do not change.
2. **If the release was already announced**, the version is not retracted and the
   tag is not moved. The non-conformance is recorded as a governance issue and in
   [`../DECISION_LOG.md`](../DECISION_LOG.md), stating the version, the deficiency,
   the signer situation, and the mitigation; the next release is cut correctly.
3. **Every occurrence is recorded** in [`../DECISION_LOG.md`](../DECISION_LOG.md)
   and reviewed at the next cadence review in this document's header, so a
   recurring tooling cause is fixed rather than repeated.
4. **A tag signed with a compromised key** is treated as unsigned and handled by
   the security process under
   [`../SECURITY_POLICY.md`](../SECURITY_POLICY.md), not by this section alone.

## 5. Tag Creation Procedure

1. **Confirm authorization.** The go/no-go decision, evidence links, and rollback
   plan are recorded on the release pull request, and the lead maintainer has
   authorized the release
   ([`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4).
2. **Confirm the version.** The `chore(release)` pull request has merged to
   `main` and `package.json` reports the version the tag will carry
   ([`VERSIONING.md`](VERSIONING.md) §12).
3. **Update and check out the release commit.** Pull `main` and confirm the
   working tree is clean, so the tag is created against the intended commit.
4. **Create the signed annotated tag** as in §4.1, on `main`, at the release
   commit.
5. **Verify locally** with `git tag -v` and the checks in §4.3.
6. **Push the tag** explicitly (`git push origin v1.2.3`), then confirm the remote
   object matches and that the signature is reported as verified.
7. **Record the release.** Add the version, tag, tagger, verification outcome, and
   any exceptions to the release record and, where required,
   [`../DECISION_LOG.md`](../DECISION_LOG.md).
8. **If automation created the tag**, and it is unsigned or signed by the wrong
   identity, treat it under §4.5 before continuing. See §8 for the current state
   of the release tooling.

## 6. Regression Tests Where Applicable

**Not applicable.** This is a documentation-only change: it adds Markdown and
modifies no TypeScript, configuration, schema, or dependency. `Governance/` is
outside the Jest root (`jest.config.js` sets `rootDir: 'src'`), outside the
TypeScript build (`tsconfig.build.json` compiles `src/`), and excluded from
container images by the `*.md` rule in `.dockerignore`. No test was added and none
was modified.

Tag signing is also not an automated gate today: the CI workflow in
`.github/workflows/ci.yml` runs on branch pushes and pull requests and performs
no tag inspection, so there is no existing test surface to extend for tag
objects, and adding one would require changing files outside `Governance/`. The
verifiable obligations this policy creates are checks a maintainer performs:

- Every relative link in this document resolves to a file that exists.
- The tag format in §2 matches the tag step in
  [`VERSIONING.md`](VERSIONING.md) §12 and the pre-release forms in §8 of that
  document.
- Every role named in §3 either has a document under `Governance/roles/`, is a
  rung of the ladder in
  [`../processes/PROMOTION_CRITERIA.md`](../processes/PROMOTION_CRITERIA.md), or is
  defined in [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md).
- For each release, `git tag -v <tag>` returns a good signature, and the tag
  string matches `package.json` `version` at the tagged commit.

## 7. Documenting Changes

- **Amendments** are submitted as a pull request confined to the `Governance/`
  directory, touching at most two files ([`../README.md`](../README.md)).
- **Substantive changes** — the naming format, who may tag, or the signing
  requirement — require asynchronous review and consensus under
  [`ASYNC_DECISIONS.md`](ASYNC_DECISIONS.md).
- **Changelog.** An entry is added to
  [`../CHANGELOG.md`](../CHANGELOG.md) under the unreleased section, per
  [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md).
- **Decision log.** Any change to the signing requirement, and any non-conforming
  tag recorded under §4.5, is recorded in
  [`../DECISION_LOG.md`](../DECISION_LOG.md).
- **Conflict resolution.** If this policy and
  [`VERSIONING.md`](VERSIONING.md) or
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) disagree, the conflict is
  raised as a governance issue and resolved by the maintainers before a release
  relies on either reading. Numbering and authorization belong to those documents;
  this policy applies to the resulting tag object.
- **Change log:**

| Version | Date       | Description of Change                                                                                              |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 2026-10-16 | Initial tagging policy: naming convention, who may tag, the signed-tag requirement, and handling of non-conforming tags. |

## 8. Related Documents and Known Limitations

Related documents:

- [`VERSIONING.md`](VERSIONING.md) — version scheme, bump levels, pre-release
  identifiers, and the release steps that produce the tag. Authoritative for
  numbering.
- [`../processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) — required
  sign-offs, gating checks, and final release authorization. Authoritative for
  who may release.
- [`../roles/RELEASE_MANAGER.md`](../roles/RELEASE_MANAGER.md) — the release
  manager's duties, including tagging, and the limits on that role.
- [`BACKPORT.md`](BACKPORT.md) — where a fix lands on an older release line and
  how that line's next patch release is cut.
- [`../processes/HOTFIX.md`](../processes/HOTFIX.md) — expedited production fixes,
  which are tagged under the same signing requirement.
- [`DCO.md`](DCO.md) — sign-off on commits, which this policy complements rather
  than replaces: a DCO sign-off attests to the contribution, a signed tag attests
  to the release.
- [`../SECURITY_POLICY.md`](../SECURITY_POLICY.md) — supported versions and
  security handling, including a compromised signing key.
- [`../DECISION_LOG.md`](../DECISION_LOG.md) — where tag exceptions and signing
  changes are recorded.

Known limitations:

- **The release tooling creates unsigned tags.** `scripts/bump-version.sh` creates
  an annotated but unsigned tag with `git tag -a` and pushes it with
  `--follow-tags`, and [`docs/release-automation.md`](../../docs/release-automation.md)
  documents the same unsigned `git tag -a` command for manual releases. Both files
  are outside `Governance/` and are not changed by this policy, which is confined
  to governance. Until that tooling is updated, the signing requirement in §4 can
  only be satisfied by creating the signed tag yourself before the tag is pushed,
  or by correcting an unsigned tag under §4.5 — and §5.8 makes that correction an
  explicit step rather than an oversight.
- **No maintainer signing-key list is published.** §4.2 requires the key to be
  registered with GitHub and verified, but this repository does not yet carry a
  list of current maintainer keys, so "signed by a current maintainer" currently
  resolves through the GitHub verified-signature badge and the maintainer roles
  under `Governance/roles/`. An in-repo key list is a worthwhile follow-up
  governance change.
- **The documented release workflow is not present.**
  [`docs/release-automation.md`](../../docs/release-automation.md) describes a
  tag-push-triggered release workflow, but `.github/workflows/` currently contains
  only `ci.yml` and `dependabot.yml`. The tag-push automation that document
  describes is therefore not exercised today, and nothing in CI verifies a pushed
  tag — which is why §4.3 and §4.4 put verification on the maintainer rather than
  on an automated gate.

## Contact

For questions about this policy, contact the maintainer team. For a specific
release in flight, raise the question on the release pull request so the answer is
recorded with the decision. For a security concern — including a suspected
compromise of a signing key — do not open a public issue; follow
[`../SECURITY_POLICY.md`](../SECURITY_POLICY.md).
