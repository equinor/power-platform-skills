---
name: code-review
description: Review scope and depth rules for pull requests in this Equinor fork of microsoft/power-platform-skills. Use when reviewing any pull request, especially upstream sync PRs, to decide which files warrant deep review and which are out of adoption scope.
---

# Pull Request Review Scope

This repository is a **fork** of [microsoft/power-platform-skills][upstream_repo]. Most content here is not written by Equinor, it is mirrored from upstream. Reviewing it as if it were newly authored Equinor code produces large volumes of findings that nobody can action, on plugins nobody has adopted yet.

Read this before reviewing, and calibrate depth accordingly. The governing policy is [docs/equinor-alignment/sync-policy.md](../../../docs/equinor-alignment/sync-policy.md); this skill is how a reviewer applies it.

## Start By Running The Partition

Do not read the diff first. Ask the tool which files are even yours to judge:

```bash
git fetch upstream main
node scripts/check-sync-scope.js --base origin/main --head HEAD --report-only
```

It assigns every changed file to a bucket and prints the review surface. On an upstream sync that is typically well under a fifth of the diff.

| Bucket                                    | Review depth                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Mirrored from upstream                    | **None.** Byte-identical to the last synced upstream commit. Confirm the count and skip.                  |
| Declared fork transform                   | Verify the transform was applied correctly. Nothing else.                                                 |
| Undeclared divergence in a tracked plugin | Policy violation. Ask for it to be reverted to upstream, or for a transform to be declared and justified. |
| Adopted plugin                            | Full.                                                                                                     |
| Shared surface                            | Full, plus the side effect on every consuming plugin.                                                     |
| Equinor-authored governance               | Full.                                                                                                     |
| Repository policy and metadata            | Full.                                                                                                     |

The checker also reports how many full-depth files are byte-identical to upstream. For those, the question is whether it is safe to run here, not how it is written.

## Adoption status decides review depth

`docs/equinor-alignment/reviews/<plugin>.json` is the source of truth. Check `publicationStatus` for the plugin a file belongs to. Do not rely on the list below if it disagrees with the records.

| `publicationStatus`                                         | Meaning                                                             | Review depth                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `controlled-pilot`, `ready-for-internal-pilot`, `published` | Adopted. People use it.                                             | **Full depth.** Correctness, security, and Equinor alignment all in scope. |
| `defer`, `not-reviewed`                                     | Synced but **not adopted**. Not recommended for use, not evaluated. | **Sync correctness only.** See below.                                      |

At the time of writing, `code-apps-preview` is the only plugin at `controlled-pilot`. Every other plugin is `defer`.

## Reviewing a tracked (`defer`) plugin

A `defer` plugin is present so the fork stays close to upstream, not because Equinor has assessed it. Its known gaps are already recorded in the `blockers` array of its review record, and merging does not imply approval.

**In scope:**

- The sync itself was applied correctly: no fork-local content silently overwritten, no half-applied change, no broken reference to a file the fork deliberately excludes.
- Anything that executes in this repository or in CI regardless of adoption, such as workflow permissions, hooks wired by a plugin manifest, or a script a repository-wide validator runs.
- Secrets, credentials, real environment or tenant identifiers, and internal hosts. These matter everywhere, always.

**Out of scope, do not report:**

- Code quality, style, naming, or architecture in unmodified upstream source.
- Latent defects in upstream code that the sync merely copied.
- Missing tests, docs, or hardening for capabilities Equinor has not adopted.
- Anything already listed in that plugin's `blockers` array. It is known and tracked.

### What to do with a real defect you found in a tracked plugin

Finding one is useful. Patching it here is not: the fix forks the file, conflicts on every future sync, and hides the defect from upstream where every consumer needs it. The path is:

1. **Report it upstream.** That is where Equinor gets the fix too.
2. **Ask for it to be recorded** in the plugin's `blockers` array in `docs/equinor-alignment/reviews/`, so the next adoption decision sees it.
3. **One note in the pull request conversation**, not a thread per occurrence, and not a change request.

Patching upstream source inside the fork requires a declared transform in `docs/equinor-alignment/sync-policy.json`. The `carried-fix` transform is closed to new entries precisely because this route was taken once already.

