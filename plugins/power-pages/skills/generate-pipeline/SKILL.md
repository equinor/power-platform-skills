---
name: generate-pipeline
description: >-
  Generates a CI/CD pipeline YAML for automated Power Pages deployments (GitHub Actions
  or Azure DevOps). Creates pipeline file and a setup guide. Use when asked to: "set up
  ci/cd", "create pipeline", "generate pipeline", "create github actions workflow",
  "create ado pipeline", "create azure devops pipeline", "automate deployments",
  "set up automated deployment", or "create deployment workflow".
user-invocable: true
argument-hint: "Optional: 'github' or 'ado' to skip platform selection"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, AskUserQuestion
model: opus
hooks:
  Stop:
    - hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/generate-pipeline/scripts/validate-pipeline.js"'
          timeout: 30
        - type: prompt
          prompt: |
            Check whether the generate-pipeline skill completed successfully. Return { "ok": true } if ALL of the following are true, otherwise { "ok": false, "reason": "..." }:
            1. The CI/CD platform (GitHub Actions or Azure DevOps) was selected by the user
            2. Environment URLs and credentials structure were gathered from the user
            3. A pipeline YAML file was written (azure-pipelines.yml or .github/workflows/deploy.yml)
            4. A setup guide was written to docs/ci-cd-setup.md
            5. A completion summary was presented listing files created and manual steps required
          timeout: 30
---

# generate-pipeline

Generates CI/CD pipeline YAML for Power Pages deployments. Pure file generation — no API calls needed. Reads `.solution-manifest.json` if present to include solution export/import blocks.

## Prerequisites

- `powerpages.config.json` exists in the project root
- User knows which CI/CD platform they use (GitHub Actions or Azure DevOps)

## Phases

### Phase 1 — Detect Project Context

**Create all tasks upfront at the start of this phase.**

Tasks to create:
1. "Detect project context"
2. "Choose CI/CD platform"
3. "Gather pipeline parameters"
4. "Generate pipeline YAML"
5. "Generate setup guide"
6. "Verify generated files"
7. "Present summary"

Steps:
1. Locate `powerpages.config.json` — read `siteName`, `compiledPath`
2. Check for existing pipeline files:
   - `glob('azure-pipelines.yml')` — ADO already configured?
   - `glob('.github/workflows/*.yml')` — GitHub Actions already configured?
3. Check for `.solution-manifest.json` — if present, pipeline will include solution blocks
4. Check for existing `docs/ci-cd-setup.md`
5. Report findings: "Project: `{siteName}`. Solution manifest: found/not found. Existing pipeline: found/not found."

If an existing pipeline file is found, ask user: "A pipeline file already exists at `{path}`. Overwrite, or create a new file alongside it?"

### Phase 2 — Choose CI/CD Platform

Ask user via `AskUserQuestion`:

> "Which CI/CD platform do you use?
> 1. **GitHub Actions** — Generates `.github/workflows/deploy.yml` (recommended for GitHub repos)
> 2. **Azure DevOps** — Generates `azure-pipelines.yml` (recommended for ADO repos)"

If the user passed `github` or `ado` as an argument, skip this question and use the provided value.

### Phase 3 — Gather Pipeline Parameters

Ask user via `AskUserQuestion` for all required values:

**Always ask**:
1. **Dev environment URL** (e.g., `https://contoso-dev.crm.dynamics.com`)
2. **How many environments?** (Dev only / Dev + Staging / Dev + Staging + Prod)
3. If Staging: **Staging environment URL**
4. If Prod: **Production environment URL**

**For credential structure** (explain they set these as secrets — never ask for actual secret values):
5. Where is the **service principal app ID** stored? (e.g., "We'll add it as `APP_ID` secret")
6. Confirm: Does the team already have an Entra ID app registration for deployments? (Yes/No — if No, document creation steps in the setup guide)

**Optional** (auto-detect from `.solution-manifest.json` if present):
7. **Solution unique name** — pre-fill from manifest if available, ask to confirm

Present a summary of collected parameters and ask for confirmation before generating files.

### Phase 4 — Generate Pipeline YAML

Refer to `${CLAUDE_PLUGIN_ROOT}/references/cicd-pipeline-patterns.md` for full template content.

**For GitHub Actions** — write `.github/workflows/deploy.yml`:
- Include jobs: `build`, `deploy-dev`, and additional deploy jobs per environment selected
- Include commented solution export/import jobs if `.solution-manifest.json` exists
- Replace placeholder values: `NODE_VERSION`, environment names, solution name

**For Azure DevOps** — write `azure-pipelines.yml`:
- Include stages: `Build`, `DeployDev`, and additional stages per environment selected
- Include commented solution export/import stages if `.solution-manifest.json` exists
- Replace placeholder values in the template

