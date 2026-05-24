<!-- markdownlint-disable MD033 -->

# Power Platform Skills

Agent skills and plugins for Power Platform development, aligned for Equinor internal use.

## Overview

This repository is a **plugin marketplace** containing agent plugins for Power Platform services. Each plugin provides skills, agents, and commands to help developers build on the Power Platform.

**Primary platform:** GitHub Copilot (VS Code) via the `.github/` convention.
**Also supported:** Claude Code via the plugin marketplace system.

## Equinor Fork

This repository is a fork of [`microsoft/power-platform-skills`][upstream_github], maintained for Equinor internal use. It is not a neutral mirror — it applies Equinor governance, security standards, and the shared practices of the [Equinor IT professional network][equinor_varia] before any plugin is piloted or published internally.

> [!TIP]
> [View the live diff on GitHub →][fork_compare] opens GitHub's native comparison view and shows every file-level change relative to the upstream `microsoft/power-platform-skills` main branch.

### Why a fork and not the upstream directly?

The upstream Microsoft plugins are designed for general Power Platform use across any organisation. Equinor has additional obligations that the upstream does not satisfy by default:

| Concern | Equinor requirement |
| --- | --- |
| Governance gate | Every plugin must pass a review against [docs/equinor-alignment/baseline.md](docs/equinor-alignment/baseline.md) before internal publication |
| Tech Radar | `Hold` items require an approved deviation permit; `Assess` items require Architecture Contract dialogue |
| Design standards | Generated UI must target [Equinor Design System][eds] components, tokens, and accessibility guidance |
| MCP security | MCP-dependent workflows must be explicitly evaluated, documented, and opted into — they are not enabled by default |
| Production safety | Skills must not interact with production systems during development by default |
| Secret hygiene | No credentials, tokens, connection IDs, or environment URLs may be committed to this repository |
| Discovery | Internal plugins are published through Varia and TechDocs, not the public Microsoft marketplace |

### What's changed from upstream

The table below summarises every category of change. The review records in [`docs/equinor-alignment/reviews/`](docs/equinor-alignment/reviews/) contain the detailed per-plugin assessment.

| Category | What was added or changed | Why |
| --- | --- | --- |
| **`plugins/equinor-alignment/`** | New plugin: `equinor-plugin-reviewer` agent + `review-plugin` and `sync-upstream` skills | Automates governance review and upstream synchronisation using the Equinor checklist |
| **`docs/equinor-alignment/`** | Baseline, checklist, JSON schema, and per-plugin review records | Provides the canonical, reviewable source of truth for internal publication decisions |
| **`.github/skills/`** | `review-plugin`, `sync-upstream`, `docs-conventions`, `docs-review`, `copilot-cost`, `update-copilot-pricing` | Installs Equinor-specific agent skills into every project that uses this fork |
| **`.github/copilot-instructions.md`** | Project-level Copilot instructions | Grounds Copilot in Equinor authority hierarchy (EMS → varia.equinor.com → Tech Radar → Microsoft docs) |
| **`.github/instructions/`** | Markdown, documentation, and alignment instruction files | Enforces shared Equinor documentation conventions across all AI-assisted authoring |
| **`.devcontainer/`** | Dev container with Equinor CA certificates and standard tooling | Ensures consistent, trusted development environments inside Equinor's network |
| **`plugins/code-apps/`** | <abbr title="Equinor Design System">EDS</abbr> integration guidance, mandatory deploy confirmation, updated development standards | Aligns generated code apps with Equinor Design System and prevents accidental production deploys |
| **`scripts/install.js`** | Extended to support GitHub Copilot project-scoped installation and Equinor fork URL | Lets teams install into `.github/` for shared team use, not only user-level Claude Code install |
| **`scripts/validate-plugin-reviews.js`** | New script | CI-validates review records against the JSON schema before any plugin state change merges |
| **`SECURITY.md`** | Updated to Equinor responsible disclosure contacts | Replaces Microsoft-only disclosure path with Equinor contacts |
| **`CODE_OF_CONDUCT.md`, `SUPPORT.md`** | Removed | Superseded by Equinor's own conduct and support processes |

### Plugin publication status

Current review status for each plugin. A review record reaching `controlled-pilot` or higher means the Equinor alignment team has found sufficient evidence to recommend piloting — it is not a compliance certificate or a guarantee of correctness.

| Plugin | Status | Review record |
| --- | --- | --- |
| `equinor-alignment` | in-review | — |
| `code-apps-preview` | defer | [reviews/code-apps-preview.json](docs/equinor-alignment/reviews/code-apps-preview.json) |
| `power-pages` | defer | [reviews/power-pages.json](docs/equinor-alignment/reviews/power-pages.json) |
| `model-apps` | defer | [reviews/model-apps.json](docs/equinor-alignment/reviews/model-apps.json) |
| `canvas-apps` | defer | [reviews/canvas-apps.json](docs/equinor-alignment/reviews/canvas-apps.json) |
| `mcp-apps` | defer | [reviews/mcp-apps.json](docs/equinor-alignment/reviews/mcp-apps.json) |