## Reviewing an upstream sync pull request

A sync should arrive as **two** pull requests, because one pull request should carry one review depth:

1. A **mirror** pull request (`sync/upstream-*-mirror`) holding tracked plugin trees taken verbatim from upstream. Review it by confirming `node scripts/check-sync-scope.js` passes and that the transform count matches what the body claims. Do not read the files.
2. An **alignment** pull request (`sync/upstream-*-alignment`) holding adopted plugins, shared surfaces, repository policy, and review records. This is where review effort belongs.

If a sync arrives as a single large pull request, say so and ask for the split before reviewing. That is a cheaper conversation than the review it would otherwise produce.

If you need to partition by hand, for example on a branch where the checker cannot resolve the upstream baseline:

```bash
git fetch upstream main
git diff --name-only origin/main..HEAD | while read -r f; do
  if git cat-file -e "upstream/main:$f" 2>/dev/null; then
    [ "$(git rev-parse "HEAD:$f")" = "$(git rev-parse "upstream/main:$f")" ] \
      && echo "IDENTICAL $f" || echo "FORK-DIFF $f"
  else
    echo "NOT-UPSTREAM $f"
  fi
done | tee /tmp/review-buckets.txt | awk '{print $1}' | sort | uniq -c
```

Then read only what matters:

```bash
grep -E '^(FORK-DIFF|NOT-UPSTREAM)' /tmp/review-buckets.txt | cut -d' ' -f2-
```

- **`IDENTICAL`** — byte-identical to `upstream/main`. Mechanically copied, not hand-edited. Confirm the count, then skip. These files are the bulk of the diff and carry no Equinor decision.
- **`FORK-DIFF`** — differs from upstream. **This is the review surface.** Every one of these is a deliberate fork decision. Many are only a `microsoft` to `equinor` re-pointing; the rest deserve real attention.
- **`NOT-UPSTREAM`** — Equinor-authored files (review records under `docs/equinor-alignment/`) or files upstream deleted.

Judge a sync pull request on the `FORK-DIFF` and `NOT-UPSTREAM` buckets. A finding inside an `IDENTICAL` file is a finding about upstream, not about the pull request.

## Always in scope, on every pull request

Regardless of plugin status:

- Credentials, tokens, connection IDs, real environment or tenant identifiers, internal hosts, and anything not classified `OPEN`. This repository is public, so its content and issues are `OPEN`; `EQUINOR INTERNAL` or above does not belong here.
- Repository-level policy and metadata: `CODEOWNERS`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, `marketplace.json` and its legacy mirror, `.github/workflows/**`, `.claude/settings.json`, `scripts/**`.
- Equinor-specific content being lost: `docs/equinor-alignment/**`, EDS guidance in `plugins/code-apps/**`, and the deliberate exclusion of the upstream telemetry stack.

## Shared surfaces reach plugins nobody adopted

Tier scoping stops at the plugin boundary. A change under `shared/**`, `scripts/**`, `.github/workflows/**`, `.github/instructions/**`, `AGENTS.md`, `CLAUDE.md`, or `marketplace.json` is consumed by adopted and tracked plugins alike, and its effect on **all** of them is in scope even though the tracked plugins' own code is not.

What to check:

- **Shared skills** are written once under `shared/skills/` and physically copied into each adopting plugin. A shared edit is half-applied until every copy is refreshed. The checker fails on drift, and reports plugins that ship a self-contained variant a shared edit will never reach.
- **Repository validators** in `scripts/` run against every plugin. A new rule can fail the build on an unadopted tree.
- **Workflows** need path filters that actually cover the tests they run.
- **Agent context files** must not give guidance that is right for an adopted plugin and wrong for a mirrored one.
- **`marketplace.json`** entries need a matching review record, or the installer's adoption gate has nothing to read.

## Reporting

- Say which bucket and which plugin status a finding falls under, so its priority is obvious.
- Group repeated instances of one issue into a single thread.
- Prefer no comment over a speculative one on a tracked plugin. Volume on unadopted code buries the findings that matter.
- Do not re-raise a point already answered in the pull request conversation.

<!-- references -->

[upstream_repo]: https://github.com/microsoft/power-platform-skills
