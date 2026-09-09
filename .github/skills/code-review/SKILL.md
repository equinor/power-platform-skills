---
name: code-review
description: Review scope and depth rules for pull requests in this Equinor fork of microsoft/power-platform-skills. Use when reviewing any pull request, especially upstream sync PRs, to decide which files warrant deep review and which are out of adoption scope.
---

# Pull Request Review Scope

This repository is a **fork** of [microsoft/power-platform-skills][upstream_repo]. Most content here is not written by Equinor, it is mirrored from upstream. Reviewing it as if it were newly authored Equinor code produces large volumes of findings that nobody can action, on plugins nobody has adopted yet.

Read this before reviewing, and calibrate depth accordingly.

## Adoption status decides review depth

`docs/equinor-alignment/reviews/<plugin>.json` is the source of truth. Check `publicationStatus` for the plugin a file belongs to. Do not rely on the list below if it disagrees with the records.

| `publicationStatus` | Meaning | Review depth |
| --- | --- | --- |
| `controlled-pilot`, `ready-for-internal-pilot`, `published` | Adopted. People use it. | **Full depth.** Correctness, security, and Equinor alignment all in scope. |
| `defer`, `not-reviewed` | Synced but **not adopted**. Not recommended for use, not evaluated. | **Sync correctness only.** See below. |

At the time of writing, `code-apps-preview` is the only plugin at `controlled-pilot`. Every other plugin is `defer`.

## Reviewing a `defer` plugin

A `defer` plugin is present so the fork stays close to upstream, not because Equinor has assessed it. Its known gaps are already recorded in the `blockers` array of its review record, and merging does not imply approval.

**In scope:**

- The sync itself was applied correctly: no fork-local content silently overwritten, no half-applied change, no broken reference to a file the fork deliberately excludes.
- Anything that executes in this repository or in CI regardless of adoption, such as workflow permissions, hooks wired by a plugin manifest, or a script a repository-wide validator runs.
- Secrets, credentials, real environment or tenant identifiers, and internal hosts. These matter everywhere, always.

**Out of scope, do not report:**

- Code quality, style, naming, or architecture in unmodified upstream source.
- Latent defects in upstream code that the sync merely copied. If one is genuinely serious, note it once in the pull request conversation so it can be recorded as a blocker and reported upstream. Do not open a thread per occurrence.
- Missing tests, docs, or hardening for capabilities Equinor has not adopted.
- Anything already listed in that plugin's `blockers` array. It is known and tracked.

Patching upstream source inside the fork is usually the wrong fix: it conflicts on every future sync and hides the defect from upstream, where all consumers need it fixed. Prefer recording it in the review record.

## Reviewing an upstream sync pull request

Sync pull requests change hundreds of files. Almost none of them were written here. Partition before reviewing:

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

- Credentials, tokens, connection IDs, real environment or tenant identifiers, internal hosts, and anything above the `EQUINOR-INTERNAL` classification. This repository is public.
- Repository-level policy and metadata: `CODEOWNERS`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, `marketplace.json` and its legacy mirror, `.github/workflows/**`, `.claude/settings.json`, `scripts/**`.
- Equinor-specific content being lost: `docs/equinor-alignment/**`, EDS guidance in `plugins/code-apps/**`, and the deliberate exclusion of the upstream telemetry stack.

## Reporting

- Say which bucket and which plugin status a finding falls under, so its priority is obvious.
- Group repeated instances of one issue into a single thread.
- Prefer no comment over a speculative one on a `defer` plugin. Volume on unadopted code buries the findings that matter.

<!-- references -->

[upstream_repo]: https://github.com/microsoft/power-platform-skills
