# CI/CD Pipeline Patterns

Reference patterns for generating CI/CD pipelines for Power Pages deployments. Used by the `generate-pipeline` skill.

---

## Service Principal Authentication (PAC CLI)

Both ADO and GitHub Actions pipelines authenticate PAC CLI using a service principal (app registration).

### Prerequisites (manual steps — cannot be automated)
1. Create an app registration in Entra ID (Azure AD)
2. Add the app as a **System Administrator** or **Power Pages Site Owner** in each target environment (Power Platform Admin Center → Environments → Settings → Users → App Users)
3. Store credentials as secrets in ADO or GitHub

### PAC CLI Auth Command

```bash
pac auth create \
  --applicationId "$APP_ID" \
  --clientSecret "$CLIENT_SECRET" \
  --tenant "$TENANT_ID" \
  --environment "$ENV_URL" \
  --name "pipeline-auth"
```

For certificate-based auth (more secure, recommended for production):
```bash
pac auth create \
  --applicationId "$APP_ID" \
  --certificateThumbprint "$CERT_THUMBPRINT" \
  --tenant "$TENANT_ID" \
  --environment "$ENV_URL"
```

### Power Pages Upload Step

```bash
pac pages upload-code-site --rootPath "."
```

This command uploads the compiled site from the `compiledPath` defined in `powerpages.config.json`. Always run `npm run build` before this step.

---

## Azure DevOps Pipeline (azure-pipelines.yml)

### Full ADO Pipeline Template

```yaml
# azure-pipelines.yml
# Power Pages CI/CD Pipeline
# Requires pipeline variables: APP_ID, CLIENT_SECRET, TENANT_ID
# Requires environment-specific variables: DEV_ENV_URL, STAGING_ENV_URL, PROD_ENV_URL

trigger:
  branches:
    include:
      - main
      - release/*

pr:
  branches:
    include:
      - main

variables:
  nodeVersion: '20.x'
  # Solution export/import variables (uncomment if using solution-based deployment)
  # SOLUTION_NAME: 'ContosoSite'

stages:

  # ─── Build ────────────────────────────────────────────────────────────────
  - stage: Build
    displayName: 'Build'
    jobs:
      - job: BuildSite
        displayName: 'Build Power Pages Site'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '$(nodeVersion)'
            displayName: 'Install Node.js'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npm run build
            displayName: 'Build site'

          - task: PublishPipelineArtifact@1
            inputs:
              targetPath: 'dist'
              artifact: 'site-build'
            displayName: 'Publish build artifact'

  # ─── Deploy to Dev ─────────────────────────────────────────────────────────
  - stage: DeployDev
    displayName: 'Deploy to Dev'
    dependsOn: Build
    condition: succeeded()
    jobs:
      - deployment: DeployToDev
        displayName: 'Deploy to Dev Environment'
        environment: 'dev'
        pool:
          vmImage: 'ubuntu-latest'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: DownloadPipelineArtifact@2
                  inputs:
                    artifact: 'site-build'
                    path: 'dist'

                - script: |
                    dotnet tool install --global Microsoft.PowerApps.CLI.Tool 2>/dev/null || true
                    pac auth create \
                      --applicationId "$(APP_ID)" \
                      --clientSecret "$(CLIENT_SECRET)" \
                      --tenant "$(TENANT_ID)" \
                      --environment "$(DEV_ENV_URL)"
                    pac pages upload-code-site --rootPath "."
                  displayName: 'Deploy to Dev'
                  env:
                    APP_ID: $(APP_ID)
                    CLIENT_SECRET: $(CLIENT_SECRET)
                    TENANT_ID: $(TENANT_ID)
                    DEV_ENV_URL: $(DEV_ENV_URL)

  # ─── Deploy to Staging ─────────────────────────────────────────────────────
  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToStaging
        displayName: 'Deploy to Staging Environment'
        environment: 'staging'
        # Add an approval check in ADO: Environments → staging → Approvals and checks
        pool:
          vmImage: 'ubuntu-latest'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: DownloadPipelineArtifact@2
                  inputs:
                    artifact: 'site-build'
                    path: 'dist'

                - script: |
                    dotnet tool install --global Microsoft.PowerApps.CLI.Tool 2>/dev/null || true
                    pac auth create \
                      --applicationId "$(APP_ID)" \
                      --clientSecret "$(CLIENT_SECRET)" \
                      --tenant "$(TENANT_ID)" \
                      --environment "$(STAGING_ENV_URL)"
                    pac pages upload-code-site --rootPath "."
                  displayName: 'Deploy to Staging'
                  env:
                    APP_ID: $(APP_ID)
                    CLIENT_SECRET: $(CLIENT_SECRET)
                    TENANT_ID: $(TENANT_ID)
                    STAGING_ENV_URL: $(STAGING_ENV_URL)

  # ─── Deploy to Production ──────────────────────────────────────────────────
  - stage: DeployProd
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToProduction
        displayName: 'Deploy to Production Environment'
        environment: 'production'
        # Add an approval check in ADO: Environments → production → Approvals and checks
        pool:
          vmImage: 'ubuntu-latest'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: DownloadPipelineArtifact@2
                  inputs:
                    artifact: 'site-build'
                    path: 'dist'

                - script: |
                    dotnet tool install --global Microsoft.PowerApps.CLI.Tool 2>/dev/null || true
                    pac auth create \
                      --applicationId "$(APP_ID)" \
                      --clientSecret "$(CLIENT_SECRET)" \
                      --tenant "$(TENANT_ID)" \
                      --environment "$(PROD_ENV_URL)"
                    pac pages upload-code-site --rootPath "."
                  displayName: 'Deploy to Production'
                  env:
                    APP_ID: $(APP_ID)
                    CLIENT_SECRET: $(CLIENT_SECRET)
                    TENANT_ID: $(TENANT_ID)
                    PROD_ENV_URL: $(PROD_ENV_URL)

# ─── Solution Export/Import (uncomment to enable solution-based deployment) ──
# Add these stages between Build and DeployDev if using Dataverse solutions:
#
#   - stage: ExportSolution
#     dependsOn: Build
#     jobs:
#       - job: ExportSolution
#         steps:
#           - script: |
#               pac auth create --applicationId "$(APP_ID)" --clientSecret "$(CLIENT_SECRET)" --tenant "$(TENANT_ID)" --environment "$(DEV_ENV_URL)"
#               pac solution export --name "$(SOLUTION_NAME)" --path ./solutions --async
#             displayName: 'Export solution from Dev'
#           - task: PublishPipelineArtifact@1
#             inputs:
#               targetPath: 'solutions'
#               artifact: 'solution'
#
#   - stage: ImportSolution
#     dependsOn: ExportSolution
#     jobs:
#       - job: ImportSolution
#         steps:
#           - task: DownloadPipelineArtifact@2
#             inputs:
#               artifact: 'solution'
#               path: 'solutions'
#           - script: |
#               pac auth create --applicationId "$(APP_ID)" --clientSecret "$(CLIENT_SECRET)" --tenant "$(TENANT_ID)" --environment "$(STAGING_ENV_URL)"
#               pac solution import --path ./solutions/$(SOLUTION_NAME).zip --async
#             displayName: 'Import solution to Staging'
```

