---
name: review-plugin
description: "Review or align a Power Platform plugin for Equinor internal use, including code-apps, power-pages, model-apps, canvas-apps, mcp-apps, controlled-pilot readiness, DLP, Tech Radar, EDS, MCP, and publication evidence."
argument-hint: "plugin name or plugin path"
user-invocable: true
---

# Review Plugin

Use this VS Code workspace skill to run the Equinor plugin review workflow.

The canonical workflow is maintained in `plugins/equinor-alignment/skills/review-plugin/SKILL.md`. Read that file first, then apply it to the requested plugin.

Always load these alignment sources before deciding status:

- `docs/equinor-alignment/baseline.md`
- `docs/equinor-alignment/plugin-review-checklist.md`
- `docs/equinor-alignment/plugin-review.schema.json`
- The target review record in `docs/equinor-alignment/reviews/`

After editing a review record, run:

```bash
node scripts/validate-plugin-reviews.js
```

For `code-apps-preview`, start with deploy confirmation, connector/DLP gates, EDS guidance, Technology Radar checks, and generic connector risk.