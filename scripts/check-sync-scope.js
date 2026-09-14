#!/usr/bin/env node

"use strict";

/**
 * Partitions a pull request diff into review buckets and enforces the mirror rule
 * for plugins Equinor has not adopted.
 *
 * WHY THIS EXISTS
 * An upstream sync moves hundreds of files, almost none of them written here. The
 * first sync pull request to carry the whole marketplace drew 51 reviews, and the
 * findings clustered on plugins at `defer` — code that is mirrored from upstream and
 * that nobody in Equinor has adopted. Those findings are unactionable here: fixing
 * them forks the file, which then conflicts on every later sync and hides the defect
 * from upstream where every consumer needs it fixed.
 *
 * Prose alone did not stop that, because a reviewer looking at a diff cannot tell a
 * mirrored file from a fork decision. This script makes the distinction mechanical:
 * it tells you which files are byte-identical to the synced upstream baseline (no
 * review), which diverge under a transform this fork has declared (verify the
 * transform), and which diverge for no declared reason (a policy violation, and the
 * only tracked-plugin files that warrant discussion).
 *
 * Adoption status comes from `publicationStatus` in
 * docs/equinor-alignment/reviews/<plugin>.json — the same gate scripts/install.js
 * uses to decide what it may install. A plugin whose record cannot be read is
 * treated as NOT adopted, so a lookup failure can never silently widen the surface
 * this fork claims to maintain.
 *
 * Usage:
 *   node scripts/check-sync-scope.js                        # audit + partition vs origin/main
 *   node scripts/check-sync-scope.js --base origin/main --head HEAD
 *   node scripts/check-sync-scope.js --markdown             # review-scope block for a PR body
 *   node scripts/check-sync-scope.js --json
 *   node scripts/check-sync-scope.js --report-only          # never exit non-zero
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(
  REPO_ROOT,
  "docs",
  "equinor-alignment",
  "sync-policy.json",
);
const MARKETPLACE_PATH = path.join(REPO_ROOT, "marketplace.json");
const REVIEWS_DIR = path.join(
  REPO_ROOT,
  "docs",
  "equinor-alignment",
  "reviews",
);
const SHARED_SKILLS_DIR = path.join(REPO_ROOT, "shared", "skills");

const BUCKETS = Object.freeze({
  mirror: {
    label: "Mirrored from upstream",
    depth: "None. Byte-identical to the synced upstream baseline.",
  },
  transform: {
    label: "Declared fork transform",
    depth: "Verify the transform was applied correctly. Nothing else.",
  },
  unmirrored: {
    label: "Undeclared divergence in a tracked plugin",
    depth: "Policy violation. Revert to upstream or declare a transform.",
  },
  adopted: {
    label: "Adopted plugin",
    depth: "Full. Correctness, security, and Equinor alignment.",
  },
  shared: {
    label: "Shared surface",
    depth: "Full, plus side-effect check on every consuming plugin.",
  },
  "equinor-owned": {
    label: "Equinor-authored governance",
    depth: "Full.",
  },
  "repo-policy": {
    label: "Repository policy and metadata",
    depth: "Full.",
  },
});

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Minimal glob matcher for the path patterns in sync-policy.json. `**` spans path
 * separators, `*` does not. Deliberately not a dependency: this repository has no
 * root npm install, so CI cannot assume a matcher is present.
 */
function globToRegExp(glob) {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // `**/` must also match zero segments so `a/**/b` matches `a/b`.
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`${out}$`);
}

function matchesAny(file, globs) {
  return globs.some((glob) => globToRegExp(glob).test(file));
}

/**
 * Maps every plugin to its directory and adoption tier.
 *
 * marketplace.json is the only place that maps a review-record name to a directory
 * (`code-apps-preview` lives in `plugins/code-apps`, `mobile-app` in
 * `plugins/mobile-apps`), so it is the entry point rather than a directory listing.
 */
