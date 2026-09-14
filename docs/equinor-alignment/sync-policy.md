# Upstream Sync And Review Scope Policy

This fork tracks [microsoft/power-platform-skills][upstream_repo]. Most files here are mirrored from upstream rather than authored by Equinor, and the value this repository adds is concentrated in the few plugins Equinor has actually reviewed and adopted.

This policy defines where that value is applied, what the fork is allowed to change, and how deeply each file in a pull request should be reviewed.

Machine-readable companion: [sync-policy.json](sync-policy.json). Enforcement: `node scripts/check-sync-scope.js`.

## Why This Exists

The first upstream sync that carried the whole marketplace changed 879 files and drew 51 reviews. The findings clustered on plugins at `defer`: 12 on `mobile-app`, 8 on `model-apps`, 6 on `power-pages`. The one plugin at `controlled-pilot` drew 2.

Those findings were not wrong, but they were unactionable here:

- The code was written upstream and mirrored, not authored in this fork.
- Fixing it forks the file. That file then conflicts on every future sync, and the defect stays hidden from upstream where every consumer needs it fixed.
- The plugin is not adopted, so no Equinor user is exposed to the defect in the first place.

The result was a review loop that consumed effort without improving anything for an Equinor developer. Prose guidance alone did not stop it, because a reviewer looking at a diff cannot tell a mirrored file from a deliberate fork decision. This policy makes that distinction mechanical.

## Two Tiers

`publicationStatus` in [reviews/](reviews/) is the source of truth. It already gates what `scripts/install.js` will install, and it now also decides sync behaviour and review depth.

| Tier | `publicationStatus` | What it means | Sync behaviour | Review depth |
| --- | --- | --- | --- | --- |
| **Adopted** | `controlled-pilot`, `ready-for-internal-pilot`, `published` | Equinor recommends it, aligns it, and answers for it. Installed by default. | Intelligent merge. Equinor additions preserved. | Full. Correctness, security, and Equinor alignment. |
| **Tracked** | `defer`, `not-reviewed` | Present so the fork stays close to upstream. Opt-in only. Not recommended, not assessed. | Mirrored verbatim from upstream, plus declared transforms. | Sync correctness only. |

A plugin whose review record cannot be read is treated as **tracked**, never adopted. A lookup failure must never silently widen the surface this fork claims to maintain.

> [!NOTE]
> Tracked plugins are deliberately kept in the marketplace. A developer who would otherwise take them from the public upstream gets them here with the fork repointed, the telemetry stack removed, a published review record naming the open blockers, and an installer that refuses to install them implicitly. That is a real improvement over the public repository even before any plugin reaches `controlled-pilot`, and it is why the answer to a defect in a tracked plugin is "record and report it", not "leave it unmentioned".

## The Mirror Rule

A tracked plugin's tree (`plugins/<dir>/` and `evals/<dir>/`) must be byte-identical to the synced upstream baseline, except where a transform in [sync-policy.json](sync-policy.json) declares otherwise.

The baseline is `merge-base(HEAD, upstream/main)`, not upstream's current tip. Files upstream has moved on since the last sync are not fork divergence.

**Do not** hand-merge, reformat, patch, harden, or add tests to a tracked plugin's tree. Take upstream's version:

```bash
git rm -r --quiet --ignore-unmatch plugins/<dir> evals/<dir>
git checkout upstream/main -- plugins/<dir> evals/<dir>
```

Then re-apply the declared transforms and verify with `node scripts/check-sync-scope.js`.

## Declared Fork Transforms

These are the only changes the fork may carry into a tracked plugin. Each is declared in [sync-policy.json](sync-policy.json) with its path patterns, and the checker fails on any divergence outside them.

| Transform | What it changes | Why it applies to every plugin |
| --- | --- | --- |
| `fork-repointing` | Upstream repository references replaced with the Equinor fork, in plugin manifests, README install instructions, and the `report-issue` workflow. | A plugin installed from this fork must send marketplace commands and bug reports here. |
| `telemetry-exclusion` | The upstream 1DS telemetry stack removed, and its hook registrations, requires, and workflow markers neutralised. | Upstream ships instrumentation keys enabled. Mirroring the stack verbatim would emit Equinor usage to a Microsoft collector before any privacy review. |
| `carried-fix` | Upstream defects patched locally. **Closed to new entries.** | Predates this policy. Each entry conflicts on every future sync. |

Adding a transform is a governance change. Justify it in the pull request, and prefer an upstream fix over a new fork-local one.

## Defects Found In A Tracked Plugin

Finding a real defect in a tracked plugin is useful. Patching it here is not. The path is:

