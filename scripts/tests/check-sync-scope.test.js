// Guards the guard. check-sync-scope.js decides how deeply each file in a pull request
// gets reviewed, so the cases that matter are the ones where a misclassification would
// either hide a fork decision inside the mirror bucket or drag unadopted upstream code
// back into full review. Classification is pure; the git plumbing is not covered here.

const test = require("node:test");
const assert = require("node:assert");

const {
  globToRegExp,
  matchesAny,
  classify,
  pluginForFile,
  surfaceFor,
  transformFor,
} = require("../check-sync-scope.js");

const policy = {
  adoptedStatuses: ["controlled-pilot"],
  sharedSurfaces: [{ paths: ["shared/**", "scripts/**", "AGENTS.md"] }],
  equinorOwnedSurfaces: [{ paths: ["docs/equinor-alignment/**"] }],
  transforms: [
    { id: "fork-repointing", paths: ["plugins/*/README.md"] },
    {
      id: "telemetry-exclusion",
      paths: ["plugins/*/scripts/lib/telemetry/**"],
    },
  ],
};

const plugins = new Map([
  [
    "code-apps",
    {
      name: "code-apps-preview",
      dir: "code-apps",
      publicationStatus: "controlled-pilot",
      tier: "adopted",
    },
  ],
  [
    "power-pages",
    {
      name: "power-pages",
      dir: "power-pages",
      publicationStatus: "defer",
      tier: "tracked",
    },
  ],
]);

test("glob patterns respect segment boundaries", () => {
  assert.equal(
    globToRegExp("plugins/*/README.md").test("plugins/a/README.md"),
    true,
  );
  assert.equal(
    globToRegExp("plugins/*/README.md").test("plugins/a/b/README.md"),
    false,
  );
  assert.equal(globToRegExp("shared/**").test("shared/a/b/c.js"), true);
  // `**/` has to match zero segments, otherwise a/**/b never matches a/b.
  assert.equal(globToRegExp("a/**/b.md").test("a/b.md"), true);
  // Dots are literal, so a glob must not match an arbitrary character in their place.
  assert.equal(globToRegExp("AGENTS.md").test("AGENTSxmd"), false);
  assert.equal(
    matchesAny("scripts/install.js", ["shared/**", "scripts/**"]),
    true,
  );
});

test("eval trees belong to the plugin they are named after", () => {
  assert.equal(
    pluginForFile("evals/power-pages/create-site/x.md", plugins).name,
    "power-pages",
  );
  assert.equal(
    pluginForFile("plugins/code-apps/README.md", plugins).name,
    "code-apps-preview",
  );
  assert.equal(pluginForFile("scripts/install.js", plugins), null);
});

test("an unmapped plugin directory is tracked, never adopted", () => {
  // Fail closed: a directory with no marketplace entry and no review record must not
  // inherit full-review treatment, and must not be silently ignored either.
  const unknown = pluginForFile("plugins/brand-new/SKILL.md", plugins);
  assert.equal(unknown.tier, "tracked");
  assert.equal(unknown.publicationStatus, null);
});

test("tracked plugin files identical to upstream need no review", () => {
  const entry = classify("plugins/power-pages/skills/create-site/SKILL.md", {
    policy,
    plugins,
    upstreamIdentical: true,
  });
  assert.equal(entry.bucket, "mirror");
});

test("tracked plugin divergence is a transform only when declared", () => {
  const declared = classify("plugins/power-pages/README.md", {
    policy,
    plugins,
    upstreamIdentical: false,
  });
  assert.equal(declared.bucket, "transform");
  assert.equal(declared.transform, "fork-repointing");

  const undeclared = classify(
    "plugins/power-pages/skills/create-site/SKILL.md",
    {
      policy,
      plugins,
      upstreamIdentical: false,
    },
  );
  assert.equal(undeclared.bucket, "unmirrored");
});

test("adopted plugin files stay at full depth even when identical to upstream", () => {
  // The fork maintains this plugin, so an unchanged upstream file is still a file
  // Equinor is answerable for.
  const entry = classify("plugins/code-apps/skills/create-code-app/SKILL.md", {
    policy,
    plugins,
    upstreamIdentical: true,
  });
  assert.equal(entry.bucket, "adopted");
});

test("shared and governance surfaces are never mirrored away", () => {
  assert.equal(surfaceFor("shared/skills/report-issue/x.md", policy), "shared");
  assert.equal(
    surfaceFor("docs/equinor-alignment/baseline.md", policy),
    "equinor-owned",
  );

  // A CI workflow runs against every plugin, so it keeps full depth regardless of
  // being byte-identical to upstream.
  const workflow = classify("scripts/validate-plugin-reviews.js", {
    policy,
    plugins,
    upstreamIdentical: true,
  });
  assert.equal(workflow.bucket, "shared");

  const other = classify("SECURITY.md", {
    policy,
    plugins,
    upstreamIdentical: false,
  });
  assert.equal(other.bucket, "repo-policy");
});

test("transform lookup is independent of plugin tier", () => {
  assert.equal(
    transformFor(
      "plugins/model-apps/scripts/lib/telemetry/lib/events.js",
      policy,
    ).id,
    "telemetry-exclusion",
  );
  assert.equal(
    transformFor("plugins/model-apps/scripts/lib/app-spec.js", policy),
    null,
  );
});