**Customizations to apply**:
- Set correct `NODE_VERSION` (read from project's `package.json` `engines.node` field, or default to `20.x`)
- Uncomment solution blocks and fill in `SOLUTION_NAME` if `.solution-manifest.json` exists
- Adjust environment names to match the URLs provided by user

### Phase 5 — Generate Setup Guide

Create `docs/ci-cd-setup.md` (create `docs/` directory if needed):

Include these sections:

1. **Prerequisites** — Node.js, PAC CLI, pipeline platform account
2. **Create App Registration** (if user said they don't have one yet):
   - Azure Portal steps: App registrations → New → copy Application ID and Tenant ID
   - Create client secret: Certificates & secrets → New client secret
3. **Assign App to Power Platform Environments**:
   - Power Platform Admin Center → Environments → {each env} → Settings → Users → App Users → New app user → assign System Administrator role
   - Repeat for each environment (Dev, Staging, Prod)
4. **Configure Secrets** (platform-specific):
   - GitHub: Settings → Secrets and variables → Actions → New repository secret (APP_ID, CLIENT_SECRET, TENANT_ID)
   - ADO: Pipelines → Library → Variable Groups → Add secrets
5. **Configure Environment Variables** (platform-specific):
   - GitHub: Settings → Environments → {env name} → Add environment variable (DEV_ENV_URL, etc.)
   - ADO: Per-pipeline Variables → add DEV_ENV_URL, STAGING_ENV_URL, PROD_ENV_URL
6. **Add Approval Gates** (for Staging and Production):
   - GitHub: Settings → Environments → {env} → Protection rules → Required reviewers
   - ADO: Pipelines → Environments → {env} → Approvals and checks → Add approval
7. **ADO-specific: Grant Pipeline Permissions** (manual step):
   - ADO → Project Settings → Agent Pools → Security → grant this pipeline access
   - ADO → Pipelines → Environments → {env} → Security → grant this pipeline access
8. **Trigger First Run**:
   - GitHub: Push to `main` branch
   - ADO: Run pipeline manually from Pipelines UI

> **Important**: Always note in the guide that **agent pool permissions in ADO cannot be automated** — this is a manual step in the ADO portal.

### Phase 6 — Verify Generated Files

1. Confirm pipeline file exists and is non-empty
2. Confirm `docs/ci-cd-setup.md` exists
3. Check pipeline YAML for required keys:
   - **GitHub Actions**: `on:`, `jobs:`, at least one job with `pac pages upload-code-site`
   - **ADO**: `trigger:`, `stages:`, at least one stage with `pac pages upload-code-site`
4. Confirm no unreplaced placeholder tokens (search for `{` and `}` not in comments)

5. Commit all generated files:
   ```bash
   git add {pipelineFile} docs/ci-cd-setup.md
   git commit -m "Add CI/CD pipeline for Power Pages deployment"
   ```

### Phase 7 — Present Summary

Display a summary:

| File | Purpose |
|---|---|
| `{pipelineFile}` | CI/CD pipeline definition |
| `docs/ci-cd-setup.md` | Step-by-step setup guide |

**Manual steps required before pipeline will run**:
1. Create app registration in Entra ID (if not already done)
2. Assign app user role in each environment (Power Platform Admin Center)
3. Add secrets: APP_ID, CLIENT_SECRET, TENANT_ID
4. Add environment variables: DEV_ENV_URL (+ staging/prod URLs)
5. Configure approval gates for staging/production
6. [ADO only] Grant pipeline access to agent pool and environments

> "See `docs/ci-cd-setup.md` for detailed instructions for each step above."

**Known limitation**: Azure DevOps agent pool permissions must be granted manually in the ADO portal — this step cannot be automated.

## Key Decision Points (Wait for User)

1. **Phase 2**: Platform selection (GitHub Actions vs Azure DevOps)
2. **Phase 3**: Number of environments and their URLs
3. **Phase 3**: Parameter confirmation before file generation

## Error Handling

- If no `powerpages.config.json` found: stop and advise running `/power-pages:create-site` first
- If existing pipeline file found: ask before overwriting

## Progress Tracking Table

| Task subject | activeForm | Description |
|---|---|---|
| Detect project context | Detecting project context | Find powerpages.config.json, check for existing pipeline files and solution manifest |
| Choose CI/CD platform | Choosing CI/CD platform | Ask user: GitHub Actions or Azure DevOps |
| Gather pipeline parameters | Gathering pipeline parameters | Collect environment URLs, number of environments, solution name |
| Generate pipeline YAML | Generating pipeline YAML | Write azure-pipelines.yml or .github/workflows/deploy.yml from template |
| Generate setup guide | Generating setup guide | Write docs/ci-cd-setup.md with app registration, secret setup, approval gate steps |
| Verify generated files | Verifying generated files | Confirm files exist, check required YAML keys, no unreplaced tokens, commit |
| Present summary | Presenting summary | List files created, highlight all required manual steps |