`defer` means the plugin has an initial review record but lacks sufficient evidence (owner confirmation, <abbr title="Data Loss Prevention Policy">DLP</abbr> mapping, Tech Radar positioning, or EDS compliance) to recommend piloting. Plugins with a `defer` status warrant extra care — review the record and understand what is still outstanding before adopting them in your team's workflow.

Regardless of review status, **AI agents are not a substitute for human judgement**. No review process can guarantee that a plugin's output will be correct, compliant, or appropriate for your context. Alignment with Equinor standards is the goal of the review process, and we believe it helps — but responsibility for how these plugins are used always rests with the people using them. Practice responsible AI use: understand what a plugin does before running it, verify generated artefacts before deploying them, and raise concerns through the support channels listed in each review record.

---

## Installation

### GitHub Copilot (VS Code) — Project-Scoped

For team use, install skills and agents into your project's `.github/` directory so all contributors benefit:

```bash
# Install a specific plugin (recommended)
node scripts/install.js --scope project --plugin code-apps-preview

# Install multiple plugins
node scripts/install.js --scope project --plugin power-pages,code-apps-preview
```

This copies agent definitions into `.github/agents/`, instructions into `.github/instructions/`, and skills into `.github/skills/`, following the [GitHub Copilot customization convention][gh_copilot_customization]. Commit these files to share with your team.

> [!NOTE]
> There is no automatic update for project-scoped installs. To get the latest plugin content, re-run the installer and commit the updated files.

Or run without cloning:

```bash
curl -fsSL https://raw.githubusercontent.com/equinor/power-platform-skills/main/scripts/install.js | node - --scope project --plugin code-apps-preview
```

Available plugins: `power-pages`, `model-apps`, `mcp-apps`, `canvas-apps`, `code-apps-preview`, `equinor-alignment`

### Claude Code — User-Scoped

For Claude Code users, the installer registers the marketplace and installs plugins at user level:

```bash
node scripts/install.js
```

Or run directly without cloning:

**Windows (PowerShell)**:

```powershell
iwr https://raw.githubusercontent.com/equinor/power-platform-skills/main/scripts/install.js -OutFile install.js; node install.js; del install.js
```

**macOS/Linux**:

```bash
curl -fsSL https://raw.githubusercontent.com/equinor/power-platform-skills/main/scripts/install.js | node
```

The installer automatically:

- Detects available tools (Claude Code CLI)
- Registers the plugin marketplace and installs all listed plugins
- Enables auto-update in the **Claude Code CLI** so plugins stay current without manual steps
- Installs `pac` CLI if not already present

### Manual Installation (Claude Code)

Inside a Claude Code session:

1. Add the marketplace

    ```bash
    /plugin marketplace add equinor/power-platform-skills
    ```

2. Install the desired plugin

    ```bash
    /plugin install power-pages@power-platform-skills
    /plugin install model-apps@power-platform-skills
    /plugin install code-apps@power-platform-skills
    /plugin install canvas-apps@power-platform-skills
    ```

### Where Are Things Installed?

| Scope | Platform | Location |
| --- | --- | --- |
| `project` | GitHub Copilot (VS Code) | `.github/agents/`, `.github/instructions/`, `.github/skills/` |
| `user` (default) | Claude Code | `~/.claude/plugins/` |

The marketplace registry (Claude Code) is stored at `~/.claude/plugins/known_marketplaces.json`.

### Uninstall

**GitHub Copilot (project-scoped):** Delete the installed files from `.github/agents/`, `.github/instructions/`, and `.github/skills/`.

**Claude Code (user-scoped):**

```bash
# Inside a Claude Code session
/plugin uninstall power-pages
/plugin uninstall model-apps
/plugin uninstall code-apps
/plugin uninstall canvas-apps
/plugin marketplace remove power-platform-skills
```

## Available Plugins

### [Power Pages](plugins/power-pages/README.md) (`plugins/power-pages`)

Create and deploy Power Pages sites using modern development approaches.

**Currently supported**: Code Sites (SPAs) with React, Angular, Vue, or Astro

### [Model Apps](plugins/model-apps/README.md) (`plugins/model-apps`)

Build and deploy Power Apps generative pages for model-driven apps.

**Stack**: React + TypeScript + Fluent, deployed via PAC CLI

### [Code Apps](plugins/code-apps/AGENTS.md) (`plugins/code-apps`)

Build and deploy Power Apps code apps connected to Power Platform via connectors.

**Stack**: React + Vite + TypeScript, deployed via PAC CLI

