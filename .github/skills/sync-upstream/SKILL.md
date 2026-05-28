---
name: sync-upstream
description: "Fetch, compare, and synchronize upstream microsoft/power-platform-skills changes into this Equinor-aligned fork via a pull request. Preserves Equinor content, uses git history for context, and triggers plugin re-reviews."
argument-hint: "plugin, skill, path, or 'all' to sync"
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, EnterPlanMode, ExitPlanMode
model: opus
---

# Sync Upstream Microsoft Changes

Synchronize changes from `microsoft/power-platform-skills` into this fork via a **pull request** on a dedicated sync branch. Never merge directly to `main`.

Default to read-only discovery. Do not apply changes until the user approves the sync plan.

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

#### 1.4 Create Sync Branch

Create and switch to a sync branch from the current `main`:

```bash
git checkout main
git pull origin main
git checkout -b sync/upstream-$(date +%Y-%m-%d)
```

If `sync/upstream-{date}` already exists (e.g., multiple syncs in one day), append a sequence number: `sync/upstream-2026-05-28-2`.

### Phase 2 — Discover And Analyze Upstream Changes

#### 2.1 Identify The Change Range

Find the last merged upstream commit (look for sync commits or merge-base):

```bash
git merge-base HEAD upstream/main
```

#### 2.2 Analyze Git Log

Read the upstream commit history to understand intent, not just diffs:

```bash
git log --oneline --no-merges $(git merge-base HEAD upstream/main)..upstream/main
```

For richer context on significant changes:

```bash
git log --stat --no-merges $(git merge-base HEAD upstream/main)..upstream/main -- plugins/
git log --stat --no-merges $(git merge-base HEAD upstream/main)..upstream/main -- shared/
```

Summarize the upstream changes by theme (new plugins, skill updates, bug fixes, documentation, structural changes).

#### 2.3 Diff Files

For the full scope:

```bash
git diff --name-status $(git merge-base HEAD upstream/main)..upstream/main
```

For a specific plugin:

```bash
git diff --name-status $(git merge-base HEAD upstream/main)..upstream/main -- plugins/<plugin-dir>
```

Also inspect shared dependencies: `shared/`, `scripts/`, `.claude-plugin/marketplace.json`.

#### 2.4 Classify Files

Classify every changed file into one of these categories:

| Category | Criteria | Action |
| --- | --- | --- |
| **Direct copy** | File has no Equinor-specific content and is fully upstream-owned | Copy from upstream |
| **Intelligent merge** | File contains both upstream content and Equinor sections (READMEs, AGENTS.md, shared docs, workflows) | Merge preserving Equinor content |
| **Equinor-only** | File is entirely Equinor-created (`docs/equinor-alignment/**`, review records, `.github/skills/`, `.github/agents/`) | Never overwrite — skip |
| **Review required** | File contains scripts, hooks, `.mcp.json`, or production-interaction patterns | Defer until inspected |
| **New file** | File does not exist locally | Copy from upstream (new content) |

**Protected paths — never direct-copy without explicit approval:**

- `docs/equinor-alignment/**`
- `docs/equinor-alignment/reviews/**`
- Any file containing `<!-- equinor-start -->` / `<!-- equinor-end -->` markers
- Any file with Equinor-specific sections (look for: "Equinor", "equinor-alignment", internal URLs, governance references)

#### 2.5 Present Sync Plan

Enter plan mode. Present a table showing each file, its category, and proposed action. Ask user for approval before proceeding.

### Phase 3 — Apply Changes

#### 3.1 Direct Copy Files

For files classified as direct copy or new:

```bash
git checkout upstream/main -- <path>
```

#### 3.2 Intelligent Merge

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

#### 3.3 Review-Required Files

For scripts, hooks, `.mcp.json`, and production-interaction files:

1. Show the diff to the user.
2. Explain what the upstream change does (using git log context).
3. Flag any security, DLP, or production-interaction concerns.
4. Apply only after explicit user approval.

### Phase 4 — Re-Review Affected Plugins

#### 4.1 Identify Affected Reviewed Plugins

Check which plugins were touched:

```bash
git diff --name-only main..HEAD -- plugins/ | cut -d/ -f2 | sort -u
```

For each affected plugin, check if a review record exists:

```bash
ls docs/equinor-alignment/reviews/<plugin-name>.json 2>/dev/null
```

#### 4.2 Trigger Plugin Re-Review

For each previously reviewed plugin that was modified by this sync:

1. Invoke the **review-plugin** skill (`.github/skills/review-plugin/SKILL.md`) against the plugin.
2. Focus the review on:
   - New or changed skills, scripts, agents, hooks.
   - Changes to production-interaction patterns.
   - New MCP dependencies.
   - New technology dependencies (check Tech Radar).
3. Update the review record with:
   - New `lastReviewedUpstreamCommit` evidence.
   - Any new blockers discovered.
   - Updated `radarState` entries if new technologies appeared.

#### 4.3 Validate Review Records

```bash
node scripts/validate-plugin-reviews.js
```

### Phase 5 — Commit And Create Pull Request

#### 5.1 Stage And Commit

```bash
git add -A
git commit -m "sync: upstream microsoft/power-platform-skills $(date +%Y-%m-%d)

Upstream range: $(git merge-base main upstream/main)..$(git rev-parse upstream/main)
Affected plugins: <list>
Merge strategy: direct-copy (<n>), intelligent-merge (<n>), deferred (<n>)"
```

If the changeset is large, split into multiple commits by category:
- `sync: direct-copy upstream files` — for files taken as-is
- `sync: merge upstream changes preserving Equinor content` — for intelligently merged files
- `sync: update review records for affected plugins` — for review record updates

#### 5.2 Push Branch

```bash
git push origin sync/upstream-$(date +%Y-%m-%d)
```

#### 5.3 Create Pull Request

```bash
gh pr create \
  --base main \
  --head "sync/upstream-$(date +%Y-%m-%d)" \
  --title "sync: upstream microsoft/power-platform-skills $(date +%Y-%m-%d)" \
  --body "$(cat <<'EOF'
## Upstream Sync

**Upstream range:** `<merge-base>..<upstream-head>`
**Sync date:** $(date +%Y-%m-%d)

### Changes Summary

<table of files with category and action>

### Plugin Re-Reviews

<summary of re-review findings for affected plugins>

### Deferred Items

<files not synced and reason>

### Validation

- [ ] `node scripts/validate-plugin-reviews.js` passes
- [ ] No Equinor-specific content was overwritten
- [ ] Review records updated for affected plugins
- [ ] New scripts/hooks inspected for safety

### Remaining Owner Decisions

<list of items requiring human decision>
EOF
)"
```

If `gh` is not authenticated, output the full PR creation command for the user to run manually.

### Phase 6 — Summary Report

Report to the user:

- Sync branch name and PR URL (or creation command).
- Upstream commit range analyzed.
- Git log themes (what upstream was working on).
- Files changed with merge strategy for each.
- Files intentionally not synced and why.
- Plugin re-review summaries and updated review records.
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

## Naming Convention

| Pattern | Example |
| --- | --- |
| Branch | `sync/upstream-2026-05-28` |
| Branch (same-day duplicate) | `sync/upstream-2026-05-28-2` |
| Commit prefix | `sync:` |
| PR title | `sync: upstream microsoft/power-platform-skills 2026-05-28` |