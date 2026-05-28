---
name: review-plugin
description: "Review or align a Power Platform plugin for Equinor internal use, including code-apps, power-pages, model-apps, canvas-apps, mcp-apps, controlled-pilot readiness, DLP, Tech Radar, EDS, MCP, and publication evidence."
argument-hint: "plugin name or plugin path"
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

### 3. Look Up Technology Radar States

For every technology listed with `radarState: "unknown"` in the review record, or any new technology identified in Step 2, **actively look up** the current state:

1. **Check the baseline known facts** in `docs/equinor-alignment/baseline.md` (section "Known relevant radar facts").
2. **If not listed there**, clone the `equinor/techradar` repo (internal) and read the blip file:
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/equinor/techradar.git /tmp/techradar 2>/dev/null
   cd /tmp/techradar && git sparse-checkout set blips 2>/dev/null
   cat blips/<technology_slug>.yaml
   ```
   The `state` field in the YAML gives the current ring (`Adopt`, `Trial`, `Assess`, or `Hold`). Common slugs: `vite.yaml`, `react.yaml`, `model_context_protocol.yaml`.
3. **If the blip file does not exist**, check the web page at `https://techradar.equinor.com/` for the technology name.
4. **If still not found**, mark as `missing-from-radar` (not `unknown`) and document the architecture discussion path.
5. **Clean up** after lookup: `rm -rf /tmp/techradar`

> **Note:** `equinor/techradar` is an internal repository. The clone uses git's credential helper (provided by VS Code / dev container) for authentication. Do not use `curl` against `raw.githubusercontent.com` or `gh api` as neither will have tokens in this environment.

Do not rely solely on the review record's existing `radarState` values — they may be stale. Always re-verify `unknown` and `not-assessed` entries.

### 4. Classify Findings

Classify findings under these headings:

- Ownership and support
- Skill and script safety
- Production interaction
- Power Platform zone and user persona
- Data classification ceiling
- Connector and DLP impact
- Technology Radar status (use results from Step 3)
- EDS and frontend generation
- Manifest and publication readiness
- Local test readiness

### 5. Recommend Status

Use the review outcome rules from `plugin-review-checklist.md`.

Do not recommend `ready-for-internal-pilot` unless all required evidence exists. For a first `code-apps-preview` pass, `controlled-pilot` is the likely maximum until owner, support channel, DLP posture, EDS position, and local install testing are complete.

### 6. Apply Adjustments

If the user has asked to adjust the plugin, make focused edits that add guardrails without refactoring unrelated content.

For `code-apps-preview`, likely adjustments are:

- Add Equinor pilot guidance to plugin README or AGENTS.
- Add non-production environment confirmation before deploy or push steps.
- Add connector and DLP review gates before add-data-source or add-connector steps.
- Add EDS-first guidance for generated React UI, or document a justified exception.
- Add Technology Radar checks for React, Vite, connectors, and any other recommended stack.
- Keep generic connector use as `controlled-pilot` at most until connector-specific review exists.

### 7. Update Review Record

Update the target JSON review record with evidence from the review.

Do not remove blockers unless there is concrete evidence in the repo or from the user.

When updating `technologyRadar.technologies` entries, set:

- `radarState` to the value found in Step 3 (e.g., `adopt`, `trial`, `assess`, `hold`, or `missing-from-radar`).
- `source` to the verification method used (e.g., `equinor/techradar blip fetched 2026-05-28`).

Run:

```bash
node scripts/validate-plugin-reviews.js <review-record-path>
```

### 8. Validate And Summarize

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