# GitHub Copilot Instructions for Power Platform Skills

## Project Overview

This repository is the **plugin marketplace** for Power Platform development tools, forked from Microsoft's [power-platform-skills](https://github.com/microsoft/power-platform-skills) and aligned for Equinor internal use.

The marketplace manifest (`.claude-plugin/marketplace.json`) references individual plugins in `plugins/`. Each plugin is a self-contained unit with agents, skills, and shared references that extend Copilot's capabilities for building Power Platform solutions.

## Architecture

### Repository Structure

```
power-platform-skills/
├── .claude-plugin/
│   └── marketplace.json           # Marketplace manifest (lists all plugins)
├── plugins/                       # Individual plugins
│   ├── canvas-apps/               # Canvas app builder
│   ├── code-apps/                 # React + Vite + TypeScript code apps
│   ├── equinor-alignment/         # Equinor review skills and agents
│   ├── mcp-apps/                  # MCP server apps
│   ├── model-apps/                # Model-driven apps
│   └── power-pages/               # Power Pages sites
├── docs/equinor-alignment/        # Review checklists, baseline, review records
├── scripts/                       # Validation and utility scripts
├── shared/                        # Cross-plugin shared skills
└── evals/                         # Evaluation runbooks and data
```

### Plugin Structure

Each plugin under `plugins/<name>/` follows this layout:

- `.claude-plugin/plugin.json` — Plugin metadata (name, version, keywords)
- `AGENTS.md` — Plugin guidance for AI agents (this is the primary agent context file)
- `agents/` — Agent persona files (YAML frontmatter + instructions)
- `skills/` — Skill workflows, each in its own subdirectory with a `SKILL.md`
- `shared/` or `references/` — Shared reference documents used by multiple skills

### Skills

Skills are defined in `SKILL.md` files with YAML frontmatter (`name`, `description`, `allowed-tools`, `model`, `hooks`). The `allowed-tools` field must use a **comma-separated list** -- not JSON array syntax (`["Read", "Write"]`) or YAML list syntax.

### Equinor Alignment Plugin

`plugins/equinor-alignment/` is an Equinor-specific plugin not present in the upstream Microsoft fork. It contains:

- `skills/review-plugin/` — Plugin review workflow against Equinor standards
- `skills/sync-upstream/` — Upstream synchronization workflow

### Cross-Plugin Shared Skills

`shared/skills/<skill-name>/` contains skills that apply to all plugins. Each plugin references these via a thin `SKILL.md` wrapper in `plugins/<plugin>/skills/<skill-name>/`. When updating a shared skill, edit the `shared/` workflow file first, then update all per-plugin wrappers.

## Content Guidelines

Apply formatting rules from `.github/instructions/markdown-instructions.md` and `.github/instructions/documentation-instructions.md`.

## Development Workflows

### Validating Plugin Reviews

After changing review records in `docs/equinor-alignment/reviews/`:

```bash
node scripts/validate-plugin-reviews.js
```

### Installing Plugins

```bash
node scripts/install.js
```

### Upstream Synchronization

To inspect upstream Microsoft changes before merging:

```bash
git fetch upstream main --tags
git log upstream/main..HEAD --oneline
git diff upstream/main -- plugins/power-pages/
```

Use the `sync-upstream` skill for guided synchronization that preserves Equinor guardrails.

## PR and Code Review

- **Commit format**: Conventional commits (`feat: add skill`, `docs: update review`, `fix: correct frontmatter`)
- **Plugin changes**: Require peer review before merge
- **Equinor alignment docs**: Always run `node scripts/validate-plugin-reviews.js` before merging changes to review records
- **Do not overwrite**: Equinor alignment docs, review records, or guardrails when syncing upstream

## Project-Specific Patterns

### Equinor Alignment Checklist

Before promoting a plugin to `controlled-pilot`, confirm:

1. Review record exists at `docs/equinor-alignment/reviews/<plugin>.json` and passes schema validation
2. DLP, Tech Radar, EDS, owner, support channel, zone, MCP, and publication evidence are all documented
3. `node scripts/validate-plugin-reviews.js` exits without errors

### Authority Hierarchy

When referencing external documentation, order by authority:

1. Equinor Management System (docmap.equinor.com / aris.equinor.com)
2. developer.equinor.com
3. techradar.equinor.com
4. Equinor Digital Direction (<https://apps.equinor.com/edd>)
5. Microsoft official docs (learn.microsoft.com)

### DRY Principle

Never duplicate logic or content across files. Each plugin has shared utilities and references. Always check for existing helpers before writing new code.

## Security

- **Classification**: `EQUINOR-INTERNAL` -- no higher classifications allowed in this repository or in issues
- Do not store credentials, tokens, connection IDs, or environment URLs in committed files
- Secrets referenced in skill workflows must use environment variables or secure vaults

## AI-Assisted Operations

The platform team uses AI agents to accelerate plugin review and governance work. The following principles govern all agent behaviour in this repository.

### Principles

1. **Comprehension Before Execution**: When performing plugin reviews or governance decisions, surface the checks being applied. Explain what each step does and reference the relevant procedure in `docs/equinor-alignment/`. Never execute governance decisions silently.

2. **Manual Procedure Parity**: The canonical procedure for any established review operation lives in `docs/equinor-alignment/`. Agent workflows accelerate these procedures but do not replace them. If you identify an operation lacking a documented procedure, flag it.

3. **Reviewable Artifacts**: When performing reviews, produce structured output (review records, change summaries, validation results) that the user can retain independently of the chat session.

### Scope

These principles apply to governance operations and plugin reviews. They do not restrict ad-hoc exploration, local development, or test environment work.
