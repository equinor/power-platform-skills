# Equinor Alignment

This directory contains the implementation artifacts for aligning the internal Equinor variant of this Power Platform plugin marketplace.

Start here:

- [Alignment baseline](baseline.md): source-of-truth standards and publication decisions gathered from Equinor repositories.
- [Plugin review checklist](plugin-review-checklist.md): human review questions and outcome rules for plugin readiness.
- [Plugin review schema](plugin-review.schema.json): JSON schema for machine-readable plugin review records.

Initial review records are stored in [reviews/](reviews/). They are intentionally marked `defer` until detailed plugin owner, script, MCP, DLP, Tech Radar, EDS, and publication evidence exists.

Validate review records with:

```bash
node scripts/validate-plugin-reviews.js
```

## Current Status

The first implementation slice establishes the review baseline only. No plugin is approved for broad internal publication until it has a completed review record and the relevant Power Platform owners have accepted the publication path.

## Next Implementation Steps

1. Create review records for each plugin using `plugin-review.schema.json`.
2. Add shared Equinor references for governance, Tech Radar, EDS, MCP, and publication readiness.
3. Update plugin metadata and manifests for the internal marketplace pattern.
4. Add validation scripts for manifest parity, naming, review records, and Tech Radar checks.
5. Package the repeatable alignment workflow as a Wave 0 agent plugin or project skill.