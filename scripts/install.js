#!/usr/bin/env node
/**
 * Power Platform Skills — Installation Script
 *
 * Clones the marketplace repository and uses CLI commands to register
 * the marketplace and install plugins for Claude Code and GitHub Copilot.
 *
 * Usage:
 *   node scripts/install.js                                              (from local clone, user scope)
 *   node scripts/install.js --scope project                              (install into .claude/plugins/ in cwd)
 *   curl -fsSL https://raw.githubusercontent.com/equinor/power-platform-skills/main/scripts/install.js | node
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

// ── Config ────────────────────────────────────────────────────
const REPO = "equinor/power-platform-skills";
const MARKETPLACE_NAME = "power-platform-skills";
const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const HOME = os.homedir();

// ── CLI arguments ─────────────────────────────────────────────
// --scope user    Install for the current user via Claude Code CLI (~/.claude/plugins/)
// --scope project Install into the current project's .github/ directory
//                 (GitHub Copilot convention: agents/, instructions/, skills/)
// --plugin <name> Install only the specified plugin(s). Can be repeated or comma-separated.
//                 If omitted, installs all plugins from the marketplace.
const args = process.argv.slice(2);
const scopeIdx = args.indexOf("--scope");
const SCOPE = scopeIdx !== -1 && args[scopeIdx + 1] ? args[scopeIdx + 1] : "user";

if (!["user", "project"].includes(SCOPE)) {
  console.error(`Invalid scope: "${SCOPE}". Use --scope user or --scope project.`);
  process.exit(1);
}

// Collect --plugin flags (supports multiple: --plugin code-apps --plugin power-pages)
// Also supports comma-separated: --plugin code-apps,power-pages
const SELECTED_PLUGINS = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--plugin" && args[i + 1]) {
    const val = args[i + 1];
    SELECTED_PLUGINS.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
    i++; // skip the value
  }
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/install.js [--scope user|project] [--plugin <name>]

Options:
  --scope user      Install plugins for the current user via Claude Code CLI (default)
                    Location: ~/.claude/plugins/
  --scope project   Install agents, instructions, and skills into the current project
                    Location: .github/agents/, .github/instructions/, .github/skills/
                    Convention: https://docs.github.com/en/copilot/customizing-copilot
  --plugin <name>   Install only the specified plugin(s). Can be used multiple times
                    or comma-separated: --plugin code-apps,power-pages
                    If omitted, installs ALL plugins (not recommended for --scope project).
  --help, -h        Show this help message

Examples:
  node scripts/install.js --scope project --plugin code-apps
  node scripts/install.js --scope project --plugin power-pages,model-apps
  curl -fsSL https://raw.githubusercontent.com/equinor/power-platform-skills/main/scripts/install.js | node - --scope project --plugin code-apps

Docs:
  Claude Code plugins: https://code.claude.com/docs/en/plugins
  GitHub Copilot customization: https://docs.github.com/en/copilot/customizing-copilot
`);
  process.exit(0);
}

// ── Colors (disabled when output is piped) ────────────────────
const tty = process.stdout.isTTY;
const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const green = (s) => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const yellow = (s) => (tty ? `\x1b[33m${s}\x1b[0m` : s);
const red = (s) => (tty ? `\x1b[31m${s}\x1b[0m` : s);

const ok = (msg) => console.log(`  ${green("✓")} ${msg}`);
const warn = (msg) => console.log(`  ${yellow("!")} ${msg}`);
const fail = (msg) => console.log(`  ${red("✗")} ${msg}`);
const header = (msg) => console.log(`\n${bold(msg)}`);
const info = (msg) => console.log(`  ${msg}`);

// ── Helpers ───────────────────────────────────────────────────
function hasCommand(cmd) {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    execSync(`${which} ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, opts = {}) {
  try {
    const output = execSync(cmd, {
      stdio: "pipe",
      timeout: 120_000,
      cwd: opts.cwd,
      shell: true,
    });
    return { ok: true, output: output.toString().trim() };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    return { ok: false, output: stderr };
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const request = (target) => {
      https
        .get(target, { headers: { "User-Agent": "power-platform-skills-installer" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return request(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} from ${target}`));
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        })
        .on("error", reject);
    };
    request(url);
  });
}

// ── Auto-update ──────────────────────────────────────────────
// The CLI's `marketplace add` does not set autoUpdate — patch it manually.
// `getMarketplaces` extracts the marketplaces object from the config root.
function enableAutoUpdate(configFile, getMarketplaces) {
  try {
    const data = JSON.parse(fs.readFileSync(configFile, "utf8"));
    const marketplaces = getMarketplaces(data);
    if (marketplaces?.[MARKETPLACE_NAME] && !marketplaces[MARKETPLACE_NAME].autoUpdate) {
      marketplaces[MARKETPLACE_NAME].autoUpdate = true;
      fs.writeFileSync(configFile, JSON.stringify(data, null, 2) + "\n");
      ok("Auto-update enabled");
      return;
    }
    if (marketplaces?.[MARKETPLACE_NAME]?.autoUpdate) {
      ok("Auto-update already enabled");
      return;
    }
    warn("Marketplace entry not found — auto-update not set");
  } catch {
    warn("Could not enable auto-update (config file not found)");
  }
}

// ── Marketplace loader ────────────────────────────────────────
async function loadMarketplace() {
  const scriptDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : process.cwd();
  // Script lives in scripts/, so the repo root is one level up
  const repoRoot = path.resolve(scriptDir, "..");
  const localFile = path.join(repoRoot, ".claude-plugin", "marketplace.json");

  if (fs.existsSync(localFile)) {
    return { manifest: JSON.parse(fs.readFileSync(localFile, "utf8")), repoRoot };
  }

  // Also check cwd (handles running from repo root or piped download)
  const cwdRoot = process.cwd();
  const cwdFile = path.join(cwdRoot, ".claude-plugin", "marketplace.json");
  if (fs.existsSync(cwdFile)) {
    return { manifest: JSON.parse(fs.readFileSync(cwdFile, "utf8")), repoRoot: cwdRoot };
  }

  info("Fetching marketplace manifest from GitHub...");
  const raw = await httpsGet(`${GITHUB_RAW}/.claude-plugin/marketplace.json`);
  return { manifest: JSON.parse(raw), repoRoot: null };
}

// ── Claude Code installation ──────────────────────────────────
function installClaude(plugins) {
  header("Claude Code (user-scoped)");

  info("Location: ~/.claude/plugins/");

  // 1. Register marketplace via CLI (CLI clones the repo automatically)
  info("Registering marketplace...");
  const addResult = run(`claude plugin marketplace add "${REPO}"`);
  if (addResult.ok) {
    ok("Marketplace registered");
  } else if (addResult.output.includes("already")) {
    ok("Marketplace already registered");
  } else {
    fail(`Failed to register marketplace: ${addResult.output}`);
    return;
  }

  // 2. Update marketplace
  info("Updating marketplace...");
  const updateResult = run(`claude plugin marketplace update "${MARKETPLACE_NAME}"`);
  if (updateResult.ok) {
    ok("Marketplace updated");
  } else {
    warn(`Marketplace update: ${updateResult.output}`);
  }

  // 3. Enable auto-update (CLI does not set this)
  const knownPath = path.join(HOME, ".claude", "plugins", "known_marketplaces.json");
  enableAutoUpdate(knownPath, (data) => data);

  // 4. Install each plugin via CLI
  for (const plugin of plugins) {
    info(`Installing ${plugin}...`);
    const installResult = run(
      `claude plugin install "${plugin}@${MARKETPLACE_NAME}" --scope ${SCOPE}`
    );
    if (installResult.ok) {
      ok(`${plugin} installed`);
    } else if (installResult.output.includes("already installed")) {
      ok(`${plugin} already installed`);
    } else {
      fail(`Failed to install ${plugin}: ${installResult.output}`);
    }
  }

  // 5. Verify installation
  info("Verifying installation...");
  const listResult = run("claude plugin list");
  if (listResult.ok) {
    const installed = plugins.filter((p) => listResult.output.includes(p));
    if (installed.length > 0) {
      ok(`Verified: ${installed.join(", ")}`);
    } else {
      warn("Plugins not found in plugin list output");
    }
  }
}

// ── GitHub Copilot project install (.github/ convention) ──────
async function installProjectScoped(repoRoot, plugins, pluginSourceMap) {
  header("GitHub Copilot (project-scoped)");

  info("Installing into .github/ (GitHub Copilot convention)");
  info("Structure: .github/agents/, .github/instructions/, .github/skills/");

  const targetGithub = path.join(process.cwd(), ".github");
  const targetAgents = path.join(targetGithub, "agents");
  const targetInstructions = path.join(targetGithub, "instructions");
  const targetSkills = path.join(targetGithub, "skills");

  // Ensure directories exist
  fs.mkdirSync(targetAgents, { recursive: true });
  fs.mkdirSync(targetInstructions, { recursive: true });
  fs.mkdirSync(targetSkills, { recursive: true });

  let agentCount = 0;
  let instructionCount = 0;
  let skillCount = 0;

  // Helper: recursively copy a directory
  function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  if (repoRoot) {
    // ── Local mode: copy from disk ──
    const pluginsDir = path.join(repoRoot, "plugins");

    for (const pluginName of plugins) {
      // Resolve directory name from manifest source path
      const dirName = pluginSourceMap[pluginName] || pluginName;
      const pluginPath = path.join(pluginsDir, dirName);
      if (!fs.existsSync(pluginPath)) {
        warn(`Plugin directory not found: ${dirName} (plugin: ${pluginName})`);
        continue;
      }

      // 1. Copy agent .md files as .agent.md (namespaced with plugin prefix)
      const agentsPath = path.join(pluginPath, "agents");
      if (fs.existsSync(agentsPath)) {
        const agentFiles = fs.readdirSync(agentsPath).filter((f) => f.endsWith(".md"));
        for (const file of agentFiles) {
          // Skip non-agent assets (e.g. assets/ subdirectory)
          const filePath = path.join(agentsPath, file);
          if (!fs.statSync(filePath).isFile()) continue;
          const targetName = file.endsWith(".agent.md") ? file : file.replace(/\.md$/, ".agent.md");
          fs.copyFileSync(filePath, path.join(targetAgents, targetName));
          agentCount++;
        }
      }

      // 2. Create instruction file from AGENTS.md
      const agentsMd = path.join(pluginPath, "AGENTS.md");
      if (fs.existsSync(agentsMd)) {
        const instructionFile = path.join(targetInstructions, `${pluginName}.instructions.md`);
        const content = fs.readFileSync(agentsMd, "utf8");
        const withFrontmatter = `---\napplyTo: "**"\ndescription: "${pluginName} plugin instructions"\n---\n\n${content}`;
        fs.writeFileSync(instructionFile, withFrontmatter);
        instructionCount++;
      }

      // 3. Copy skills (each skill is a subdirectory with SKILL.md + references/)
      const skillsPath = path.join(pluginPath, "skills");
      if (fs.existsSync(skillsPath)) {
        const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true })
          .filter((d) => d.isDirectory());

        for (const skillDir of skillDirs) {
          const srcSkill = path.join(skillsPath, skillDir.name);
          const skillMd = path.join(srcSkill, "SKILL.md");
          if (!fs.existsSync(skillMd)) continue; // Skip dirs without SKILL.md

          const destSkill = path.join(targetSkills, skillDir.name);
          copyDirRecursive(srcSkill, destSkill);
          skillCount++;
        }
      }
    }
  } else {
    // ── Remote mode: fetch from GitHub ──
    info("No local clone found — fetching plugin files from GitHub...");
    const GITHUB_API = `https://api.github.com/repos/${REPO}/contents`;

    // Helper: recursively fetch a directory from GitHub API
    async function fetchDirRecursive(apiPath, destDir) {
      const json = await httpsGet(`${GITHUB_API}/${apiPath}`);
      const entries = JSON.parse(json);
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of entries) {
        const destPath = path.join(destDir, entry.name);
        if (entry.type === "dir") {
          await fetchDirRecursive(entry.path, destPath);
        } else if (entry.type === "file") {
          const content = await httpsGet(entry.download_url);
          fs.writeFileSync(destPath, content);
        }
      }
    }

    for (const pluginName of plugins) {
      // Resolve directory name from manifest source path
      const dirName = pluginSourceMap[pluginName] || pluginName;

      // 1. Fetch agent files
      try {
        const agentsJson = await httpsGet(`${GITHUB_API}/plugins/${dirName}/agents`);
        const agentFiles = JSON.parse(agentsJson).filter(
          (f) => f.type === "file" && f.name.endsWith(".md")
        );
        for (const file of agentFiles) {
          const content = await httpsGet(file.download_url);
          const targetName = file.name.endsWith(".agent.md")
            ? file.name
            : file.name.replace(/\.md$/, ".agent.md");
          fs.writeFileSync(path.join(targetAgents, targetName), content);
          agentCount++;
        }
      } catch {
        // Plugin may not have an agents/ directory
      }

      // 2. Fetch AGENTS.md for instructions
      try {
        const content = await httpsGet(`${GITHUB_RAW}/plugins/${dirName}/AGENTS.md`);
        const instructionFile = path.join(targetInstructions, `${pluginName}.instructions.md`);
        const withFrontmatter = `---\napplyTo: "**"\ndescription: "${pluginName} plugin instructions"\n---\n\n${content}`;
        fs.writeFileSync(instructionFile, withFrontmatter);
        instructionCount++;
      } catch {
        // No AGENTS.md for this plugin
      }

      // 3. Fetch skills
      try {
        const skillsJson = await httpsGet(`${GITHUB_API}/plugins/${dirName}/skills`);
        const skillDirs = JSON.parse(skillsJson).filter((f) => f.type === "dir");
        for (const skillDir of skillDirs) {
          const destSkill = path.join(targetSkills, skillDir.name);
          await fetchDirRecursive(`plugins/${dirName}/skills/${skillDir.name}`, destSkill);
          skillCount++;
        }
      } catch {
        // Plugin may not have skills/
      }
    }
  }

  ok(`${agentCount} agent file(s) → .github/agents/`);
  ok(`${instructionCount} instruction file(s) → .github/instructions/`);
  ok(`${skillCount} skill(s) → .github/skills/`);
  console.log("");
  info("Commit .github/ to share with your team.");
  info("VS Code with GitHub Copilot will pick these up automatically.");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log(bold("Power Platform Skills — Installer"));
  console.log("──────────────────────────────────");

  // ── Prerequisites ──────────────────────────────────────────
  header("Checking prerequisites");
  ok(`Node.js ${process.version}`);

  // Detect tools
  const tools = [];

  if (hasCommand("claude")) {
    const ver = run("claude --version");
    tools.push("claude");
    ok(`Claude Code ${ver.ok ? ver.output : "(version unknown)"}`);
  }

  if (tools.length === 0 && SCOPE === "user") {
    fail("Claude Code CLI not found in PATH (required for user-scoped install).");
    console.log("");
    console.log("  Options:");
    console.log("    Install Claude Code: https://docs.anthropic.com/en/docs/claude-code");
    console.log("    Or use --scope project for GitHub Copilot (.github/ convention)");
    process.exit(1);
  }

  if (SCOPE === "project") {
    info("Project-scoped install: no CLI required (copies files to .github/)");
  }

  // ── PAC CLI ──────────────────────────────────────────────────
  header("Power Platform CLI (pac)");

  if (hasCommand("pac")) {
    const ver = run("pac help");
    const versionMatch = ver.ok && ver.output.match(/Version:\s*(.+)/i);
    ok(`PAC CLI ${versionMatch ? versionMatch[1].trim() : "(installed)"}`);

    // Check NuGet for a newer version and update if available
    if (hasCommand("dotnet")) {
      const localVersion = versionMatch ? versionMatch[1].trim().split("+")[0] : null;
      let latestVersion = null;
      try {
        const nugetJson = await httpsGet(
          "https://api.nuget.org/v3-flatcontainer/microsoft.powerapps.cli.tool/index.json"
        );
        const versions = JSON.parse(nugetJson).versions;
        latestVersion = versions[versions.length - 1];
      } catch {
        warn("Could not check NuGet for latest version");
      }

      if (latestVersion && localVersion && latestVersion === localVersion) {
        ok("Already on latest version");
      } else if (latestVersion) {
        info(`Newer version available: ${latestVersion} (installed: ${localVersion || "unknown"})`);
        info("Updating PAC CLI...");
        const updateResult = run(
          "dotnet tool update --global Microsoft.PowerApps.CLI.Tool"
        );
        if (updateResult.ok) {
          ok(`Updated to ${latestVersion}`);
        } else {
          warn(`Could not update: ${updateResult.output}`);
        }
      }
    }
  } else {
    warn("PAC CLI not found in PATH");

    if (hasCommand("dotnet")) {
      info("Installing PAC CLI via dotnet tool...");
      const installResult = run(
        "dotnet tool install --global Microsoft.PowerApps.CLI.Tool"
      );
      if (installResult.ok) {
        ok("PAC CLI installed");
        info("You may need to restart your terminal for the 'pac' command to be available.");
      } else if (installResult.output.includes("already installed")) {
        ok("PAC CLI already installed (not on PATH — restart your terminal)");
      } else {
        fail(`Failed to install PAC CLI: ${installResult.output}`);
        info("Install manually: https://aka.ms/PowerPlatformCLI");
      }
    } else {
      fail("dotnet SDK not found — cannot auto-install PAC CLI");
      console.log("");
      console.log("  Install the PAC CLI manually using one of these methods:");
      console.log("    .NET Tool (cross-platform)  https://aka.ms/PowerPlatformCLI");
      console.log("    VS Code Extension           https://aka.ms/PowerPlatformCLI");
      console.log("    Windows MSI                 https://aka.ms/PowerPlatformCLI");
    }
  }

  // ── Azure CLI ───────────────────────────────────────────────
  header("Azure CLI (az)");

  if (hasCommand("az")) {
    const ver = run("az version -o tsv");
    const versionLine = ver.ok && ver.output.split("\n")[0];
    const azVersion = versionLine ? versionLine.split("\t")[0] : null;
    ok(`Azure CLI ${azVersion || "(installed)"}`);
  } else {
    warn("Azure CLI not found in PATH");

    let installed = false;
    if (process.platform === "win32" && hasCommand("winget")) {
      info("Installing Azure CLI via winget...");
      const installResult = run(
        "winget install -e --id Microsoft.AzureCLI --accept-source-agreements --accept-package-agreements"
      );
      if (installResult.ok) {
        ok("Azure CLI installed");
        info("You may need to restart your terminal for the 'az' command to be available.");
        installed = true;
      } else {
        fail(`Failed to install via winget: ${installResult.output}`);
      }
    } else if (process.platform === "darwin" && hasCommand("brew")) {
      info("Installing Azure CLI via Homebrew...");
      const installResult = run("brew install azure-cli");
      if (installResult.ok) {
        ok("Azure CLI installed");
        installed = true;
      } else {
        fail(`Failed to install via Homebrew: ${installResult.output}`);
      }
    }

    if (!installed) {
      fail("Could not auto-install Azure CLI");
      console.log("");
      console.log("  Install manually using one of these methods:");
      console.log("    Windows (winget)  winget install -e --id Microsoft.AzureCLI");
      console.log("    macOS (Homebrew)  brew install azure-cli");
      console.log("    Linux (curl)      curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash");
      console.log("    Docs              https://aka.ms/InstallAzureCLI");
    }
  }

  // ── Marketplace ────────────────────────────────────────────
  header("Reading marketplace");

  const { manifest, repoRoot } = await loadMarketplace();
  const allPlugins = manifest.plugins.map((p) => p.name);

  // Build a lookup: plugin name → source directory name (from manifest source path)
  const pluginSourceMap = {};
  for (const p of manifest.plugins) {
    // source is like "./plugins/code-apps" — extract the last segment
    const dirName = path.basename(p.source);
    pluginSourceMap[p.name] = dirName;
  }

  // Filter by --plugin flag if specified
  let plugins;
  if (SELECTED_PLUGINS.length > 0) {
    const unknown = SELECTED_PLUGINS.filter((p) => !allPlugins.includes(p));
    if (unknown.length > 0) {
      fail(`Unknown plugin(s): ${unknown.join(", ")}`);
      info(`Available: ${allPlugins.join(", ")}`);
      process.exit(1);
    }
    plugins = SELECTED_PLUGINS;
  } else {
    plugins = allPlugins;
    if (SCOPE === "project" && plugins.length > 1) {
      warn("No --plugin specified — installing ALL plugins.");
      info("Tip: use --plugin <name> to install only what you need.");
      info(`Available: ${allPlugins.join(", ")}`);
    }
  }

  console.log(`  Marketplace : ${manifest.name}`);
  console.log(`  Installing  : ${plugins.join(", ")}`);

  if (plugins.length === 0) {
    warn("No plugins to install.");
    process.exit(0);
  }

  // ── Install ────────────────────────────────────────────────
  if (SCOPE === "project") {
    // Project-scoped: copy into .github/ (GitHub Copilot convention)
    await installProjectScoped(repoRoot, plugins, pluginSourceMap);
  } else {
    // User-scoped: use Claude Code CLI
    if (tools.includes("claude")) {
      installClaude(plugins);
    } else {
      fail("Claude Code CLI not found. User-scoped install requires 'claude' in PATH.");
      info("For project-scoped install (GitHub Copilot), use: --scope project");
      process.exit(1);
    }
  }

  // ── Summary ────────────────────────────────────────────────
  header("Done!");
  console.log("");
  if (SCOPE === "project") {
    console.log(`  Installed plugin(s): ${plugins.join(", ")}`);
    console.log("  Location: .github/ (GitHub Copilot convention)");
    console.log("");
    console.log("  Structure:");
    console.log("    .github/agents/          Agent personas (.agent.md)");
    console.log("    .github/instructions/    Plugin instructions (.instructions.md)");
    console.log("    .github/skills/          Skills with workflows (SKILL.md)");
    console.log("");
    console.log("  Commit .github/ to share with your team.");
    console.log("  VS Code with GitHub Copilot will use these automatically.");
    console.log("");
    console.log("  To uninstall, delete the installed files from .github/.");
  } else {
    console.log("  Installed at user scope via Claude Code (available in all projects).");
    console.log("  Plugins will stay current via the marketplace auto-update mechanism.");
    console.log("");
    console.log("  To uninstall:");
    for (const p of plugins) {
      console.log(`    claude plugin uninstall ${p}`);
    }
  }
  console.log("");
  console.log("  Get started:");
  if (SCOPE === "project") {
    console.log("    Open VS Code with GitHub Copilot in this project.");
    console.log("    Skills are available as slash commands (e.g. /create-code-app).");
  } else {
    console.log("    claude session  ->  /power-pages:create-site");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    fail(`Installation failed: ${err.message}`);
    process.exit(1);
  });
