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

## Pick The Right Mode First

This skill has two modes, and running the wrong one is the most expensive mistake it can make. Check `publicationStatus` in `docs/equinor-alignment/reviews/<plugin>.json` before anything else.

| Trigger                                                                                                            | Plugin tier | Mode                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| An adoption decision, a promotion request, or a sync touching an **adopted** plugin (`controlled-pilot` or higher) | Adopted     | **Full review.** Run the whole workflow below.                                                                                  |
| A sync touching a **tracked** plugin (`defer`, `not-reviewed`)                                                     | Tracked     | **Record refresh only.** Jump to [Tracked Plugin Record Refresh](#tracked-plugin-record-refresh). Do not run the full workflow. |
| The user explicitly asks to assess a tracked plugin for promotion                                                  | Tracked     | **Full review**, to produce the evidence a promotion needs.                                                                     |

A full review of a tracked plugin outside a promotion request generates findings that cannot be actioned in this fork, because its code is mirrored from upstream and fixing it here forks the file. See [sync-policy.md](../../../docs/equinor-alignment/sync-policy.md).

## Prerequisites

- **Techradar plugin** — Install the `techradar` plugin from `equinor/techradar` for Tech Radar lookups. If installed, the `techradar-check` skill handles blip resolution automatically via GitHub MCP. If not installed, this skill falls back to direct GitHub MCP calls or a local clone.

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

For every technology listed with `radarState: "unknown"` in the review record, or any new technology identified in Step 2, **actively look up** the current state.

This step uses the same approach as the `techradar-check` skill from `equinor/techradar`. If that plugin is installed, invoke it directly. Otherwise follow the procedure below.

1. **Check the baseline known facts** in `docs/equinor-alignment/baseline.md` (section "Known relevant radar facts").
2. **If not listed there**, use GitHub MCP to read the blip directly from `equinor/techradar`:
   - First, list blip filenames: `get_file_contents(owner: "equinor", repo: "techradar", path: "blips")`
   - Infer the most likely filename from the listing using normalized variants (e.g., `vite.yaml`, `react.yaml`, `model_context_protocol.yaml`).
   - Read the blip: `get_file_contents(owner: "equinor", repo: "techradar", path: "blips/<key>.yaml")`
   - The `state` field in the YAML gives the current ring (`Adopt`, `Trial`, `Assess`, or `Hold`).
   - Only use `search_code` as a last resort if the key cannot be inferred from the directory listing.
3. **Check in-flight activity** — list open PRs/issues in `equinor/techradar` for technologies that are `Not found`, `Assess`, or `Hold`. Summarize relevant proposals alongside the blip result.
4. **If GitHub MCP is unavailable**, fall back to the local checkout in `.tmp/techradar`:
   ```bash
   if [ -d .tmp/techradar/.git ]; then
     cd .tmp/techradar && git pull --ff-only 2>/dev/null && cd -
   else
     mkdir -p .tmp
     git clone --depth 1 --filter=blob:none --sparse https://github.com/equinor/techradar.git .tmp/techradar 2>/dev/null
     cd .tmp/techradar && git sparse-checkout set blips 2>/dev/null && cd -
   fi
   cat .tmp/techradar/blips/<technology_slug>.yaml
   ```
5. **If still not found**, mark as `missing-from-radar` (not `unknown`) and document the architecture discussion path.

> **Important:** Do NOT delete `.tmp/techradar` during or after the review. The folder is in `.gitignore` and persists between reviews so future runs can pull fresh data without re-cloning.

> **Abstraction level:** The radar tracks platforms, languages, major frameworks, techniques, and tools — not individual library-level packages. Do not look up ordinary npm/PyPI packages. See the techradar-check skill for details.

Do not rely solely on the review record's existing `radarState` values — they may be stale. Always re-verify `unknown` and `not-assessed` entries.

### 4. Classify Findings

Classify findings under these headings:

- Ownership and support
- Skill and script safety
- Production interaction
- Power Platform zone and user persona
- Data classification ceiling
- Dependencies (environment settings, DLP, prerequisites, platform features, access roles)
- Technology Radar status (use results from Step 3)
- EDS and frontend generation
- Manifest and publication readiness
- Local test readiness

### 5. Recommend Status

Use the review outcome rules from `plugin-review-checklist.md`.

Do not recommend `ready-for-internal-pilot` unless all required evidence exists. For a first `code-apps-preview` pass, `controlled-pilot` is the likely maximum until owner, support channel, dependency documentation, EDS position, and local install testing are complete.

### 6. Apply Adjustments

If the user has asked to adjust the plugin, make focused edits that add guardrails without refactoring unrelated content.

For `code-apps-preview`, likely adjustments are:

- Add Equinor pilot guidance to plugin README or AGENTS.
- Add non-production environment confirmation before deploy or push steps.
- Add dependency documentation for environment settings, DLP policies, and prerequisites.
- Add EDS-first guidance for generated React UI, or document a justified exception.
- Add Technology Radar checks for React, Vite, and any other recommended stack.

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

## Tracked Plugin Record Refresh

For a **tracked** plugin (`defer`, `not-reviewed`) touched by an upstream sync, the record is updated mechanically. Do not inspect the plugin's skills, scripts, or agents for quality. Their code is mirrored from upstream and is not Equinor's to fix.

Update only:

- `ownership.upstreamVersion` — the plugin's new version from its `.plugin/plugin.json`.
- `evidence` — one entry naming the synced upstream commit range.
- `scope` — correct a flag that the sync made factually wrong, for example `deletesAssets` when the sync introduced the plugin's first delete path.
- `blockers` — add an entry **only** for a materially new risk class: a first destructive code path, a new MCP server, a new external network call, or a new production-interaction default. State the risk. Do not review the implementation.
- `technologyRadar` — add an entry only when the sync introduced a genuinely new technology, then look it up as in Step 3.

Leave `publicationStatus` unchanged. A sync never promotes a plugin.

Then validate and report:

```bash
node scripts/validate-plugin-reviews.js
```

Report the new upstream version, any new blocker with its justification, and nothing else. If the refresh surfaced a real defect in the plugin, report it upstream and record it as a blocker; do not patch it here.
