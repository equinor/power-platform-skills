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
 *   curl -fsSL https://raw.githubusercontent.com/hjaf/power-platform-skills/main/scripts/install.js | node
 *
 * TODO: Update URL to equinor/power-platform-skills when the repo is transferred.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

// ── Config ────────────────────────────────────────────────────
// TODO: Update to "equinor/power-platform-skills" when the repo is transferred to the Equinor org.
const REPO = "hjaf/power-platform-skills";
const MARKETPLACE_NAME = "power-platform-skills";
const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const HOME = os.homedir();

// ── CLI arguments ─────────────────────────────────────────────
// --scope user    Install for the current user via Claude Code CLI (~/.claude/plugins/)
// --scope project Install into the current project's .github/ directory
//                 (GitHub Copilot convention: agents/, instructions/)
const args = process.argv.slice(2);
const scopeIdx = args.indexOf("--scope");
const SCOPE = scopeIdx !== -1 && args[scopeIdx + 1] ? args[scopeIdx + 1] : "user";

if (!["user", "project"].includes(SCOPE)) {
  console.error(`Invalid scope: "${SCOPE}". Use --scope user or --scope project.`);
  process.exit(1);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/install.js [--scope user|project]

Options:
  --scope user      Install plugins for the current user via Claude Code CLI (default)
                    Location: ~/.claude/plugins/
  --scope project   Install agents and instructions into the current project
                    Location: .github/agents/, .github/instructions/
                    Convention: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot
  --help, -h        Show this help message

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
async function installProjectScoped(repoRoot, plugins) {
  header("GitHub Copilot (project-scoped)");

  info("Installing into .github/ (GitHub Copilot convention)");
  info("Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot");

  const targetGithub = path.join(process.cwd(), ".github");
  const targetAgents = path.join(targetGithub, "agents");
  const targetInstructions = path.join(targetGithub, "instructions");

  // Ensure directories exist
  fs.mkdirSync(targetAgents, { recursive: true });
  fs.mkdirSync(targetInstructions, { recursive: true });

  let agentCount = 0;
  let instructionCount = 0;

  if (repoRoot) {
    // ── Local mode: copy from disk ──
    const pluginsDir = path.join(repoRoot, "plugins");

    if (fs.existsSync(pluginsDir)) {
      const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());

      for (const pluginDir of pluginDirs) {
        const pluginPath = path.join(pluginsDir, pluginDir.name);
        const agentsPath = path.join(pluginPath, "agents");

        // Copy agent .md files as .agent.md
        if (fs.existsSync(agentsPath)) {
          const agentFiles = fs.readdirSync(agentsPath).filter((f) => f.endsWith(".md"));
          for (const file of agentFiles) {
            const targetName = file.endsWith(".agent.md") ? file : file.replace(/\.md$/, ".agent.md");
            const dest = path.join(targetAgents, targetName);
            fs.copyFileSync(path.join(agentsPath, file), dest);
            agentCount++;
          }
        }

        // Create a plugin instruction file from AGENTS.md if present
        const agentsMd = path.join(pluginPath, "AGENTS.md");
        if (fs.existsSync(agentsMd)) {
          const instructionFile = path.join(targetInstructions, `${pluginDir.name}.instructions.md`);
          const content = fs.readFileSync(agentsMd, "utf8");
          const withFrontmatter = `---\napplyTo: "**"\n---\n\n${content}`;
          fs.writeFileSync(instructionFile, withFrontmatter);
          instructionCount++;
        }
      }
    }

    // Copy repo-level .github/agents/ if present in source
    const sourceAgents = path.join(repoRoot, ".github", "agents");
    if (fs.existsSync(sourceAgents)) {
      const files = fs.readdirSync(sourceAgents).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const dest = path.join(targetAgents, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(sourceAgents, file), dest);
          agentCount++;
        }
      }
    }
  } else {
    // ── Remote mode: fetch from GitHub ──
    info("No local clone found — fetching plugin files from GitHub...");
    const GITHUB_API = `https://api.github.com/repos/${REPO}/contents`;

    for (const pluginName of plugins) {
      // Fetch agent files
      try {
        const agentsJson = await httpsGet(`${GITHUB_API}/plugins/${pluginName}/agents`);
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
        // Plugin may not have an agents/ directory — that's fine
      }

      // Fetch AGENTS.md for instructions
      try {
        const content = await httpsGet(`${GITHUB_RAW}/plugins/${pluginName}/AGENTS.md`);
        const instructionFile = path.join(targetInstructions, `${pluginName}.instructions.md`);
        const withFrontmatter = `---\napplyTo: "**"\n---\n\n${content}`;
        fs.writeFileSync(instructionFile, withFrontmatter);
        instructionCount++;
      } catch {
        // No AGENTS.md for this plugin — skip
      }
    }

    // Fetch repo-level .github/agents/ if any
    try {
      const repoAgentsJson = await httpsGet(`${GITHUB_API}/.github/agents`);
      const repoAgentFiles = JSON.parse(repoAgentsJson).filter(
        (f) => f.type === "file" && f.name.endsWith(".md")
      );
      for (const file of repoAgentFiles) {
        const dest = path.join(targetAgents, file.name);
        if (!fs.existsSync(dest)) {
          const content = await httpsGet(file.download_url);
          fs.writeFileSync(dest, content);
          agentCount++;
        }
      }
    } catch {
      // No repo-level agents — fine
    }
  }

  ok(`${agentCount} agent file(s) installed to .github/agents/`);
  ok(`${instructionCount} instruction file(s) installed to .github/instructions/`);
  console.log("");
  info("Commit these files to share with your team.");
  info("VS Code with GitHub Copilot will pick them up automatically.");
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
  const plugins = manifest.plugins.map((p) => p.name);

  console.log(`  Marketplace : ${manifest.name}`);
  console.log("  Plugins     :");
  for (const p of plugins) console.log(`    - ${p}`);

  if (plugins.length === 0) {
    warn("No plugins found in the marketplace.");
    process.exit(0);
  }

  // ── Install ────────────────────────────────────────────────
  if (SCOPE === "project") {
    // Project-scoped: copy into .github/ (GitHub Copilot convention)
    await installProjectScoped(repoRoot, plugins);
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
    console.log("  Installed into .github/ (GitHub Copilot convention).");
    console.log("  Commit .github/agents/ and .github/instructions/ to share with your team.");
    console.log("  VS Code with GitHub Copilot will use these automatically.");
    console.log("");
    console.log("  To uninstall, delete the installed files from .github/agents/ and .github/instructions/.");
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
  } else {
    console.log("    claude session  ->  /power-pages:create-site");
  }
  console.log("");
}

main().catch((err) => {
  fail(`Installation failed: ${err.message}`);
  process.exit(1);
});
