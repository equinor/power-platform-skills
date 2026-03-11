---
name: import-solution
description: >-
  Imports a Dataverse solution zip into a target environment, with optional staged import
  for dependency checking before committing. Use when asked to: "import solution",
  "install solution", "deploy solution zip", "push solution to environment",
  "deploy to staging", "deploy to production", or "install site in new environment".
user-invocable: true
argument-hint: "Optional: path to solution zip file"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, AskUserQuestion
model: opus
hooks:
  Stop:
    - hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/import-solution/scripts/validate-import.js"'
          timeout: 30
        - type: prompt
          prompt: |
            Check whether the import-solution skill completed successfully. Return { "ok": true } if ALL of the following are true, otherwise { "ok": false, "reason": "..." }:
            1. A valid solution zip file was located and verified to contain Solution.xml
            2. Import options (overwrite, staged vs direct) were confirmed with the user
            3. An async import job was triggered and polled to completion
            4. The solution was verified to exist in the target environment after import
            5. A completion summary was presented showing imported component count (or warnings/errors)
          timeout: 30
---

# import-solution

Imports a solution zip into a target Dataverse environment via `ImportSolutionAsync`. Supports optional staged import via `StageSolution` to check for missing dependencies before committing.

## Prerequisites

- PAC CLI installed and authenticated to the **target** environment
- Azure CLI installed and logged in
- Solution zip file exists on disk (produced by `export-solution`)

## Phases

### Phase 1 — Verify Prerequisites

**Create all tasks upfront at the start of this phase.**

Tasks to create:
1. "Verify prerequisites"
2. "Locate solution file"
3. "Configure import"
4. "Stage solution (dependency check)"
5. "Import solution"
6. "Verify import"
7. "Present summary"

Steps:
1. Run `pac env who` — extract `environmentUrl` (verify this is the **target** environment)
2. Run `az account get-access-token --resource "{environmentUrl}" --query accessToken -o tsv` — capture token
3. Verify API access: `GET {environmentUrl}/api/data/v9.2/WhoAmI`
4. Present target environment URL and ask user to confirm this is correct before proceeding.

> **Important**: Confirm the target environment with the user — importing to the wrong environment can be disruptive.

If any check fails, stop (reference `${CLAUDE_PLUGIN_ROOT}/references/dataverse-prerequisites.md`).

### Phase 2 — Locate Solution File

1. If a zip path was provided as an argument, use it directly
2. Otherwise, search for solution zips: `glob('**/*.zip', { ignore: ['**/node_modules/**'] })`
3. For each found zip, verify it contains `Solution.xml`:
   - Use `Bash`: `unzip -l "{zipPath}" 2>/dev/null | grep -q Solution.xml`
4. If multiple valid zips found: ask user to choose via `AskUserQuestion`
5. If no valid zip found: stop and explain — run `export-solution` first or provide the zip path

Present the selected zip file details (name, size, path) and confirm with user.

### Phase 3 — Configure Import

Ask user (via `AskUserQuestion`):

> **Key Decision Point**: **Staged vs Direct import**
> - **Staged (Recommended for managed solutions)**: Runs `StageSolution` first to check for missing dependencies. Shows issues before committing the import. Safer — the stage step is fully reversible.
> - **Direct**: Skips staging and imports immediately. Faster but may fail mid-import if dependencies are missing.

Also ask:
- **Overwrite unmanaged customizations?** (default: Yes) — needed when target has customized the same components
- **Publish workflows after import?** (default: Yes)

### Phase 4 — Stage Solution (Conditional)

Only run this phase if the user chose staged import in Phase 3.

Refer to `${CLAUDE_PLUGIN_ROOT}/references/solution-api-patterns.md` Section 5a.

