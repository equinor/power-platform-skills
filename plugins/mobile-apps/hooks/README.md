# mobile-apps hooks

> **Equinor fork:** this plugin ships no `hooks/hooks.json`, so nothing under `hooks/` runs
> automatically. Upstream registers fail-open telemetry-only start hooks here (`run-telemetry.js`,
> wired to `PreToolUse(Skill)` and `UserPromptSubmit`); they are excluded pending a separate
> governance and privacy review, and are not vendored into this tree. The files present here are
> validators that mutating skills and final-artifact agents invoke explicitly — see `AGENTS.md`
> "Plugin isolation".
