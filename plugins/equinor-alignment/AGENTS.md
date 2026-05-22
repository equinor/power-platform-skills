# Equinor Alignment Plugin Guidance

This plugin contains the Wave 0 review workflow for internal Equinor alignment of Power Platform plugins.

## Operating Rules

- Use `docs/equinor-alignment/baseline.md` as the governing source.
- Use `docs/equinor-alignment/plugin-review-checklist.md` for review questions and outcome gates.
- Keep review records in `docs/equinor-alignment/reviews/` and validate them with `node scripts/validate-plugin-reviews.js`.
- Do not mark any app-generating plugin as ready for internal pilot without owner, support channel, zone, DLP, Tech Radar, EDS, publication, and validation evidence.
- Do not overwrite Equinor alignment files when syncing from upstream Microsoft sources.
- Prefer selective upstream sync of a plugin or skill over broad replacement of `plugins/`.

## Upstream Sync Safety

Upstream sync work must start read-only:

1. Confirm the working tree state.
2. Fetch upstream.
3. Summarize changed files and risk areas.
4. Ask for approval before editing or replacing files.
5. Re-run review validation after changes.

If upstream changes affect files that already contain Equinor-specific guardrails, preserve the guardrails and apply the upstream change manually.