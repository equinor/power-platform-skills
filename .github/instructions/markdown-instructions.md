---
applyTo: '**/*.md'
---

# Markdown Guidelines

## General

- Use `#` for top-level headings, `##` for second-level headings, and so on.
- Use hyphen (`-`) for lists instead of asterisk.
- Do not use `--` or `---` as dashes in prose. Rewrite the sentence to avoid them. YAML front matter delimiters and Mermaid diagram syntax are exempt.
- Use `<abbr>` tags for abbreviations, e.g., `<abbr title="Data Loss Prevention Policy">DLP</abbr>`.
- Use GitHub Flavoured Markdown (GFM).
- Use backticks for code snippets and inline code, e.g., `code snippet`.
- Use 2 spaces for indentation in lists and nested content where supported.
- Place all external or formatted links at the end of the document under a `<!-- references -->` comment and use descriptive reference labels (e.g., `eqms_`, `msdocs_`). Inline bare domain links such as `<https://equinor.com>` are acceptable when referencing a whole site.
- Refer to `.github/instructions/documentation-instructions.md` for structural conventions.

## Markdownlint Compliance

After writing or editing a markdown file, check the VS Code Problems panel for markdownlint violations and fix them before finishing. Most violations (missing blank lines around headings, tables, lists, code blocks; missing language on fenced blocks) are straightforward structural fixes.

For rules that genuinely cannot be satisfied, add a disable comment:

- Place `<!-- markdownlint-disable RULE -->` on the first line after any YAML front matter, or at the top of the file when there is no front matter.

For a small affected section, prefer scoped pairs over a file-wide disable:

```markdown
<!-- markdownlint-disable MD033 -->
<abbr title="Power Platform">PP</abbr>
<!-- markdownlint-enable MD033 -->
```

## List of abbreviations to use

- PPAC: Power Platform Admin Center
- DLP: Data Loss Prevention Policy
- EDS: Equinor Design System

## Admonitions

All markdown in this repository is consumed on GitHub. Use GitHub-flavored admonitions:

```markdown
> [!NOTE]
> Content here

> [!TIP]
> Content here

> [!WARNING]
> Content here

> [!CAUTION]
> Content here
```

## Links

- Use relative links for internal documentation, e.g., `[Review Checklist](../docs/equinor-alignment/plugin-review-checklist.md)`.
- Use absolute links for external resources and collect them at the end of the file:

```markdown
[Tech Radar][techradar_power_pages]

<!-- references -->
[techradar_power_pages]: https://techradar.equinor.com/...
```

## Images and Assets

- Store all images and assets in a `_resources/` folder within the same directory as the markdown file.
- Use descriptive filenames and alternative text.
- Reference images using relative paths.

## Diagrams

- Use Mermaid syntax enclosed in triple backticks with `mermaid` language identifier.
- Prefer C4 model for architecture diagrams and sequence diagrams for workflows.
