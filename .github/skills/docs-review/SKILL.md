---
name: docs-review
description: Documentation review checklist and output format for reviewing markdown files in the power-platform-skills repository. Use when performing a documentation review of any file under plugins/, docs/, shared/, or .github/.
---

# Documentation Review Checklist

Use this checklist when reviewing documentation files. Scope-specific rules (SKILL.md front matter, plugin vs. governance docs) are defined in path-specific instruction files.

## Review Categories

### 1. Formatting Compliance

- **Lists**: Must use hyphens (`-`), not asterisks (`*`) or plus signs (`+`).
- **Dashes**: Endash (`--`) in prose, not emdash (`---`). YAML triple dashes are fine.
- **Headings**: One `#` per file, no skipped levels (e.g., `##` to `####`).
- **Code**: Backticks for inline code; triple backticks with language identifiers for blocks.

### 2. Abbreviations

- Common abbreviations use `<abbr>` tags on first occurrence.

### 3. File Naming

- `SKILL.md` files must be named exactly `SKILL.md`.
- Other files should use `snake_case.md` or the established pattern for their location.

### 4. Links and References

- Internal links use relative paths.
- External article links are collected under `<!-- references -->` with prefixed labels (`eqms_`, `msdocs_`, `techradar_`).
- Flag broken relative links (target file does not exist).
- Flag inline external article links that should be moved to the references section.

### 5. SKILL.md Front Matter

- `name` field present and matches the directory name.
- `description` field is a clear, single-sentence summary.
- `allowed-tools` uses comma-separated string format, not array syntax.
- No unknown or misspelled frontmatter fields.

### 6. Diagrams

- Mermaid syntax with language identifier.
- Valid syntax (proper diagram type, correct arrows).

### 7. Content Quality

- Clear, concise language appropriate for the target audience.
- No duplicated content that should be a link to an authoritative source.
- No outdated references.
- Technical terms defined or linked on first use.

### 8. Authority Hierarchy

Verify external references follow the prescribed precedence:

1. Equinor Management System
2. varia.equinor.com
3. techradar.equinor.com
4. Equinor Digital Direction
5. Official Microsoft documentation

### 9. Structure and Navigation

- Each file has a clear purpose and logical heading structure.
- The file is reachable from its plugin's `AGENTS.md` or `README.md`.
- For governance docs: verify the file is consistent with `baseline.md` and `plugin-review-checklist.md`.

### 10. Review Records (docs/equinor-alignment/reviews/)

- File is valid JSON conforming to `plugin-review.schema.json`.
- Run `node scripts/validate-plugin-reviews.js` and confirm it exits without errors.
- Status value matches the evidence present (do not set `controlled-pilot` without all required fields).

## Output Format

Present reviews in this structure:

```
## Review: <filename>

### Summary
<One-paragraph overall assessment>

### Issues Found

#### Critical (must fix)
- [ ] <issue description> (line X)

#### Warnings (should fix)
- [ ] <issue description> (line X)

#### Suggestions (nice to have)
- [ ] <issue description> (line X)

### Passing Checks
- ✅ <check that passed>
```

If reviewing multiple files, provide a summary table at the top showing pass/fail status per file, then individual reports.