1. Base64-encode the zip file:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/encode-solution-file.js" --zipPath "{zipPath}"
   ```
2. `POST {envUrl}/api/data/v9.2/StageSolution` with `CustomizationFile: {base64}`
3. Parse `StageSolutionResults`:
   - Extract `StageSolutionUploadId` (used in Phase 5 instead of re-encoding the file)
   - Check `MissingDependencies` array
4. If `MissingDependencies` is non-empty:
   - List each missing dependency with its type and name
   - Ask user: "These dependencies are missing in the target environment. Proceed anyway (may fail) or cancel to install dependencies first?"
   - If cancel: stop and advise installing missing dependencies
5. If `MissingDependencies` is empty: report "No missing dependencies found. Ready to import."

### Phase 5 — Import Solution

Refer to `${CLAUDE_PLUGIN_ROOT}/references/solution-api-patterns.md` Section 5b.

1. Prepare request body:
   - If staged (Phase 4 ran): use `{ StageSolutionUploadId: "{id}", OverwriteUnmanagedCustomizations: true, PublishWorkflows: true }`
   - If direct: encode zip file and use `{ CustomizationFile: "{base64}", OverwriteUnmanagedCustomizations: {choice}, PublishWorkflows: {choice} }`

2. `POST {envUrl}/api/data/v9.2/ImportSolutionAsync`
3. Extract `AsyncOperationId` and `ImportJobId`
4. Report: "Import job started: `{AsyncOperationId}`. Polling for completion..."

Run `scripts/poll-async-operation.js`:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/poll-async-operation.js" \
  --asyncJobId "{AsyncOperationId}" \
  --envUrl "{envUrl}" \
  --token "{token}" \
  --intervalMs 8000 \
  --maxAttempts 75
```

Handle poll result:
- `Succeeded`: proceed to Phase 6
- `Failed`: show error message, query import job for component-level errors, stop
- `Timeout`: inform user, advise checking admin center

### Phase 6 — Verify Import

1. Query solution to confirm it exists and version matches:
   ```
   GET {envUrl}/api/data/v9.2/solutions?$filter=uniquename eq '{solutionName}'&$select=solutionid,uniquename,version,ismanaged
   ```

2. Query import job for component results:
   ```
   GET {envUrl}/api/data/v9.2/importjobs({importJobId})?$select=solutionname,completedon,progress,data
   ```
   - Parse the `data` XML field for per-component results (look for `result="failure"` entries)
   - Count: imported successfully / warnings / failures

3. Write `.last-import.json` marker to project root:
   ```json
   {
     "importedAt": "<ISO timestamp>",
     "solutionName": "<name>",
     "version": "<version>",
     "targetEnvironment": "<envUrl>",
     "asyncOperationId": "<id>",
     "importJobId": "<id>",
     "componentResults": { "success": N, "warning": N, "failure": N }
   }
   ```

### Phase 7 — Present Summary

Display a summary table:

| Item | Value |
|---|---|
| Solution | `{solutionName}` v`{version}` |
| Target environment | `{envUrl}` |
| Managed | Yes / No |
| Components imported | N success, N warning, N failure |
| Import job | `{importJobId}` |

If Power Pages components were imported (componentType 61 found in solution):
> "Power Pages components were imported. If this is a new environment, run `/power-pages:activate-site` to provision the site."

## Key Decision Points (Wait for User)

1. **Phase 1**: Confirm target environment — import is not easily undoable for managed solutions
2. **Phase 2**: Select zip file if multiple found
3. **Phase 3**: Staged vs direct import; overwrite customizations
4. **Phase 4**: Proceed despite missing dependencies

## Error Handling

- Component-level import failures: report in summary, do not block overall completion
- If import async operation fails: show `friendlyMessage` from async operation record
- Never attempt rollback — report what succeeded and what failed

## Progress Tracking Table

| Task subject | activeForm | Description |
|---|---|---|
| Verify prerequisites | Verifying prerequisites | Confirm PAC CLI auth, acquire token, verify target environment with user |
| Locate solution file | Locating solution file | Find and validate solution zip, confirm Solution.xml present |
| Configure import | Configuring import | Ask: staged vs direct, overwrite customizations, publish workflows |
| Stage solution (dependency check) | Staging solution | Run StageSolution to check for missing dependencies before committing |
| Import solution | Importing solution | POST ImportSolutionAsync, poll until complete |
| Verify import | Verifying import | Confirm solution version in target, parse component results, write .last-import.json |
| Present summary | Presenting summary | Show component counts (success/warning/failure), suggest activate-site if applicable |