function loadPlugins(policy) {
  const adopted = new Set(policy.adoptedStatuses);
  const marketplace = readJson(MARKETPLACE_PATH);
  const plugins = new Map();

  for (const entry of marketplace.plugins || []) {
    const dir = String(entry.source || "")
      .replace(/^\.\//, "")
      .replace(/^plugins\//, "");
    if (!dir) continue;

    let publicationStatus = null;
    try {
      publicationStatus =
        readJson(path.join(REVIEWS_DIR, `${entry.name}.json`))
          .publicationStatus || null;
    } catch {
      publicationStatus = null;
    }

    plugins.set(dir, {
      name: entry.name,
      dir,
      publicationStatus,
      tier: adopted.has(publicationStatus) ? "adopted" : "tracked",
    });
  }

  return plugins;
}

// A plugin owns its plugin directory and its eval directory; the eval trees are named
// after the plugin directory, not the marketplace name.
function pluginForFile(file, plugins) {
  const match = /^(?:plugins|evals)\/([^/]+)\//.exec(file);
  if (!match) return null;
  // An unmapped directory is treated as tracked rather than ignored: an unreviewed
  // tree must never inherit the review depth of an adopted one.
  return (
    plugins.get(match[1]) || {
      name: match[1],
      dir: match[1],
      publicationStatus: null,
      tier: "tracked",
    }
  );
}

function surfaceFor(file, policy) {
  for (const surface of policy.equinorOwnedSurfaces) {
    if (matchesAny(file, surface.paths)) return "equinor-owned";
  }
  for (const surface of policy.sharedSurfaces) {
    if (matchesAny(file, surface.paths)) return "shared";
  }
  return null;
}

function transformFor(file, policy) {
  return (
    policy.transforms.find((transform) => matchesAny(file, transform.paths)) ||
    null
  );
}

/**
 * path -> blob sha for a whole ref. Built once per ref rather than shelling out per
 * file: a sync diff is hundreds of files, and two `git rev-parse` calls each is both
 * slow and noisy (a path absent from one side writes a fatal to stderr).
 *
 * `git ls-tree -r` emits `<mode> <type> <sha>\t<path>`.
 */
function loadBlobMap(ref) {
  const map = new Map();
  for (const line of git(["ls-tree", "-r", ref]).split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    map.set(line.slice(tab + 1), line.slice(0, tab).split(/\s+/)[2]);
  }
  return map;
}

/**
 * Classifies one path. `upstreamIdentical` says whether the file is byte-identical to
 * the synced upstream baseline; it decides the bucket for a tracked plugin and is
 * carried as review context for everything else.
 */
function classify(file, { policy, plugins, upstreamIdentical }) {
  const plugin = pluginForFile(file, plugins);

  if (plugin && plugin.tier === "adopted") {
    return { file, bucket: "adopted", plugin: plugin.name, upstreamIdentical };
  }

  if (plugin) {
    if (upstreamIdentical)
      return { file, bucket: "mirror", plugin: plugin.name, upstreamIdentical };
    const transform = transformFor(file, policy);
    if (transform) {
      return {
        file,
        bucket: "transform",
        plugin: plugin.name,
        transform: transform.id,
        upstreamIdentical,
      };
    }
    return {
      file,
      bucket: "unmirrored",
      plugin: plugin.name,
      upstreamIdentical,
    };
  }

  const surface = surfaceFor(file, policy);
  return { file, bucket: surface || "repo-policy", upstreamIdentical };
}

/**
 * Every tracked plugin tree that differs from the synced upstream baseline, whether or
 * not this pull request touched it. Run unconditionally: a sync that reverts a declared
 * transform makes the file MORE upstream-identical, so a diff-scoped check alone would
 * wave it through, and standing divergence is what conflicts on the next sync.
 */
function auditTrackedTrees(upstreamBase, head, plugins, policy) {
  const paths = [];
  for (const plugin of plugins.values()) {
    if (plugin.tier !== "tracked") continue;
    paths.push(`plugins/${plugin.dir}`, `evals/${plugin.dir}`);
  }
  if (paths.length === 0) return [];

  const output = git([
    "diff",
    "--name-only",
    upstreamBase,
    head,
    "--",
    ...paths,
  ]);
  if (!output) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .map((file) => {
      const transform = transformFor(file, policy);
      return {
        file,
        plugin: pluginForFile(file, plugins).name,
        transform: transform ? transform.id : null,
      };
    });
}

/**
 * Shared skills are written once under shared/skills/ and physically copied into each
 * adopting plugin, because a marketplace install copies only the plugin directory.
 * A shared edit is therefore half-applied until every copy is refreshed, and the copies
 * that go stale first are the ones in plugins nobody looks at. This is the side effect a
 * tracked plugin legitimately participates in, so it is checked across all tiers.
 */
function checkSharedSkillFanout() {
  const drift = [];
  const unwired = [];
  if (!fs.existsSync(SHARED_SKILLS_DIR)) return { drift, unwired };

  const pluginDirs = fs
    .readdirSync(path.join(REPO_ROOT, "plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const skill of fs.readdirSync(SHARED_SKILLS_DIR, {
    withFileTypes: true,
  })) {
    if (!skill.isDirectory()) continue;

    const workflows = fs
      .readdirSync(path.join(SHARED_SKILLS_DIR, skill.name))
      .filter((name) => name.endsWith(".md") && name !== "SKILL.template.md");

    for (const pluginDir of pluginDirs) {
      const copyDir = path.join(
        REPO_ROOT,
        "plugins",
        pluginDir,
        "skills",
        skill.name,
      );
      if (!fs.existsSync(copyDir)) continue;

      for (const workflow of workflows) {
        const sharedFile = path.join(SHARED_SKILLS_DIR, skill.name, workflow);
        const copyFile = path.join(copyDir, workflow);
        const relative = path.relative(REPO_ROOT, copyFile);

        if (!fs.existsSync(copyFile)) {
          // Upstream ships some plugins a self-contained variant of a shared skill.
          // That is a gap in the fan-out, not drift, so it is reported without failing.
          unwired.push({
            skill: skill.name,
            plugin: pluginDir,
            expected: relative,
          });
          continue;
        }
        if (!fs.readFileSync(sharedFile).equals(fs.readFileSync(copyFile))) {
          drift.push({ skill: skill.name, plugin: pluginDir, file: relative });
        }
      }
    }
  }

  return { drift, unwired };
}

function parseArgs(argv) {
  const options = {
    base: null,
    head: "HEAD",
    upstream: null,
    format: "text",
    reportOnly: argv.includes("--report-only"),
  };
  if (argv.includes("--markdown")) options.format = "markdown";
  if (argv.includes("--json")) options.format = "json";

  for (const name of ["base", "head", "upstream"]) {
    const index = argv.indexOf(`--${name}`);
    if (index !== -1 && argv[index + 1]) options[name] = argv[index + 1];
  }
  return options;
}

function resolveRefs(options) {
  const head = git(["rev-parse", options.head]);

  // The baseline for "is this file still upstream's" is the last upstream commit this
  // fork merged, not upstream's current tip. Comparing against the tip would flag every
  // file upstream has moved on since the last sync as fork divergence.
  const upstreamBase =
    options.upstream ||
    gitOrNull(["merge-base", head, "upstream/main"]) ||
    gitOrNull(["merge-base", head, "refs/remotes/upstream/main"]);

  if (!upstreamBase) {
    throw new Error(
      "Cannot resolve the upstream baseline. Add the remote and fetch it:\n" +
        "  git remote add upstream https://github.com/microsoft/power-platform-skills.git\n" +
        "  git fetch upstream main",
    );
  }

  const base =
    options.base ||
    gitOrNull(["rev-parse", "origin/main"]) ||
    gitOrNull(["rev-parse", "main"]) ||
    upstreamBase;

  return {
    base: git(["rev-parse", base]),
    head,
    upstreamBase: git(["rev-parse", upstreamBase]),
  };
}

function collect(options) {
  const policy = readJson(POLICY_PATH);
  const plugins = loadPlugins(policy);
  const refs = resolveRefs(options);

  const changed = git(["diff", "--name-only", refs.base, refs.head])
    .split("\n")
    .filter(Boolean);

  const headBlobs = loadBlobMap(refs.head);
  const upstreamBlobs = loadBlobMap(refs.upstreamBase);

  const classified = changed.map((file) => {
    const headBlob = headBlobs.get(file);
    const upstreamIdentical =
      Boolean(headBlob) && headBlob === upstreamBlobs.get(file);
    return classify(file, { policy, plugins, upstreamIdentical });
  });

  const violations = auditTrackedTrees(
    refs.upstreamBase,
    refs.head,
    plugins,
    policy,
  ).filter((entry) => entry.transform === null);
  const fanout = checkSharedSkillFanout();

  return { policy, plugins, refs, classified, violations, fanout };
}

function bucketCounts(classified) {
  const counts = new Map();
  for (const entry of classified) {
    const current = counts.get(entry.bucket) || { total: 0, upstreamIdentical: 0 };
    current.total += 1;
    if (entry.upstreamIdentical) current.upstreamIdentical += 1;
    counts.set(entry.bucket, current);
  }
  return counts;
}

function reviewSurface(classified) {
  return classified.filter((entry) => entry.bucket !== "mirror");
}

function renderText(result) {
  const { refs, classified, violations, fanout, plugins } = result;
  const counts = bucketCounts(classified);
  const lines = [];

  lines.push("Sync scope");
  lines.push(`  base            ${refs.base.slice(0, 12)}`);
  lines.push(`  head            ${refs.head.slice(0, 12)}`);
  lines.push(`  upstream base   ${refs.upstreamBase.slice(0, 12)}`);
  lines.push("");

  const adopted = [...plugins.values()].filter((p) => p.tier === "adopted");
  lines.push(
    `Adopted plugins (full review): ${adopted.map((p) => p.name).join(", ") || "none"}`,
  );
  lines.push(
    `Tracked plugins (mirrored): ${
      [...plugins.values()]
        .filter((p) => p.tier === "tracked")
        .map((p) => p.name)
        .join(", ") || "none"
    }`,
  );
  lines.push("");

  lines.push(`Changed files: ${classified.length}`);
  for (const [bucket, meta] of Object.entries(BUCKETS)) {
    const count = counts.get(bucket);
    if (!count) continue;
    // A full-depth file can still be upstream's work. Saying so up front keeps the
    // question at "is it safe to run this here" instead of "is this well written".
    const identical =
      bucket === 'mirror' || count.upstreamIdentical === 0
        ? ''
        : `  (${count.upstreamIdentical} identical to upstream)`;
    lines.push(`  ${String(count.total).padStart(5)}  ${meta.label}${identical}`);
  }
  lines.push(
    `Review surface: ${reviewSurface(classified).length} of ${classified.length} files.`,
  );

  if (violations.length > 0) {
    lines.push("");
    lines.push(
      `VIOLATION: ${violations.length} file(s) in tracked plugin trees diverge from upstream`,
    );
    lines.push(
      "with no declared transform. Revert them to upstream, or add a transform to",
    );
    lines.push(
      "docs/equinor-alignment/sync-policy.json and justify it in the pull request.",
    );
    for (const entry of violations)
      lines.push(`  ${entry.plugin.padEnd(28)} ${entry.file}`);
  }

  if (fanout.drift.length > 0) {
    lines.push("");
    lines.push(
      `VIOLATION: ${fanout.drift.length} per-plugin copy of a shared skill is stale.`,
    );
    for (const entry of fanout.drift)
      lines.push(`  ${entry.skill.padEnd(28)} ${entry.file}`);
  }

  if (fanout.unwired.length > 0) {
    lines.push("");
    lines.push(
      "Note: plugins carrying a self-contained variant of a shared skill. A shared edit",
    );
    lines.push(
      "does not reach them, so check them by hand when the shared workflow changes.",
    );
    for (const entry of fanout.unwired)
      lines.push(`  ${entry.skill.padEnd(28)} ${entry.plugin}`);
  }

  return lines.join("\n");
}

function renderMarkdown(result) {
  const { refs, classified, violations, fanout } = result;
  const counts = bucketCounts(classified);
  const surface = reviewSurface(classified);
  const lines = [];

  lines.push("## Review scope");
  lines.push("");
  lines.push(
    `Upstream baseline \`${refs.upstreamBase.slice(0, 12)}\`. Generated by \`node scripts/check-sync-scope.js --markdown\`.`,
  );
  lines.push("");
  lines.push('| Files | Bucket | Unchanged from upstream | Review depth |');
  lines.push('| --- | --- | --- | --- |');
  for (const [bucket, meta] of Object.entries(BUCKETS)) {
    const count = counts.get(bucket);
    if (!count) continue;
    lines.push(`| ${count.total} | ${meta.label} | ${count.upstreamIdentical} | ${meta.depth} |`);
  }
  lines.push("");
  lines.push(
    `**Review surface: ${surface.length} of ${classified.length} files.**`,
  );

  if (surface.length > 0) {
    lines.push("");
    lines.push("<details><summary>Files in the review surface</summary>");
    lines.push("");
    for (const entry of surface) {
      const notes = [BUCKETS[entry.bucket].label];
      if (entry.transform) notes.push(entry.transform);
      if (entry.upstreamIdentical) notes.push("unchanged from upstream");
      lines.push(`- \`${entry.file}\` — ${notes.join(", ")}`);
    }
    lines.push("");
    lines.push("</details>");
  }

  if (violations.length > 0 || fanout.drift.length > 0) {
    lines.push("");
    lines.push("> [!WARNING]");
    lines.push("> Sync scope check failed. See the job log.");
  }

  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = collect(options);

  if (options.format === "json") {
    process.stdout.write(
      `${JSON.stringify(
        {
          refs: result.refs,
          plugins: [...result.plugins.values()],
          files: result.classified,
          violations: result.violations,
          sharedSkillDrift: result.fanout.drift,
          sharedSkillUnwired: result.fanout.unwired,
        },
        null,
        2,
      )}\n`,
    );
  } else if (options.format === "markdown") {
    process.stdout.write(`${renderMarkdown(result)}\n`);
  } else {
    process.stdout.write(`${renderText(result)}\n`);
  }

  const failed = result.violations.length > 0 || result.fanout.drift.length > 0;
  if (failed && !options.reportOnly) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = {
  globToRegExp,
  matchesAny,
  classify,
  pluginForFile,
  surfaceFor,
  transformFor,
};
