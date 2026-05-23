---
name: copilot-cost
description: >
  Calculate the estimated USD cost of a GitHub Copilot chat session.
  Use when asked about session cost, token spend, how much a conversation cost,
  or to check Copilot spending. Trigger phrases: "session cost", "how much did
  this cost", "token cost", "copilot cost", "spending", "cost breakdown".
---

# Copilot Cost Calculator

Calculates the estimated USD cost of a Copilot chat session by reading local
token usage data from VS Code's `agent-traces.db` and applying rates from
`copilot-models.json`.

## How to invoke

Run the script in a terminal from the workspace root.

### Current session (simple)

```bash
python3 .github/tools/copilot-cost.py SESSION_ID
```

Replace `SESSION_ID` with the last path component of `{{VSCODE_TARGET_SESSION_LOG}}`.

### Current session (verbose)

```bash
python3 .github/tools/copilot-cost.py -v SESSION_ID
```

### All sessions today

```bash
python3 .github/tools/copilot-cost.py --today
python3 .github/tools/copilot-cost.py --today -v
```

## Arguments

| Argument | Description |
|---|---|
| `SESSION_ID` | Optional positional. Defaults to latest session in the DB. |
| `-v` / `--verbose` | Per-turn token and cost breakdown. |
| `--today` | Aggregate all sessions from today. |
| `--pricing PATH` | Override path to `copilot-models.json`. |

## Extracting the session ID

The template variable `{{VSCODE_TARGET_SESSION_LOG}}` contains a path like:

```
/Users/.../debug-logs/6273c9b2-ce02-4a58-b127-82fc9ebec2ec
```

The last path component (`6273c9b2-ce02-4a58-b127-82fc9ebec2ec`) is the session
ID. Extract it and pass it as the positional argument.

## Notes

- macOS and Linux only (reads VS Code local storage).
- Uses only Python stdlib (no dependencies).
- Opens the DB in read-only mode.
- Models not found in the pricing file show "N/A" for cost.