### [Canvas Apps](plugins/canvas-apps/AGENTS.md) (`plugins/canvas-apps`)

Author Power Apps Canvas Apps using the Canvas Authoring MCP server.

**Stack**: PA YAML (`.pa.yaml`) authored via `CanvasAuthoringMcpServer`, requires .NET 10 SDK

## Local Development

To develop and test plugins locally, follow these steps:

1. Clone this repository
1. Launch Claude Code with plugin path:

    ```bash
    claude --plugin-dir /path/to/power-platform-skills/plugins/power-pages
    claude --plugin-dir /path/to/power-platform-skills/plugins/model-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/code-apps
    claude --plugin-dir /path/to/power-platform-skills/plugins/canvas-apps
    ```

## Running Without Interruption

Plugins in this repo may invoke multiple tools (file edits, shell commands, MCP servers) during a session, which can result in frequent approval prompts. Use the options below to reduce or eliminate these interruptions.

> [!WARNING]
> Auto-approval options give the agent the same access you have on your machine. Only use these in trusted or sandboxed environments.

### Claude Code

#### Option 1 — Permission mode (recommended)

Set the `acceptEdits` mode to auto-approve file edits while still prompting for shell commands:

```jsonc
// .claude/settings.json (project-level) or ~/.claude/settings.json (user-level)
{
  "defaultMode": "acceptEdits",
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git *)",
      "Bash(pac *)"
      // add other commands your workflow needs
    ]
  }
}
```

#### Option 2 — Allow all tools

Press <kbd>Shift</kbd>+<kbd>Tab</kbd> during a session to cycle to **auto-accept** mode, or launch with:

```bash
claude --dangerously-skip-permissions
```

See the [Claude Code permissions docs][claude_code_permissions] for the full reference.

### GitHub Copilot CLI

#### Option 1 — Allow specific tools (recommended)

Pre-approve only the tools your workflow needs:

```bash
copilot --allow-tool 'write' --allow-tool 'shell(npm run build)' --allow-tool 'shell(pac *)'
```

#### Option 2 — Allow all tools in Copilot

```bash
copilot --allow-all-tools
```

To allow everything except dangerous commands:

```bash
copilot --allow-all-tools --deny-tool 'shell(rm)' --deny-tool 'shell(git push)'
```

See the [Copilot CLI docs][gh_copilot_cli_docs] for the full reference.

## Repository Structure

```text
power-platform-skills/
├── .claude-plugin/
│   └── marketplace.json      # Marketplace manifest (lists all plugins)
├── .claude/
│   └── settings.json         # Auto-allowed tools (pac, node, dotnet, etc.)
├── plugins/
│   ├── power-pages/          # Power Pages plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── shared/
│   │   └── skills/
│   ├── model-apps/           # Model Apps plugin
│   |   ├── .claude-plugin/
│   │   └── plugin.json
│   |   ├── commands/
│   |   ├── skills/
│   |   ├── shared/           # Shared references + samples
│   |   └── github/           # GitHub Copilot instructions
│   ├── code-apps/            # Code Apps plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── agents/
│   │   ├── skills/
│   │   └── shared/           # Shared instructions + references
│   └── canvas-apps/          # Canvas Apps plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── references/       # Technical + design guides
│       └── skills/
├── AGENTS.md                 # Development guidelines
└── README.md
```

## Documentation

- [Equinor Alignment Baseline](docs/equinor-alignment/README.md)
- [Power Pages Code Sites][msdocs_power_pages_code_sites]
- [Power Pages REST API][msdocs_power_pages_api]
- [Generative Pages with External Tools][msdocs_generative_pages]
- [Power Apps Code Apps][msdocs_code_apps]
- [PAC CLI Reference][msdocs_pac_cli]

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guide.

## License

The code in this repo is licensed under the [MIT](LICENSE) license.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines][ms_trademark_guidelines].
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.

<!-- references -->
[upstream_github]: https://github.com/microsoft/power-platform-skills
[equinor_varia]: https://varia.equinor.com
[fork_compare]: https://github.com/equinor/power-platform-skills/compare/microsoft:power-platform-skills:main...equinor:main
[eds]: https://eds.equinor.com
[gh_copilot_customization]: https://docs.github.com/en/copilot/customizing-copilot
[claude_code_permissions]: https://code.claude.com/docs/en/permissions
[gh_copilot_cli_docs]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli
[msdocs_power_pages_code_sites]: https://learn.microsoft.com/en-us/power-pages/configure/create-code-sites
[msdocs_power_pages_api]: https://learn.microsoft.com/en-us/rest/api/power-platform/powerpages/websites
[msdocs_generative_pages]: https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/generative-page-external-tools
[msdocs_code_apps]: https://learn.microsoft.com/power-apps/developer/code-apps/
[msdocs_pac_cli]: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference
[ms_trademark_guidelines]: https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general
