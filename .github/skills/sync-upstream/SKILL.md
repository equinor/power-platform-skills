---
name: sync-upstream
description: "Fetch, compare, and synchronize upstream microsoft/power-platform-skills changes into this Equinor-aligned fork via pull requests. Mirrors unadopted plugins verbatim, intelligently merges adopted ones, and keeps the review surface small."
argument-hint: "plugin, skill, path, or 'all' to sync"
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, EnterPlanMode, ExitPlanMode
model: opus
---

# Sync Upstream Microsoft Changes

Synchronize changes from `microsoft/power-platform-skills` into this fork via **pull requests** on dedicated sync branches. Never merge directly to `main`.

**Direction:** This workflow pulls FROM upstream INTO this fork. Never create, push, or submit pull requests TO the upstream `microsoft/power-platform-skills` repository. All PRs target `origin` (the Equinor fork) only.

**Governing policy:** [docs/equinor-alignment/sync-policy.md](../../../docs/equinor-alignment/sync-policy.md). Read it before starting. The steps below implement it; if they ever disagree, the policy wins.

Default to read-only discovery. Do not apply changes until the user approves the sync plan.

## The Rule That Shapes Everything

A plugin is either **adopted** (`publicationStatus` of `controlled-pilot` or higher) or **tracked** (`defer`, `not-reviewed`, or an unreadable record).

- **Adopted** plugins are merged intelligently and reviewed in full.
- **Tracked** plugins are **mirrored verbatim** from upstream, plus the transforms declared in `docs/equinor-alignment/sync-policy.json`. Never hand-merge, patch, reformat, harden, or add tests to a tracked plugin's tree during a sync. A defect found there is reported upstream and recorded as a blocker, not fixed here.

This is what keeps a sync reviewable. The last sync that ignored it changed 879 files and produced a review loop on plugins nobody has adopted.

## Inputs

- Upstream repository: `https://github.com/microsoft/power-platform-skills.git`
- Upstream branch: `main`
- Sync scope: one plugin, one skill, one file set, or `all`
- Today's date for branch naming

## Workflow

### Phase 1 — Prepare Local Environment

#### 1.1 Check Local State

```bash
git status --short
git branch --show-current
git remote -v
```

If there are uncommitted local changes, stop and ask. Do not proceed on a dirty working tree.

#### 1.2 Ensure Upstream Remote

If no `upstream` remote points to Microsoft, add it:

```bash
git remote add upstream https://github.com/microsoft/power-platform-skills.git
```

#### 1.3 Fetch Upstream

```bash
git fetch upstream main --tags
```

#### 1.4 Stop Early If There Is Nothing To Sync

```bash
BASE=$(git merge-base HEAD upstream/main)
git log --oneline --no-merges "$BASE..upstream/main"    # empty => nothing to do
```

Branches are created later, by the phase that needs them.

### Phase 2 — Resolve Tiers Before Reading Any Diff

```bash
node scripts/check-sync-scope.js --report-only
```

This prints which plugins are adopted and which are tracked, and audits the standing divergence in tracked trees against the last synced upstream baseline. Fix any violation it reports **before** starting the sync; carrying one forward makes the sync diff unreadable.

Record the tier of every plugin the sync touches. Every phase below depends on it.

### Phase 3 — Understand What Upstream Did

#### 3.1 Analyze Git Log

Read the upstream commit history to understand intent, not just diffs:

```bash
git log --oneline --no-merges $(git merge-base HEAD upstream/main)..upstream/main
```

For richer context on significant changes:

```bash
git log --stat --no-merges $(git merge-base HEAD upstream/main)..upstream/main -- plugins/
git log --stat --no-merges $(git merge-base HEAD upstream/main)..upstream/main -- shared/ scripts/ .github/workflows/
```

Summarize the upstream changes by theme (new plugins, skill updates, bug fixes, documentation, structural changes).

#### 3.2 Diff Files

For the full scope:

```bash
git diff --name-status $(git merge-base HEAD upstream/main)..upstream/main
```

For a specific plugin:

```bash
git diff --name-status $(git merge-base HEAD upstream/main)..upstream/main -- plugins/<plugin-dir>
```

Also inspect shared dependencies: `shared/`, `scripts/`, `.claude-plugin/marketplace.json`.

#### 3.3 Classify Files

Classify every changed file by the tier of the plugin that owns it.

| Category              | Criteria                                                                                         | Action                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Mirror**            | Any path under a **tracked** plugin's `plugins/<dir>/` or `evals/<dir>/`                         | Take upstream verbatim, then re-apply declared transforms |
| **Intelligent merge** | **Adopted** plugin trees, and shared files carrying Equinor sections                             | Merge preserving Equinor content                          |
| **Equinor-only**      | `docs/equinor-alignment/**`, `.github/skills/**`, `.github/agents/**`, `.github/instructions/**` | Never overwrite; skip                                     |
| **Review required**   | Scripts, hooks, `.mcp.json`, workflows, or production-interaction patterns                       | Defer until inspected with the user                       |
| **New file**          | Does not exist locally                                                                           | Copy from upstream, then classify by the rules above      |

