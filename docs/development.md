# Developing Power Platform Skills

This page is for people who work on the plugins in this repository.
To install and use the plugins, start with the [README](../README.md).

## Local Development

To develop and test plugins locally, follow these steps:

1. Clone this repository
1. Launch GitHub Copilot CLI or Claude Code with the plugin path:

    GitHub Copilot CLI:

    ```bash
    copilot --plugin-dir /path/to/power-platform-skills/plugins/power-pages
    copilot --plugin-dir /path/to/power-platform-skills/plugins/model-apps
    copilot --plugin-dir /path/to/power-platform-skills/plugins/pcf
    copilot --plugin-dir /path/to/power-platform-skills/plugins/mcp-apps
    copilot --plugin-dir /path/to/power-platform-skills/plugins/canvas-apps
    copilot --plugin-dir /path/to/power-platform-skills/plugins/code-apps
    copilot --plugin-dir /path/to/power-platform-skills/plugins/mobile-apps
    copilot --plugin-dir /path/to/power-platform-skills/plugins/power-apps-mobile-extension
    copilot --plugin-dir /path/to/power-platform-skills/plugins/power-automate
    copilot --plugin-dir /path/to/power-platform-skills/plugins/process-intelligence
    ```

    Claude Code:

    ```bash
    claude --plugin-dir /path/to/power-platform-skills/plugins/power-pages
    claude --plugin-dir /path/to/power-platform-skills/plugins/model-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/pcf
    claude --plugin-dir /path/to/power-platform-skills/plugins/mcp-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/canvas-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/code-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/mobile-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/power-apps-mobile-extension
    claude --plugin-dir /path/to/power-platform-skills/plugins/power-automate
    claude --plugin-dir /path/to/power-platform-skills/plugins/process-intelligence
    ```

For Process Intelligence, first follow its [setup instructions](../plugins/process-intelligence/README.md#installation),
including the explicit profile and absolute plugin root needed to avoid duplicate workspace MCP loads.

Loading a plugin by path bypasses the installer's adoption gate, so a `defer` plugin loads like any other.
Check its [review record](equinor-alignment/reviews/) before relying on it.

### Cross-platform hook commands

Hook commands may be launched through nested shells on Windows. Inline JavaScript wrapped in
double quotes can lose those quotes before `node -e` receives it, causing PowerShell to parse the
JavaScript itself. Use a single-quoted `node -e` script with any string arguments passed after the
script and read from `process.argv`; see [issue #788][upstream_issue_788].
Telemetry-only commands should fail open, but do not suppress failures from validation hooks.

Run `node --test scripts/tests/hook-command-quoting.test.cjs` to exercise affected manifests through
POSIX shells and, on Windows, direct and nested PowerShell.

## Repository Structure

```text
power-platform-skills/
├── marketplace.json              # Open Plugins marketplace manifest (lists all plugins)
├── .claude-plugin/               # Legacy marketplace shim for existing subscriptions
│   └── marketplace.json
├── .agents/
│   └── plugins/
│       └── marketplace.json      # Codex catalog for the Code Apps package only
├── .claude/
│   └── settings.json             # Auto-allowed tools (pac, node, dotnet, etc.)
├── .github/
│   ├── agents/                   # Equinor plugin reviewer and upstream sync agents
│   ├── instructions/             # Markdown, documentation and alignment instructions
│   ├── skills/                   # Equinor review, sync and documentation skills
│   └── workflows/                # Path-filtered CI
├── docs/
│   ├── development.md            # This page
│   └── equinor-alignment/        # Baseline, sync policy, checklist, schema
│       └── reviews/              # Per-plugin review records
├── plugins/
│   ├── canvas-apps/              # Canvas Apps plugin
│   ├── code-apps/                # Code Apps plugin (code-apps-preview)
│   │   ├── .plugin/
│   │   │   └── plugin.json       # Open Plugins manifest
│   │   ├── .claude-plugin/       # Legacy manifest mirror
│   │   │   └── plugin.json
│   │   ├── plugin.json           # Agent Plugins 1.0.0 manifest
│   │   ├── com.github.copilot/   # Native Copilot agent and hooks
│   │   ├── agents/
│   │   ├── hooks/
│   │   ├── shared/               # Shared instructions + references
│   │   └── skills/
│   ├── mcp-apps/                 # MCP codeful tool + widget generator plugin
│   ├── mobile-apps/              # Mobile Apps plugin (mobile-app)
│   ├── model-apps/               # Model Apps plugin
│   ├── pcf/                      # PCF code components plugin
│   ├── power-apps-mobile-extension/ # Native controls for wrapped Canvas apps
│   ├── power-automate/           # Power Automate cloud flows plugin
│   ├── power-pages/              # Power Pages plugin
│   └── process-intelligence/     # Process Mining analytics plugin
├── shared/
│   └── skills/                   # Cross-plugin shared skills, copied into each plugin
├── evals/                        # Evaluation runbooks and data
├── scripts/                      # Installer and repository validators
├── AGENTS.md                     # Development guidelines
└── README.md
```

Every plugin has the `.plugin/` and `.claude-plugin/` manifests shown for `code-apps`.
The rest of each plugin's layout follows the [plugin conventions](../AGENTS.md#plugin-conventions).

The canonical Open Plugins marketplace manifest is `marketplace.json`.
The `.claude-plugin` files are compatibility mirrors for users who subscribed
before the Open Plugins migration. The root legacy marketplace mirrors
`marketplace.json`, and per-plugin legacy manifests mirror `.plugin/plugin.json`.
The shared marketplace keeps marketplace-level `owner` and `metadata`, while each
plugin entry is intentionally just `name` plus repository-root-relative `source`.
Plugin descriptions, versions, licenses, and keywords are controlled from each
plugin's `.plugin/plugin.json`. This keeps existing subscriptions updating without
duplicating display/update metadata.

This fork lists no plugins maintained in other repositories; see
[reviews/dataverse.json](equinor-alignment/reviews/dataverse.json) for why upstream's `dataverse` entry is held back.
If one is added, it uses a remote `source` object instead of a path.
Copilot CLI reads `marketplace.json` and Claude Code reads `.claude-plugin/marketplace.json`, and they spell a plugin in a repository subdirectory differently.
So `marketplace.json` uses `"source": "github"` with `repo` and `path`, and the legacy file uses `"source": "git-subdir"` with `url` and `path`.
`scripts/validate-legacy-compatibility.js` enforces that pairing.

## Installer name validation

The installer validates plugin names in local and downloaded marketplace manifests before
installation. Names must follow the Open Plugins format: 1–64 lowercase ASCII letters or
digits, with single dots or hyphens allowed between alphanumeric endpoints. CLI arguments
are passed directly to executables; Windows batch launchers accept only shell-inert arguments.

## Equinor alignment

Plugin reviews and upstream syncs follow the procedures in [docs/equinor-alignment](equinor-alignment/README.md).
After changing a review record, run `node scripts/validate-plugin-reviews.js`.
After changing anything under `plugins/`, `evals/`, or `shared/`, run `node scripts/check-sync-scope.js`;
see [sync-policy.md](equinor-alignment/sync-policy.md) for what it checks.

<!-- references -->
[upstream_issue_788]: https://github.com/microsoft/power-platform-skills/issues/788
