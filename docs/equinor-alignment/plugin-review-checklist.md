# Plugin Review Checklist

Use this checklist before piloting, publishing, or recommending an internal Equinor variant of any plugin in this marketplace.

The checklist has two layers:

- Human review: answer the questions in this document.
- Machine-readable record: store review evidence using `plugin-review.schema.json`.

## Readiness Status

Assign exactly one status:

| Status | Meaning |
| --- | --- |
| `not-reviewed` | No review evidence exists yet. |
| `defer` | Plugin has unresolved policy, security, technology, ownership, or quality blockers. |
| `controlled-pilot` | Plugin can be tested by approved users under documented restrictions. |
| `ready-for-internal-pilot` | Plugin is ready for a wider internal pilot, but is not broadly recommended. |
| `published` | Plugin is published through the approved internal marketplace and discovery channels. |

## Required Review Questions

### Ownership And Scope

- Who owns the plugin internally?
- What support channel will users use?
- Which upstream plugin and version is this based on?
- What problem does the plugin solve for Equinor users?
- Is the plugin assistive only, or can it create, modify, deploy, or delete Power Platform assets?

### Skill And Script Safety

- Are all `SKILL.md` files reviewed?
- Are all agents, prompts, commands, and hooks reviewed?
- Are all bundled scripts reviewed for filesystem access, network calls, external commands, and secret handling?
- Are scripts needed, or can the task use built-in agent tools and deterministic existing helpers?
- Does any skill or script interact with production systems by default? If yes, block publication until redesigned or approved.

### MCP Dependencies

- Does the plugin require an MCP server?
- Is the MCP server local or remote?
- What transport is used?
- Is the server version pinned?
- What files, environment variables, network endpoints, and services can it access?
- Does it require approved Equinor MCP access or AccessIT roles?
- Is production-system interaction explicitly blocked in the skill instructions?

### Power Platform Zone And Data Handling

- Which zones are supported: Green, Yellow, Red, or not applicable?
- Which user persona is intended: personal maker, certified citizen developer, certified citizen agent creator, professional IT developer, platform team, or other?
- What is the maximum supported information classification?
- Does any workflow handle, store, generate, export, or publish `EQUINOR-CONFIDENTIAL` data? If yes, block publication unless explicit approval and platform support exist.
- Which connectors are used or recommended?
- Are custom connectors, HTTP, Dataverse, SharePoint, Teams, Outlook, OneDrive, SQL, SAP, FTP, or external APIs involved?
- Does the workflow require DLP changes, endpoint filtering, connector action control, or environment owner approval?
- Does the generated solution require Architecture Contract or CI updates?

### Technology Radar

- Which technologies does the plugin recommend or generate?
- What is the current radar state for each technology?
- Are any technologies `Hold`? If yes, block until a deviation permit exists.
- Are any technologies `Assess`? If yes, require Architecture Contract dialogue before production use.
- Are any technologies missing from the radar? If yes, document the review path.

### Equinor Design System

- Does the plugin generate frontend UI?
- For React output, does it prefer `@equinor/eds-core-react`, `@equinor/eds-tokens`, and `@equinor/eds-icons` where feasible?
- Does it use EDS accessibility, spacing, typography, and interaction guidance?
- Does it reference EDS Storybook or Figma for component decisions?
- If Fluent UI, platform-native controls, or custom CSS are used instead of EDS, is the reason documented?

### Publication And Discovery

- Are plugin and marketplace manifests valid?
- Do GitHub Copilot and Claude manifests exist where needed?
- Are manifest names kebab-case and compatible with plugin tooling?
- Are plugin versions synchronized between `plugin.json` and marketplace entries?
- Is the author field compatible with the target marketplace tooling?
- Is there installation guidance for VS Code and Copilot CLI?
- Is there uninstall or rollback guidance?
- Is Varia catalog metadata needed?
- Is TechDocs publication needed?
- Are Architecture Contract and Avert links required for Varia Soundcheck?

## Review Outcome Rules

Use these minimum rules when setting `publicationStatus`:

| Condition | Minimum outcome |
| --- | --- |
| No owner or support channel | `defer` |
| Unreviewed bundled scripts | `defer` |
| Production-system interaction by default | `defer` |
| `Hold` technology without deviation permit | `defer` |
| `EQUINOR-CONFIDENTIAL` handling without explicit approval and support | `defer` |
| MCP dependency without access and security review | `controlled-pilot` at most |
| App generation with connector or DLP impact | `controlled-pilot` at most until Power Platform owner review |
| External-facing Power Pages generation | `controlled-pilot` at most until Red Zone and external exposure handling are documented |
| Alignment workflow with no app generation and reviewed scripts | Eligible for `ready-for-internal-pilot` |

## Suggested Review Record Location

Store review records in a future `docs/equinor-alignment/reviews/` directory using one JSON file per plugin, for example:

```text
docs/equinor-alignment/reviews/power-pages.json
docs/equinor-alignment/reviews/model-apps.json
docs/equinor-alignment/reviews/code-apps-preview.json
docs/equinor-alignment/reviews/canvas-apps.json
docs/equinor-alignment/reviews/mcp-apps.json
```

Validate each file against `plugin-review.schema.json` before using it as publication evidence.

Run:

```bash
node scripts/validate-plugin-reviews.js
```