### ADO Pipeline Variables Setup

Set these as secret pipeline variables in ADO (Pipelines → Library → Variable Groups, or per-pipeline Variables):

| Variable | Description | Secret? |
|---|---|---|
| `APP_ID` | Service principal Application (client) ID | Yes |
| `CLIENT_SECRET` | Service principal client secret | Yes |
| `TENANT_ID` | Azure AD tenant ID | No |
| `DEV_ENV_URL` | Dev environment URL (e.g., `https://contoso-dev.crm.dynamics.com`) | No |
| `STAGING_ENV_URL` | Staging environment URL | No |
| `PROD_ENV_URL` | Production environment URL | No |

### ADO Manual Steps Required

> **IMPORTANT**: These steps cannot be automated from Claude and must be done manually in the ADO portal:

1. **Create service connection** (optional but recommended): ADO Project → Project Settings → Service Connections → New service connection → Azure Resource Manager
2. **Add approval gates**: ADO → Pipelines → Environments → `staging` → Approvals and checks → Add approval → specify approvers
3. **Add approval gates for production**: same for `production` environment
4. **Grant pipeline permission to agent pool**: ADO → Project Settings → Agent Pools → select pool → Security → grant pipeline access
5. **Grant pipeline permission to environments**: ADO → Pipelines → Environments → select environment → Security → grant pipeline access

---

## GitHub Actions Workflow (.github/workflows/deploy.yml)

### Full GitHub Actions Template

