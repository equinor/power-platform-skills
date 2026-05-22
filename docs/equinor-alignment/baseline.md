# Equinor Alignment Baseline

This baseline captures the standards that should guide the internal Equinor variant of this Power Platform plugin marketplace. It is the source document for plugin reviews, publication decisions, and future automation.

The baseline is intentionally conservative. It does not approve any plugin for broad internal use by itself. It defines what must be checked before a plugin can be piloted, published, or recommended.

## Alignment Scope

Apply this baseline to:

- Marketplace manifests and plugin metadata.
- Agent, skill, command, hook, MCP, and script content bundled in plugins.
- Generated Power Platform artifacts and generated frontend code.
- Internal publication through GitHub, Varia, TechDocs, and related discovery channels.

Do not use this baseline as a substitute for Architecture Contract approval, data owner accountability, security review, or a documented deviation permit when a technology or data handling pattern requires one.

## Core Decisions

| Topic | Baseline decision |
| --- | --- |
| Canonical Power Platform source | Use `equinor/powerplatform` as the preferred source of truth for internally governed Power Platform plugins. |
| Marketplace pattern | Use dual manifests for GitHub Copilot and Claude compatibility, following the `equinor/techradar` pattern. |
| Central marketplace | Treat `equinor/copilot-plugins` as experimental aggregation unless it becomes the official corporate marketplace. |
| Discovery | Use Varia catalog and TechDocs for internal discovery, with Architecture Contract links where components are published. |
| First publication wave | Publish the alignment and review workflow before any app-generating plugin. |
| Production interaction | Skills, agents, and MCP servers must not interact with production systems by default for development purposes. |
| Tech Radar gate | `Hold` stops until an approved deviation permit exists. `Assess` requires Architecture Contract dialogue before production use. `Trial` and `Adopt` can proceed subject to normal governance. |
| Frontend generation | Prefer Equinor Design System packages, tokens, icons, accessibility guidance, Figma, and Storybook for generated React UI. |

## Equinor Agent Skills Guidance

Source: `equinor/developer:docs/guidelines/skills/index.md`.

Agent Skills are an approved way to capture repeatable expertise for coding agents in Equinor, but they carry dependency-like risk because they may bundle executable scripts and load organizational context into an agent session.

Required implications for this repository:

- Prefer project-scoped skills over personal skills for shared Equinor guidance.
- Review every `SKILL.md`, script, resource, hook, and MCP configuration before publication.
- Keep skill descriptions specific enough for reliable activation.
- Keep `SKILL.md` concise and move detailed reference material into `references/` or shared docs.
- Never hardcode secrets, API keys, tokens, or sensitive internal details in skills.
- Version shared skills and plugins so consumers can pin reviewed versions.
- Treat external or upstream skill content like a code dependency and pin to reviewed commits where practical.
- Do not use skills to interact with components of production systems for development purposes.

## MCP Security Guidance

Sources: `equinor/developer:docs/guidelines/mcp/index.md` and `docs/guidelines/mcp/security.md`.

MCP servers run with user permissions and may execute code, read files, access environment variables, and make network calls. MCP support is limited in Equinor and requires careful evaluation.

Required implications for this repository:

- Do not enable MCP-dependent workflows by default for all users.
- Document every bundled or required MCP server, transport, permissions, network calls, and data access.
- Prefer HTTPS transport for remote MCP where possible.
- Avoid STDIO for production use because it is difficult to secure.
- Require OAuth with Entra ID for MCP servers that access Equinor services when applicable.
- Pin MCP server versions when possible and review the pinned version before use.
- Do not use MCP servers to interact with production databases, web servers, or other production components for development purposes.
- External services that process Equinor data require approval according to Equinor data handling policies.

## Power Platform Governance

Sources: `equinor/powerplatform:docs/governance/zone/index.md`, `admin/compliance_working_requirements.md`, and `admin/security/dlp-management.md`.

Power Platform governance in Equinor is organized around Green, Yellow, and Red zones. Each plugin and skill must state which zone and user persona it supports.

Required implications for this repository:

- State the supported zone for each plugin and relevant skill.
- State the intended user persona, such as personal maker, certified citizen developer, certified citizen agent creator, or professional IT developer.
- State the data classification ceiling. The platform does not support `EQUINOR-CONFIDENTIAL` information in the current documented position.
- Make solution owners and creators accountable for data classification, sharing, and compliance decisions.
- Document connector use and DLP impact for generated apps, generated flows, custom connectors, HTTP endpoints, Dataverse, SharePoint, and other service integrations.
- Keep Green Zone guidance restrictive: approved service-specific connectors only, no custom connectors by default, and no uncontrolled external endpoints.
- Treat Yellow Zone guidance as certified and controlled experimentation with overlays and explicit risk ownership.
- Treat Red Zone guidance as production-oriented and dependent on Architecture Contract, CI, environment owner, and track decisions.
- For outward-facing Power Pages or external sharing scenarios, require explicit mitigation guidance before pilot publication.

## Technology Radar Policy

Sources: `equinor/developer:docs/tools-and-dependencies/standard-and-recommended-tools.md`, `equinor/techradar:schemas/blip-schema.json`, and `equinor/techradar:blips/model_context_protocol.yaml`.

Technology choices must be aligned with the Equinor Information Technology Radar.

Required implications for this repository:

- Scan plugin manifests, skill instructions, generated templates, dependencies, and recommended stacks for named technologies.
- Stop when a recommended technology has `Hold` status unless the user provides an approved deviation permit.
- Require Architecture Contract dialogue before production use of `Assess` technologies.
- Allow `Trial` and `Adopt` technologies subject to normal architecture, security, and data governance.
- Treat missing radar entries as an explicit review item rather than silently assuming approval.
- Do not recommend production use of technologies outside the radar without documenting the architecture discussion path.

Known relevant radar facts from the initial research:

- React: `Adopt`.
- Model Context Protocol: `Adopt`, with notes to prefer HTTPS, avoid STDIO for production, require authentication, and track Equinor security classification where possible.
- Power Apps Studio: `Adopt`.
- Retrieval Augmented Generation: `Assess`.

## Equinor Design System Guidance

Sources: `equinor/design-system`, `eds.equinor.com`, and `storybook.eds.equinor.com`.

Frontend-generating plugins must align with the Equinor Design System unless a platform constraint prevents it.

Required implications for this repository:

- Prefer `@equinor/eds-core-react` for React component generation.
- Prefer `@equinor/eds-tokens` for design tokens and avoid unmanaged hardcoded design systems.
- Prefer `@equinor/eds-icons` for icons when relevant.
- Consider `@equinor/eds-data-grid-react` for data grid scenarios.
- Use EDS accessibility expectations, including keyboard navigation, meaningful labels, visible focus, adequate spacing, and WCAG 2.1 AA intent.
- Use Figma and Storybook as design and component references when generating UI patterns.
- Document exceptions when a plugin must use Fluent UI, platform-native controls, or framework-specific styling instead of EDS.

## Varia And Internal Discoverability

Sources: `equinor/varia:docs/users/index.md`, `docs/users/techdocs.md`, and `static-content/soundcheck/check-component-has-ac-link.yaml`.

Varia is the internal developer portal. It imports catalog entities from `catalog-info.yaml` files in GitHub repositories and can publish TechDocs.

Required implications for this repository:

- Add Varia catalog metadata when the internal publication repository is chosen.
- Include TechDocs annotations when documentation should be browsable in Varia.
- Include Architecture Contract links for components where Varia Soundcheck expects them.
- Treat catalog metadata and TechDocs as `EQUINOR-INTERNAL` once imported into Varia.
- Do not place restricted details, secrets, or private access group information in Varia-visible metadata or documentation.

## Publication Readiness

A plugin is not ready for broad internal recommendation until it has:

- Named owner and support channel.
- Reviewed `plugin.json`, marketplace entry, and version.
- Reviewed skills, agents, hooks, scripts, resources, and MCP configuration.
- Documented supported zones and personas.
- Documented data classification ceiling and production restrictions.
- Documented DLP, connector, and Architecture Contract implications.
- Documented Tech Radar status for recommended technologies.
- Documented EDS position for generated UI.
- Local installation test evidence.
- Rollback, uninstall, or removal guidance.

## Initial Publication Waves

| Wave | Candidate | Rationale |
| --- | --- | --- |
| 0 | Alignment and review workflow | Tests publication without enabling app generation or Power Platform modification. |
| 1 | Low-risk governance and readiness skills | Assists teams without touching production systems or creating assets. |
| 2 | `canvas-apps` and `mcp-apps` controlled pilots | Requires MCP restrictions, approved users, and explicit no-production-system language. |
| 3 | `power-pages`, `model-apps`, and app-generating `code-apps-preview` workflows | Requires stronger zone, Dataverse, external exposure, connector, and Architecture Contract handling. |

## Source Inventory

| Source | Relevant files or locations | Use in this repo |
| --- | --- | --- |
| `equinor/developer` | `docs/guidelines/skills/index.md` | Agent Skills safety and sharing rules. |
| `equinor/developer` | `docs/guidelines/mcp/index.md`, `docs/guidelines/mcp/security.md` | MCP risk and security constraints. |
| `equinor/developer` | `docs/tools-and-dependencies/standard-and-recommended-tools.md` | Standard tools, React guidance, Tech Radar production policy. |
| `equinor/powerplatform` | `docs/governance/zone/index.md` | Green, Yellow, Red zone model. |
| `equinor/powerplatform` | `admin/compliance_working_requirements.md` | Data classification, WR0158, WR1211, solution owner accountability. |
| `equinor/powerplatform` | `admin/security/dlp-management.md` | Connector assessment, DLP policy, CI and Tech Radar traceability. |
| `equinor/techradar` | `schemas/blip-schema.json`, `blips/*.yaml` | Technology lifecycle validation. |
| `equinor/techradar` | `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`, `README.md` | Domain-owned dual marketplace pattern. |
| `equinor/design-system` | package docs, Storybook, Figma, ADRs | EDS frontend generation guidance. |
| `equinor/varia` | `docs/users/index.md`, `docs/users/techdocs.md`, Soundcheck checks | Varia catalog, TechDocs, and Architecture Contract discoverability. |
| `equinor/copilot-plugins` | `.github/plugin/marketplace.json`, `CONTRIBUTING.md` | Experimental central marketplace and contribution conventions. |

## Gated Documents To Fetch When Needed

Fetch these only when a plugin review reaches a decision that depends on them:

- TR1621 policy details for technology alignment and deviation handling.
- WR0158 and WR1211 full documents if the public compliance extracts are insufficient.
- TR2375 technical requirements for information security.
- GL0797 for human-centered design process.
- GL0847 for privileged access and privileged accounts.
- GL0848 for system accounts.
- Power Platform DLP connector registry and connector-specific assessment records.
- Architecture Contract examples for Power Platform solutions and internal developer tooling.
- Internal plugin marketplace roadmap or ownership decision if `equinor/copilot-plugins` changes status.