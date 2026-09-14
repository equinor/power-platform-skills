---
applyTo: "docs/equinor-alignment/**"
---

# Equinor Alignment Documentation Scope

Files under `docs/equinor-alignment/` are governance documentation for the Equinor-aligned plugin marketplace. They are consumed on GitHub and define the standards, checklists, and review records used to evaluate whether plugins are ready for internal use.

## Key Files

| File                         | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `baseline.md`                | Baseline requirements all plugins must meet                                                   |
| `sync-policy.md`             | Adoption tiers, the mirror rule for unadopted plugins, declared fork transforms, review depth |
| `sync-policy.json`           | Machine-readable companion to `sync-policy.md`, read by `scripts/check-sync-scope.js`         |
| `plugin-review-checklist.md` | Step-by-step review checklist (DLP, Tech Radar, EDS, owner, etc.)                             |
| `plugin-review.schema.json`  | JSON Schema for review record files                                                           |
| `reviews/*.json`             | Per-plugin review records                                                                     |

## Review Records

Review records in `reviews/` must conform to `plugin-review.schema.json`. After editing any review record, validate it:

```bash
node scripts/validate-plugin-reviews.js
```

Required evidence fields are defined in the schema. Do not mark a plugin ready for `controlled-pilot` unless all required fields are present and the script exits without errors.

## Admonition Syntax

These files are consumed on GitHub. Use GitHub-flavored admonitions only:

```markdown
> [!NOTE]
> Content here

> [!WARNING]
> Content here
```

## Content Standards

- Keep checklist items actionable and grounded in current Equinor governance requirements.
- Link to authoritative sources rather than restating content.
- When adding new criteria to the checklist or schema, update both files together.
- When changing an entry in `sync-policy.json`, explain it in `sync-policy.md` and in the pull request. Widening the declared transforms widens what this fork may diverge on.
- Remove or update outdated references quickly to reduce maintenance effort.

## Audience

Power Platform platform team members performing plugin governance reviews before internal publication.
