---
applyTo: '**/*.md'
---

# Markdown Documentation Guidelines

## Repository Context

This repository is the Power Platform plugin marketplace for Equinor. Documentation here falls into two main categories:

- **Plugin documentation** (`plugins/*/AGENTS.md`, `plugins/*/README.md`, skill `SKILL.md` files): Guidance for AI agents and developers working with each plugin.
- **Governance documentation** (`docs/equinor-alignment/`): Review checklists, baseline requirements, and JSON review records that track plugin alignment status.

## Documentation Standards

- Follow the [Markdown Guidelines](./markdown-instructions.md) for consistent formatting and style.
- Use clear, concise language so documentation is easily understandable.
- Prefer short sentences and paragraphs to enhance readability.
- Structure documents with appropriate headings and subheadings.
- Define all technical terms and abbreviations on first use.
- Use Mermaid diagrams where they clarify complex concepts.
- Prefer referencing authoritative external documentation instead of duplicating content.
- Place all external or formatted links at the end of the markdown file under a `<!-- references -->` comment using descriptive reference labels (e.g., `eqms_`, `msdocs_`).
- When citing external references, state the order of authoritative sources. Recommended precedence:
  1. Equinor Management System (<https://docmap.equinor.com> / <https://aris.equinor.com>)
  2. varia.equinor.com
  3. techradar.equinor.com
  4. Equinor Digital Direction (<https://apps.equinor.com/edd>)
  5. Microsoft official documentation (<https://learn.microsoft.com/en-us/power-platform/>)

## Conventions

- Use clear, descriptive file and directory names; prefer `snake_case` (e.g., `plugin_review.md`).
- Store document-specific assets in a local `_resources/` folder.
- Apply GitHub Flavoured Markdown throughout -- this repository does not use MkDocs.

## Plugin Documentation

- Keep plugin-level `AGENTS.md` files focused on what the plugin does, its architecture, and how an AI agent should behave when working within it.
- `SKILL.md` files must use YAML frontmatter with `name`, `description`, and `allowed-tools` (comma-separated list, not array syntax).
- Reference shared skills from `shared/skills/` rather than duplicating skill logic.

## Governance Documentation

- `docs/equinor-alignment/` documents are the authoritative record for plugin review status.
- Review records (`docs/equinor-alignment/reviews/*.json`) must conform to `docs/equinor-alignment/plugin-review.schema.json`.
- Always run `node scripts/validate-plugin-reviews.js` after editing review records.
