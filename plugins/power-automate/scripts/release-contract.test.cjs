"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

test("debug workflows allow bounded action content and describe the public repetition contract", () => {
  for (const name of ["debug-flow", "diagnose-flow"]) {
    const skill = fs.readFileSync(path.join(root, "skills", name, "SKILL.md"), "utf8");
    const allowed = skill.match(/^allowed-tools:\s*(.+)$/m)?.[1].split(/,\s*/);
    assert.ok(allowed?.includes("mcp__flowagent__get_run_action_content"));
    assert.ok(skill.includes('which: "inputs"'));
    assert.ok(skill.includes("{ action, count, truncated, repetitions }"));
  }
});

// Equinor fork: upstream's telemetry guide and detached-dispatcher contract tests are dropped
// because that stack is excluded.