**Protected paths — never copy from upstream without explicit approval:**

- `docs/equinor-alignment/**`, including `reviews/**`
- Any file containing `<!-- equinor-start -->` / `<!-- equinor-end -->` markers
- Any file with Equinor-specific sections (look for: "Equinor", "equinor-alignment", governance references)

#### 3.4 Present The Sync Plan

Enter plan mode. Present the file table, the plugin tiers from Phase 2, and the generated scope block:

```bash
node scripts/check-sync-scope.js --markdown
```

Ask for approval before applying anything.

### Phase 4 — Mirror Pull Request (Tracked Plugins)

Skip this phase entirely when the sync touches no tracked plugin.

```bash
git checkout main && git pull origin main
git checkout -b "sync/upstream-$(date +%Y-%m-%d)-mirror"
```

#### 4.1 Take Upstream's Tree Wholesale

For each tracked plugin the sync touches. `git checkout` alone leaves behind files upstream deleted, so clear the tree first:

```bash
git rm -r --quiet --ignore-unmatch plugins/<dir> evals/<dir>
git checkout upstream/main -- plugins/<dir> evals/<dir>
```

Do not read these files looking for problems. That is not what this phase is for.

#### 4.2 Re-Apply The Declared Transforms

Only the transforms in `docs/equinor-alignment/sync-policy.json` may be re-applied. Their `paths` lists are the definition of what each one touches.

- `fork-repointing` — replace `microsoft/power-platform-skills` with `equinor/power-platform-skills` in the plugin manifests, README install instructions, and the `report-issue` workflow. Do not repoint references the fork has deliberately left pointing upstream.
- `telemetry-exclusion` — delete the telemetry stack and remove its hook registrations, requires, and workflow markers.
- `carried-fix` — closed to new entries. Re-apply the existing ones only.

#### 4.3 Verify, Commit, And Open The Pull Request

```bash
node scripts/check-sync-scope.js
git add -A
git commit -m "sync: mirror upstream tracked plugins $(date +%Y-%m-%d)"
git push origin "sync/upstream-$(date +%Y-%m-%d)-mirror"
```

The pull request body must state that the tree is machine-verified against upstream and does not warrant line-by-line review, and must include the output of `node scripts/check-sync-scope.js --markdown`.

Merge this pull request before starting Phase 5.

### Phase 5 — Alignment Pull Request (Everything Else)

```bash
git checkout main && git pull origin main
git checkout -b "sync/upstream-$(date +%Y-%m-%d)-alignment"
```

This branch carries adopted plugins, shared surfaces, repository policy, and review record updates. It should be small enough to review properly.

#### 5.1 Intelligent Merge

For files requiring merge, follow this process:

1. **Read the upstream version:**

   ```bash
   git show upstream/main:<path>
   ```

2. **Read the local version** (already on disk).

3. **Identify Equinor-specific sections.** Look for:
   - Markers: `<!-- equinor-start -->` / `<!-- equinor-end -->`
   - Sections referencing Equinor governance, alignment, internal URLs
   - Added headings, paragraphs, or configuration blocks not present upstream
   - Modified text that adds Equinor context to upstream content

4. **Merge strategy:**
   - Accept all new upstream content (new sections, updated descriptions, new plugin references).
   - Preserve all Equinor-specific additions in their current position.
   - When upstream modifies a paragraph that Equinor also modified, prefer the Equinor version but append any genuinely new information from upstream.
   - When upstream adds a new section, insert it in the appropriate location without displacing Equinor sections.

5. **Edit the file** with the merged content.

#### 5.2 Shared Surface Side Effects

Tier scoping stops at the plugin boundary. When the sync changes anything under `shared/**`, `scripts/**`, `.github/workflows/**`, `.github/instructions/**`, `AGENTS.md`, `CLAUDE.md`, or `marketplace.json`, work out the effect on **every** consuming plugin, tracked ones included:

- **`shared/skills/<skill>/`** — each adopting plugin carries a physical copy at `plugins/<plugin>/skills/<skill>/`. Refresh every copy in the same change. `node scripts/check-sync-scope.js` fails on drift, and reports plugins shipping a self-contained variant that a shared edit will never reach.
- **`scripts/**`\*\* — a validator change can fail the build on a plugin nobody has adopted. Run the repository validators against the whole tree, not just the adopted plugin.
- **`.github/workflows/**`\*\* — check path filters, permissions, and whether a new test suite has a workflow that actually runs it.
- **Agent context files** — check that guidance written for an adopted plugin does not mislead an agent working on a mirrored one.
- **`marketplace.json`** and its legacy mirror — every entry needs a matching review record, or the installer's adoption gate has nothing to read.

Refreshing a tracked plugin's copy of a shared file belongs in this pull request, not the mirror one.

#### 5.3 Review-Required Files

For scripts, hooks, `.mcp.json`, and production-interaction files:

1. Show the diff to the user.
2. Explain what the upstream change does (using git log context).
3. Flag any security, DLP, or production-interaction concerns.
4. Apply only after explicit user approval.

