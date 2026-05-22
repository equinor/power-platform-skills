# Equinor Alignment Plugin

Wave 0 plugin for reviewing this marketplace against Equinor standards before any app-generating plugin is piloted internally.

This plugin does not create or deploy Power Platform assets. It supports two workflows:

- Review a plugin against the alignment baseline and update its review record.
- Inspect and synchronize changes from the upstream Microsoft repository while preserving Equinor alignment evidence.

## Assets

| Type | Name | Purpose |
| --- | --- | --- |
| Agent | `equinor-plugin-reviewer` | Facilitates plugin reviews, publication readiness checks, and upstream sync decisions. |
| Skill | `review-plugin` | Applies the Equinor alignment checklist to a target plugin and updates review evidence. |
| Skill | `sync-upstream` | Fetches and compares upstream Microsoft changes, then guides selective sync of plugin or skill updates. |

## Source Documents

The reviewer must use the root alignment documents as the source of truth:

- `docs/equinor-alignment/baseline.md`
- `docs/equinor-alignment/plugin-review-checklist.md`
- `docs/equinor-alignment/plugin-review.schema.json`
- `docs/equinor-alignment/reviews/*.json`

## Validation

After review record changes, run:

```bash
node scripts/validate-plugin-reviews.js
```

After marketplace or plugin manifest changes, parse the changed JSON files and run `git diff --check` on touched files.