1. **Report it upstream.** That is where every consumer, Equinor included, gets the fix.
2. **Record it** in the plugin's `blockers` array in [reviews/](reviews/), so the next adoption decision sees it.
3. **Do not open a pull request thread per occurrence.** One note in the pull request conversation is enough to get it recorded.

Exceptions, which are in scope everywhere and always:

- Credentials, tokens, connection identifiers, real environment or tenant identifiers, internal hosts, and anything not classified `OPEN`.
- Anything that executes in this repository or in CI regardless of adoption: workflow permissions, hooks a plugin manifest wires up, or a script a repository-wide validator runs.
- The sync itself being applied incorrectly: fork content silently overwritten, a half-applied change, or a broken reference to a file this fork deliberately excludes.

## Shared Surfaces And Side Effects

Tier scoping stops at the plugin boundary. Some content is consumed by adopted and tracked plugins alike, and a change there must be checked against **every** consumer, including tracked ones.

| Surface | Consumers | Side effect to check |
| --- | --- | --- |
| `shared/**` | Every adopting plugin carries a physical copy at `plugins/<plugin>/skills/<skill>/`. | A shared edit is half-applied until every copy is refreshed. `scripts/check-sync-scope.js` fails on drift and reports plugins that ship a self-contained variant instead. |
| `scripts/**` | Repository-wide validators and the installer. | A validator change can fail the build on a plugin nobody has adopted. |
| `.github/workflows/**` | CI for all plugins. | Path filters, permissions, and secrets exposure. |
| `.github/instructions/**`, `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` | Every agent session in this repository. | Guidance that is correct for an adopted plugin but wrong for a mirrored one. |
| `marketplace.json` and its legacy mirror | The installer and its adoption gate. | A plugin entry with no matching review record becomes uninstallable, or loses its gate. |

Refreshing a tracked plugin's copy of a shared file is a legitimate change to a tracked tree. It falls under `fork-repointing` when the shared edit was a repointing, and it belongs in the alignment pull request, not the mirror one.

## Pull Request Shape

Split an upstream sync into two sequential pull requests. One pull request, one review depth.

1. **Mirror pull request** (`sync/upstream-YYYY-MM-DD-mirror`). Tracked plugin trees taken verbatim from upstream, plus their declared transforms. Typically the large majority of the files. Verified by `node scripts/check-sync-scope.js`, not read line by line.
2. **Alignment pull request** (`sync/upstream-YYYY-MM-DD-alignment`), cut from `main` after the mirror merges. Adopted plugins, shared surfaces, repository policy, and review record updates. Small enough to review properly.

Keep a single pull request only when the sync touches no tracked plugin, or when the whole change is under roughly 30 files.

Every sync pull request body must carry the generated review scope block:

```bash
node scripts/check-sync-scope.js --markdown
```

## Review Depth By Bucket

`node scripts/check-sync-scope.js` assigns every changed file to one bucket.

| Bucket | Review depth |
| --- | --- |
| Mirrored from upstream | None. Confirm the count and move on. |
| Declared fork transform | Verify the transform was applied correctly. Nothing else. |
| Undeclared divergence in a tracked plugin | Policy violation. Revert to upstream, or declare a transform and justify it. |
| Adopted plugin | Full. |
| Shared surface | Full, plus the side effect on every consuming plugin. |
| Equinor-authored governance | Full. |
| Repository policy and metadata | Full. |

A full-depth file can still be byte-identical to upstream, and the checker says so. For those, the question is whether it is safe to run here, not how it is written.

## Promoting A Plugin To Adopted

When a plugin's `publicationStatus` reaches `controlled-pilot`, the mirror rule stops applying to it and full review begins. Before merging the promotion:

1. Complete the review in [plugin-review-checklist.md](plugin-review-checklist.md) and update the review record.
2. Run `node scripts/validate-plugin-reviews.js`.
3. Run `node scripts/check-sync-scope.js` so the standing divergence in that tree becomes visible at full depth.
4. Remove any `carried-fix` entry for the plugin, or restate it as a deliberate fork decision with an owner.

Demotion works the same way in reverse: the tree must be returned to upstream's version, minus the declared transforms.

## Running The Check

```bash
git fetch upstream main
node scripts/check-sync-scope.js                    # audit and partition against origin/main
node scripts/check-sync-scope.js --markdown         # review scope block for a PR body
node scripts/check-sync-scope.js --json             # machine-readable
node scripts/check-sync-scope.js --report-only      # never exit non-zero
```

It exits non-zero on an undeclared divergence in a tracked tree or on stale per-plugin copies of a shared skill. CI runs it through `.github/workflows/validate-sync-scope.yml`.

<!-- references -->

[upstream_repo]: https://github.com/microsoft/power-platform-skills
