---
name: sync-upstream
description: "Fetch, compare, pull, merge, or synchronize plugin, skill, agent, script, or manifest updates from the upstream microsoft/power-platform-skills repository into this Equinor-aligned fork."
argument-hint: "plugin, skill, or path to sync"
user-invocable: true
---

# Sync Upstream

Use this VS Code workspace skill to inspect and selectively synchronize upstream Microsoft changes.

The canonical workflow is maintained in `plugins/equinor-alignment/skills/sync-upstream/SKILL.md`. Read that file first, then apply it to the requested plugin, skill, or path.

Default to read-only discovery:

```bash
git status --short
git branch --show-current
git remote -v
git fetch upstream main --tags
```

If `upstream` is missing, ask before adding `https://github.com/microsoft/power-platform-skills.git`.

Do not overwrite Equinor alignment docs, review records, or guardrails. Summarize upstream changes and ask for approval before editing files.

After any plugin-affecting sync, update the relevant review record and run:

```bash
node scripts/validate-plugin-reviews.js
```