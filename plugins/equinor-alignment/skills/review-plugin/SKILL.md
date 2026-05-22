---
name: review-plugin
description: Use when reviewing or aligning a Power Platform plugin for Equinor internal use, including code-apps, power-pages, model-apps, canvas-apps, mcp-apps, plugin review records, controlled-pilot readiness, DLP, Tech Radar, EDS, MCP, and publication evidence.
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, EnterPlanMode, ExitPlanMode
model: opus
---

# Review Plugin For Equinor Alignment

Use this workflow to review one plugin at a time against the Equinor alignment baseline. Start with `code-apps-preview` unless the user names another plugin.

## Inputs

- Target plugin name, for example `code-apps-preview`.
- Target plugin directory, for example `plugins/code-apps`.
- Existing review record, for example `docs/equinor-alignment/reviews/code-apps-preview.json`.

## Workflow

### 1. Load Alignment Sources

Read:

- `docs/equinor-alignment/baseline.md`
- `docs/equinor-alignment/plugin-review-checklist.md`
- `docs/equinor-alignment/plugin-review.schema.json`
- The target review record in `docs/equinor-alignment/reviews/`

### 2. Inspect The Target Plugin

Read only the relevant local files needed to answer the checklist:

- `.claude-plugin/plugin.json`
- `README.md`
- `AGENTS.md` or `CLAUDE.md`
- `skills/*/SKILL.md`
- `agents/*.md`
- `shared/` and `references/` files used by the target skills
- `scripts/`, `hooks/`, and `.mcp.json` if they exist

Keep the first pass narrow. For `code-apps-preview`, prioritize:

- `plugins/code-apps/README.md`
- `plugins/code-apps/AGENTS.md`
- `plugins/code-apps/shared/shared-instructions.md`
- `plugins/code-apps/shared/development-standards.md`
- `plugins/code-apps/shared/connector-reference.md`
- `plugins/code-apps/skills/create-code-app/SKILL.md`
- `plugins/code-apps/skills/add-datasource/SKILL.md`
- `plugins/code-apps/skills/add-connector/SKILL.md`
- Connector-specific skills that the pilot intends to test

### 3. Classify Findings

Classify findings under these headings:

- Ownership and support
- Skill and script safety
- Production interaction
- Power Platform zone and user persona
- Data classification ceiling
- Connector and DLP impact
- Technology Radar status
- EDS and frontend generation
- Manifest and publication readiness
- Local test readiness

### 4. Recommend Status

Use the review outcome rules from `plugin-review-checklist.md`.

Do not recommend `ready-for-internal-pilot` unless all required evidence exists. For a first `code-apps-preview` pass, `controlled-pilot` is the likely maximum until owner, support channel, DLP posture, EDS position, and local install testing are complete.

### 5. Apply Adjustments

If the user has asked to adjust the plugin, make focused edits that add guardrails without refactoring unrelated content.

For `code-apps-preview`, likely adjustments are:

- Add Equinor pilot guidance to plugin README or AGENTS.
- Add non-production environment confirmation before deploy or push steps.
- Add connector and DLP review gates before add-data-source or add-connector steps.
- Add EDS-first guidance for generated React UI, or document a justified exception.
- Add Technology Radar checks for React, Vite, connectors, and any other recommended stack.
- Keep generic connector use as `controlled-pilot` at most until connector-specific review exists.

### 6. Update Review Record

Update the target JSON review record with evidence from the review.

Do not remove blockers unless there is concrete evidence in the repo or from the user.

Run:

```bash
node scripts/validate-plugin-reviews.js <review-record-path>
```

### 7. Validate And Summarize

Run the narrowest useful checks:

```bash
node scripts/validate-plugin-reviews.js
git diff --check -- <changed-paths>
```

Summarize:

- Review outcome.
- Files changed.
- Remaining blockers.
- Validation commands run.
- Questions for the plugin owner.