```yaml
# .github/workflows/deploy.yml
# Power Pages CI/CD Workflow
# Requires repository secrets: APP_ID, CLIENT_SECRET, TENANT_ID
# Requires environment secrets: DEV_ENV_URL, STAGING_ENV_URL, PROD_ENV_URL

name: Deploy Power Pages Site

on:
  push:
    branches: [main, 'release/**']
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'
  # SOLUTION_NAME: 'ContosoSite'  # Uncomment if using solution-based deployment

jobs:

  # ─── Build ────────────────────────────────────────────────────────────────
  build:
    name: Build Site
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: site-build
          path: dist/
          retention-days: 5

  # ─── Deploy to Dev ─────────────────────────────────────────────────────────
  deploy-dev:
    name: Deploy to Dev
    runs-on: ubuntu-latest
    needs: build
    environment: dev
    if: github.event_name != 'pull_request'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: site-build
          path: dist/

      - name: Install PAC CLI
        run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool

      - name: Authenticate PAC CLI
        run: |
          pac auth create \
            --applicationId "${{ secrets.APP_ID }}" \
            --clientSecret "${{ secrets.CLIENT_SECRET }}" \
            --tenant "${{ secrets.TENANT_ID }}" \
            --environment "${{ vars.DEV_ENV_URL }}"

      - name: Deploy to Dev
        run: pac pages upload-code-site --rootPath "."

  # ─── Deploy to Staging ─────────────────────────────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: deploy-dev
    environment: staging
    # GitHub environment protection rules handle approvals
    # Configure at: Settings → Environments → staging → Protection rules
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: site-build
          path: dist/

      - name: Install PAC CLI
        run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool

      - name: Authenticate PAC CLI
        run: |
          pac auth create \
            --applicationId "${{ secrets.APP_ID }}" \
            --clientSecret "${{ secrets.CLIENT_SECRET }}" \
            --tenant "${{ secrets.TENANT_ID }}" \
            --environment "${{ vars.STAGING_ENV_URL }}"

      - name: Deploy to Staging
        run: pac pages upload-code-site --rootPath "."

  # ─── Deploy to Production ──────────────────────────────────────────────────
  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    # GitHub environment protection rules handle approvals
    # Configure at: Settings → Environments → production → Protection rules
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: site-build
          path: dist/

      - name: Install PAC CLI
        run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool

      - name: Authenticate PAC CLI
        run: |
          pac auth create \
            --applicationId "${{ secrets.APP_ID }}" \
            --clientSecret "${{ secrets.CLIENT_SECRET }}" \
            --tenant "${{ secrets.TENANT_ID }}" \
            --environment "${{ vars.PROD_ENV_URL }}"

      - name: Deploy to Production
        run: pac pages upload-code-site --rootPath "."

# ─── Solution Export/Import (uncomment to enable solution-based deployment) ──
# Add these jobs between build and deploy-dev if using Dataverse solutions:
#
#  export-solution:
#    needs: build
#    runs-on: ubuntu-latest
#    steps:
#      - uses: actions/checkout@v4
#      - run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool
#      - run: |
#          pac auth create --applicationId "${{ secrets.APP_ID }}" --clientSecret "${{ secrets.CLIENT_SECRET }}" --tenant "${{ secrets.TENANT_ID }}" --environment "${{ vars.DEV_ENV_URL }}"
#          mkdir -p solutions
#          pac solution export --name "${{ env.SOLUTION_NAME }}" --path ./solutions --async
#      - uses: actions/upload-artifact@v4
#        with:
#          name: solution
#          path: solutions/
#
#  import-solution:
#    needs: export-solution
#    runs-on: ubuntu-latest
#    environment: staging
#    steps:
#      - uses: actions/download-artifact@v4
#        with: { name: solution, path: solutions/ }
#      - run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool
#      - run: |
#          pac auth create --applicationId "${{ secrets.APP_ID }}" --clientSecret "${{ secrets.CLIENT_SECRET }}" --tenant "${{ secrets.TENANT_ID }}" --environment "${{ vars.STAGING_ENV_URL }}"
#          pac solution import --path "./solutions/${{ env.SOLUTION_NAME }}.zip" --async
```

### GitHub Actions Secrets & Variables Setup

**Repository Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Description |
|---|---|
| `APP_ID` | Service principal Application (client) ID |
| `CLIENT_SECRET` | Service principal client secret |
| `TENANT_ID` | Azure AD tenant ID |

**Environment Variables** (Settings → Environments → {env name} → Environment variables):

| Variable | Dev | Staging | Prod |
|---|---|---|---|
| `DEV_ENV_URL` | `https://contoso-dev.crm.dynamics.com` | — | — |
| `STAGING_ENV_URL` | — | `https://contoso-staging.crm.dynamics.com` | — |
| `PROD_ENV_URL` | — | — | `https://contoso.crm.dynamics.com` |

### GitHub Actions Manual Steps Required

> **IMPORTANT**: These steps cannot be automated and must be done in GitHub:

1. **Create environments**: Settings → Environments → New environment (create `dev`, `staging`, `production`)
2. **Add protection rules for staging**: Settings → Environments → staging → Protection rules → Required reviewers → add approvers
3. **Add protection rules for production**: same for `production`
4. **Add secrets**: Settings → Secrets and variables → Actions → New repository secret (for APP_ID, CLIENT_SECRET, TENANT_ID)
5. **Add environment variables**: Settings → Environments → {env} → Add environment variable (for ENV_URL per environment)
