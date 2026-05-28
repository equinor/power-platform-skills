---
name: sync-upstream
description: "Fetch, compare, pull, merge, or synchronize plugin, skill, agent, script, or manifest updates from the upstream microsoft/power-platform-skills repository into this Equinor-aligned fork."
argument-hint: "plugin, skill, or path to sync"
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, EnterPlanMode, ExitPlanMode
model: opus
---

# Sync Upstream Microsoft Changes

Use this workflow to inspect and selectively synchronize changes from `microsoft/power-platform-skills` into this fork while preserving Equinor alignment evidence.

Default to read-only discovery. Do not replace plugin files until the user approves the sync plan.

## Inputs

- Upstream repository: `https://github.com/microsoft/power-platform-skills.git`
- Upstream branch: `main`
- Sync scope: one plugin, one skill, or one file set
- Target local branch

## Workflow

### 1. Check Local State

Run:

```bash
git status --short
git branch --show-current
git remote -v
```

If there are unrelated local changes, do not overwrite them. Ask whether to continue after explaining the risk.

### 2. Ensure Upstream Remote

If no `upstream` remote points to Microsoft, add it:

```bash
git remote add upstream https://github.com/microsoft/power-platform-skills.git
```

Fetch updates:

```bash
git fetch upstream main --tags
```

### 3. Inspect Changes Before Editing

For a whole plugin:

```bash
git diff --name-status HEAD..upstream/main -- plugins/<plugin-dir>
```

For one skill:

```bash
git diff --name-status HEAD..upstream/main -- plugins/<plugin-dir>/skills/<skill-name>
```

Also inspect shared files that the skill depends on, such as `shared/`, `references/`, `agents/`, `scripts/`, hooks, `.mcp.json`, and plugin manifests.

Summarize:

- Changed upstream files.
- Files with local Equinor guardrails.
- Files that are safe to copy directly.
- Files that need manual merge.
- Review records that must be updated afterward.

### 4. Plan The Sync

Enter plan mode before changing files. Present one of these sync modes:

| Mode | Use when | Method |
| --- | --- | --- |
| Inspect only | User only wants to know what changed | No edits. |
| Direct copy | Upstream-owned file has no Equinor edits | `git checkout upstream/main -- <path>` after approval. |
| Manual merge | File contains Equinor guardrails or local changes | Read upstream content with `git show`, then edit carefully. |
| Defer | Change affects governance, DLP, MCP, EDS, or production behavior | Record blocker and ask for owner review. |

Never direct-copy these without explicit user approval:

- `docs/equinor-alignment/**`
- Review records in `docs/equinor-alignment/reviews/**`
- Any file that already contains Equinor-specific guardrails

### 5. Apply Approved Changes

For direct copy, use:

```bash
git checkout upstream/main -- <path>
```

For manual merge, inspect upstream content with:

```bash
git show upstream/main:<path>
```

Then edit the local file while preserving Equinor guardrails.

### 6. Re-Apply Alignment Review

After any sync that affects a plugin:

- Re-read `docs/equinor-alignment/baseline.md`.
- Update the affected review record in `docs/equinor-alignment/reviews/`.
- Add upstream commit or diff evidence to the review record notes or evidence.
- Reconsider blockers for DLP, Tech Radar, MCP, EDS, production interaction, scripts, and publication.

### 7. Validate

Run:

```bash
node scripts/validate-plugin-reviews.js
git diff --check -- <changed-paths>
```

If package, script, or plugin-specific tests exist for the touched plugin, run the narrowest relevant test.

### 8. Summarize

Report:

- Upstream ref fetched.
- Sync scope.
- Files changed.
- Files intentionally not synced.
- Review record updates.
- Validation commands run.
- Remaining owner decisions.