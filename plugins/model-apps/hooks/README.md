# model-apps hooks

What `hooks.json` wires up, and why.

This prose lived in a `_comment` key inside `hooks.json` itself. Claude Code validates that file
against a closed schema and prints `model-apps: hooks.json: unknown key "_comment" ignored` at
**every session start**, which reads as a plugin misconfiguration to the user (#555, #558). The
documentation belongs here instead; `scripts/validate-hooks-manifests.js` keeps it from drifting
back.

## PreToolUse

| Matcher | Hook | Behaviour |
| --- | --- | --- |
| `Write\|Edit\|MultiEdit` | `validate-write-safety.js` | **Flags** (non-blocking, exit 1) a write outside the cwd, and only during an active model-apps authoring session — that is, when a `genpage-plan.md`, `app-spec.json`, or `model-app-plan.md` marker exists at or under the cwd, which covers both `/genpage` and `/app-builder`. |

## PostToolUse

| Matcher | Hook | Behaviour |
| --- | --- | --- |
| `Skill\|skill` | `run-skill-posttool-validation.js` | Runs the invoked skill's own `scripts/validate*.js`, if it has one. |
| `Write\|Edit\|MultiEdit` | `validate-icon-imports.js` | On every code write, validates `@fluentui/react-icons` imports against `references/verified-icons.txt`. Only named imports can be checked, so a namespace (`import * as`), default, `require(...)` or dynamic `import(...)` of the icon module is blocked too — where it is code; quoted in a string, a template or a comment it is not. Every committed `samples/*.tsx` must pass it (a test enforces this). |

## Notes

- Equinor fork: upstream also registers `run-skill-pretool-telemetry.js` (PreToolUse) and
  `run-user-prompt-telemetry.js` (UserPromptSubmit). Both are excluded with the telemetry stack.
- Run the host from the target project folder, or pass that folder as the cwd — the write-safety
  session markers are resolved relative to it.
