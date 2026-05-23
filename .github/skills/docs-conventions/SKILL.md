---
name: docs-conventions
description: Shared formatting conventions, content quality guidelines, and authority hierarchy for all documentation in the power-platform-skills repository. Use when writing, editing, or reviewing any markdown documentation.
---

# Documentation Conventions

These conventions apply to all markdown documentation in this repository. Scope-specific rules (front matter, plugin vs. governance docs) are defined in path-specific instruction files and take precedence when they conflict with this skill.

## Markdown Formatting

- **Lists**: Use hyphens (`-`), not asterisks (`*`) or plus signs (`+`).
- **Dashes**: Do not use `--` or `---` as dashes in prose. Rewrite the sentence to avoid them. Triple dashes in YAML front matter and Mermaid diagram delimiters are exempt.
- **Headings**: Use `#` hierarchy correctly. Each file should have exactly one `#` top-level heading. Heading levels should not skip (e.g., `##` to `####`).
- **Code**: Use backticks for inline code and triple backticks with language identifiers for code blocks.
- **Indentation**: Use 2 spaces for nested list content.

## File Naming

- Skill files are always named `SKILL.md`.
- Other markdown files should use `snake_case.md` (e.g., `plugin_review.md`) or `kebab-case.md` for existing patterns.
- Agent files use the pattern `<name>.md` or `<name>.agent.md` as appropriate for the platform.

## Abbreviations

Use `<abbr>` tags for common abbreviations on first occurrence in each file:

- `<abbr title="Power Platform Admin Center">PPAC</abbr>`
- `<abbr title="Data Loss Prevention Policy">DLP</abbr>`
- `<abbr title="Equinor Design System">EDS</abbr>`

## Links and References

- Use relative paths for internal links (e.g., `[Baseline](../../docs/equinor-alignment/baseline.md)`).
- Collect external article links at the end of the file under a `<!-- references -->` comment using descriptive reference labels:
  - `eqms_` prefix for Equinor Management System links
  - `msdocs_` prefix for Microsoft documentation links
  - `techradar_` prefix for Tech Radar entries
- Inline bare domain links like `<https://equinor.com>` are acceptable when referencing a whole site.
- Verify that internal link targets exist.

## SKILL.md Front Matter

The `allowed-tools` field in SKILL.md must use a **comma-separated string**, not JSON array or YAML list:

```yaml
# Correct
allowed-tools: Read, Write, Edit, Bash, Glob, Grep

# Wrong
allowed-tools: ["Read", "Write"]
allowed-tools:
  - Read
  - Write
```

## Diagrams

- Use Mermaid syntax enclosed in triple backticks with `mermaid` language identifier.
- Prefer C4 model for architecture diagrams and sequence diagrams for workflows.

## Content Quality

- Write clear, concise prose directly applicable to Power Platform plugin development at Equinor.
- Prefer short sentences and paragraphs for readability.
- Replace duplicated content with links to authoritative sources.
- Remove or update outdated references (e.g., deprecated URLs, old product names).
- Define technical terms on first use or link to a glossary.

## Authority Hierarchy

When referencing external documentation, prefer higher-authority sources:

1. Equinor Management System (docmap.equinor.com / aris.equinor.com)
2. developer.equinor.com
3. techradar.equinor.com
4. Equinor Digital Direction (apps.equinor.com/edd)
5. Official Microsoft documentation (learn.microsoft.com)

Flag cases where a lower-authority source is used when a higher-authority equivalent exists.
