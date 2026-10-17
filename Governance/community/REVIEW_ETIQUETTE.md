# Review Etiquette

| Field | Value |
| --- | --- |
| Document | `Governance/community/REVIEW_ETIQUETTE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Everyone who opens, reviews, or comments on a pull request in `rinafcode/teachLink_backend` |
| Related | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §9 · [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md) · [`policies/REVIEW_POLICY.md`](../policies/REVIEW_POLICY.md) |

This document describes the tone and expectations for code review in this
repository. It complements the reviewer duties in `CONTRIBUTING.md` §9 and the
communication norms in [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md);
where the two overlap, `CONTRIBUTING.md` wins. It adds no new merge gate.

## 1. Why review etiquette matters

Review is the main way we transfer context between contributors. On a large
NestJS backend a hurried or hostile review costs more than it saves: authors hide
mistakes, reviewers skim, and the same defect is discovered twice. The goal of
every review is a **better change and a better-informed author**, not a verdict
on the author.

## 2. Tone and expectations

- **Critique the change, not the person.** Say "this query is unbounded" rather
  than "you always write unbounded queries".
- **Assume good faith and missing context.** Ask before concluding intent: "did
  you consider the pagination path?" beats "this ignores pagination".
- **Be specific and actionable.** Point at the file and line, name the problem,
  and, where you can, suggest a path forward.
- **Separate blocking from non-blocking** by prefixing comments with `nit:`,
  `optional:`, or `question:`. An author should never have to guess what must
  change before merge.
- **Praise what is right.** A short "nice, this fixes the race" is cheap and
  keeps the review honest.
- **No sarcasm, no pile-ons.** Once a reviewer has raised a point, others add
  signal, not volume.
- **Keep the record public.** Review comments belong on the pull request so the
  reasoning is searchable later.

## 3. Author norms

1. **Link an issue.** Every pull request links the issue it resolves
   (`CONTRIBUTING.md` §2); reviews start from that context.
2. **Make the diff readable.** Keep the change scoped to the issue. Unrelated
   refactors belong in a separate pull request.
3. **Describe intent.** A short summary — what changed, why, how it was verified
   — lets a reviewer load the change into their head faster.
4. **Respond to every comment.** Either apply the change or explain, with
   reasoning, why not. A silent thread blocks the review.
5. **Do not force-push during review.** Add commits so reviewers can see the
   delta; expect approvals to be invalidated by new commits (`CONTRIBUTING.md`
   §9).
6. **Do not resolve your own review threads.** Reviewers resolve; authors answer.
7. **Thank the reviewer.** It costs nothing and encourages thorough review.

## 4. Reviewer norms

1. **Review the change, not a rewrite.** Judge whether the change is correct,
   safe, and appropriately scoped — not whether you would have written it
   differently.
2. **Do one thorough pass.** A second round should be reserved for genuinely
   substantive changes, not for style points the tooling already decides.
3. **State the condition for approval.** If a change is close, say exactly what
   would make it mergable; do not leave the author guessing.
4. **Distinguish blocking from optional.** Use the `nit:` / `optional:` / `question:`
   prefixes from §2.
5. **Review within the review SLA** in [`policies/REVIEW_SLA.md`](../policies/REVIEW_SLA.md)
   and `CONTRIBUTING.md` §9, or say when you will.
6. **Recuse when conflicted.** If you are not able to judge the change fairly,
   ask another reviewer to take over and say so.

## 5. Handling disagreement

Disagreement is normal and useful; how we resolve it is what matters.

- **Disagree about the code, not the right to hold an opinion.** State your
  position, the evidence for it, and the condition under which you would be
  persuaded.
- **Prefer the smaller decision.** If two approaches are both correct, prefer the
  one that is easier to review and reverse, and note the trade-off.
- **Escalate rather than loop.** If a thread has gone two rounds without
  converging, move it to a synchronous call or ask a third maintainer to decide.
  Record the outcome on the pull request.
- **A decision is not a defeat.** Once a maintainer resolves an open question,
  follow it; if new evidence appears later, reopen it with that evidence.
- **Conduct problems are not code review.** Route harassment or bad-faith
  behaviour to [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) and
  [`policies/MODERATION.md`](../policies/MODERATION.md), not the comment thread.

## 6. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