### Phase 6 — Review Records

#### 6.1 Identify Affected Plugins

```bash
git diff --name-only main..HEAD -- plugins/ evals/ | cut -d/ -f2 | sort -u
```

Split them by tier using the Phase 2 output. Their records live in `docs/equinor-alignment/reviews/<plugin-name>.json`, keyed by marketplace name rather than directory name.

#### 6.2 Adopted Plugins: Full Re-Review

For each **adopted** plugin the sync modified:

1. Invoke the **review-plugin** skill (`.github/skills/review-plugin/SKILL.md`) against the plugin.
2. Focus the review on:
   - New or changed skills, scripts, agents, hooks.
   - Changes to production-interaction patterns.
   - New MCP dependencies.
   - New technology dependencies (check Tech Radar).
3. Update the review record with new evidence, any new blockers, and updated `radarState` entries.

#### 6.3 Tracked Plugins: Mechanical Refresh Only

For each **tracked** plugin the sync modified, do **not** run a full review. That is what produced the unactionable finding volume this policy exists to stop. Update the record mechanically:

- `ownership.upstreamVersion` — the plugin's new version.
- `evidence` — one entry naming the synced upstream range.
- `blockers` — add an entry **only** when the sync introduced a materially new risk class, such as a first destructive code path, a new MCP server, or a new external network call. State the risk; do not review the implementation.
- `technologyRadar` — add an entry only when the sync introduced a genuinely new technology.

Leave `publicationStatus` unchanged. A sync never promotes a plugin.

#### 6.4 Validate

```bash
node scripts/validate-plugin-reviews.js
node scripts/check-sync-scope.js
```

### Phase 7 — Commit And Open The Alignment Pull Request

#### 7.1 Stage And Commit

Split commits by category so the diff reads in order:

- `sync: merge upstream changes preserving Equinor content`
- `sync: refresh shared skill copies across plugins`
- `sync: update review records for affected plugins`

#### 7.2 Push Branch

```bash
git push origin "sync/upstream-$(date +%Y-%m-%d)-alignment"
```

#### 7.3 Create Pull Request

The pull request targets `origin` (the Equinor fork), merging the sync branch into `main`. Never target the upstream Microsoft repository.

```bash
gh pr create \
  --base main \
  --head "sync/upstream-$(date +%Y-%m-%d)-alignment" \
  --title "sync: upstream alignment $(date +%Y-%m-%d)"
```

Body:

```markdown
## Upstream Sync — Alignment

**Upstream range:** `<merge-base>..<upstream-head>`
**Mirror pull request:** #<number>

<output of: node scripts/check-sync-scope.js --markdown>

### Adopted plugin re-reviews

<findings per adopted plugin>

### Shared surface side effects

<each shared file changed, and the consuming plugins checked>

### Tracked plugin record refreshes

<plugin: new upstream version, new blockers if any>

### Defects observed in tracked plugins

<one line each, with the upstream report link and the blocker entry. Not fixed here.>

### Deferred items

<files not synced and why>

### Validation

- [ ] `node scripts/check-sync-scope.js` passes
- [ ] `node scripts/validate-plugin-reviews.js` passes
- [ ] No Equinor-specific content was overwritten
- [ ] New scripts, hooks, and workflows inspected for safety

### Remaining owner decisions

<items requiring a human decision>
```

If `gh` is not authenticated, output the full PR creation command for the user to run manually.

> [!IMPORTANT]
> Reviewers should apply `.github/skills/code-review/SKILL.md`. Link it from the pull request body whenever the diff is large.

### Phase 8 — Summary Report

Report to the user:

- Both branch names and pull request URLs (or the creation commands).
- Upstream commit range analyzed, and the themes found in its history.
- File counts per review bucket from `check-sync-scope.js`.
- Tracked plugins mirrored, and the transforms re-applied to each.
- Shared surfaces changed, and the consuming plugins checked for side effects.
- Adopted plugin re-review findings.
- Tracked plugin record refreshes.
- Defects observed in tracked plugins, with the upstream report and blocker entry for each.
- Files intentionally not synced and why.
- Validation results.
- Remaining owner decisions or blockers.

## Content Merge Markers

To make future syncs easier, when adding Equinor-specific content to upstream files, wrap additions with markers:

```markdown
<!-- equinor-start: description of addition -->

Equinor-specific content here...

<!-- equinor-end -->
```

This allows the sync workflow to reliably identify and preserve Equinor sections during intelligent merges.

Markers belong in adopted plugins and shared files. A tracked plugin should not need them: if one does, the change is undeclared divergence and the mirror rule was broken.

## Naming Convention

| Pattern             | Example                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Mirror branch       | `sync/upstream-2026-05-28-mirror`                                                         |
| Alignment branch    | `sync/upstream-2026-05-28-alignment`                                                      |
| Same-day duplicate  | append `-2`, for example `sync/upstream-2026-05-28-mirror-2`                              |
| Commit prefix       | `sync:`                                                                                   |
| Pull request titles | `sync: mirror upstream tracked plugins 2026-05-28`, `sync: upstream alignment 2026-05-28` |
