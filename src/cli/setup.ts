import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Client = "claude-code" | "claude-desktop" | "opencode";

interface Opts {
  client?: Client;
  scope?: "user" | "project";
  skillsOnly?: boolean;
  dryRun?: boolean;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_SRC = join(REPO_ROOT, "skills");

const pkg: { name: string } = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
const PACKAGE_NAME = pkg.name;

function claudeDesktopConfigPath(): string {
  const home = homedir();
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function opencodeUserConfigPath(): string {
  if (process.platform === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "opencode",
      "opencode.json"
    );
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdg, "opencode", "opencode.json");
}

function configPathFor(client: Client, scope: "user" | "project"): string {
  if (client === "claude-desktop") return claudeDesktopConfigPath();
  if (client === "opencode") {
    return scope === "project" ? join(process.cwd(), "opencode.json") : opencodeUserConfigPath();
  }
  // claude-code
  return scope === "user" ? join(homedir(), ".claude.json") : join(process.cwd(), ".claude.json");
}

function clientLabel(client: Client): string {
  switch (client) {
    case "claude-desktop":
      return "Claude Desktop";
    case "opencode":
      return "OpenCode";
    default:
      return "Claude Code";
  }
}

function buildServerEntry(client: Client): Record<string, unknown> {
  const env: Record<string, string> = {
    ...(process.env.TODOIST_TOKEN ? { TODOIST_TOKEN: process.env.TODOIST_TOKEN } : {}),
    ...(process.env.KAIROS_HOME ? { KAIROS_HOME: process.env.KAIROS_HOME } : {}),
  };
  if (client === "opencode") {
    return {
      type: "local",
      command: ["npx", "-y", PACKAGE_NAME],
      environment: env,
    };
  }
  return {
    command: "npx",
    args: ["-y", PACKAGE_NAME],
    env,
  };
}

function serversKeyFor(client: Client): string {
  return client === "opencode" ? "mcp" : "mcpServers";
}

export async function runSetup(opts: Opts): Promise<void> {
  const client: Client = opts.client ?? "claude-code";
  const scope = opts.scope ?? "user";
  const supportsSkills = client === "claude-code";

  // claude-desktop ignores scope (only user-level config exists)
  const effectiveScope = client === "claude-desktop" ? "user" : scope;
  const claudeConfigPath = configPathFor(client, effectiveScope);
  const skillsDestRoot =
    scope === "user"
      ? join(homedir(), ".claude", "skills")
      : join(process.cwd(), ".claude", "skills");

  const scopeLabel = client === "claude-desktop" ? "" : ` (scope=${effectiveScope})`;
  console.error(
    `kairos setup → ${clientLabel(client)}${scopeLabel}${opts.dryRun ? " [DRY RUN]" : ""}\n`
  );
  if (!opts.skillsOnly) {
    console.error(`  MCP config:    ${claudeConfigPath}`);
    console.error(`  MCP command:   npx -y ${PACKAGE_NAME}`);
  }
  if (supportsSkills) {
    console.error(`  Skills dir:    ${skillsDestRoot}`);
  } else {
    console.error(`  Skills:        not installed (${clientLabel(client)} has no skills surface)`);
  }
  console.error("");

  if (!process.env.TODOIST_TOKEN) {
    console.error("[!] TODOIST_TOKEN env var is not set in the current shell.");
    console.error("    Get a token at https://app.todoist.com/app/settings/integrations/developer");
    console.error(
      "    Either export it before running setup, or add it manually to the\n" +
        "    'env' / 'environment' block in the MCP config below after this writes it.\n"
    );
  }

  if (opts.dryRun) {
    console.error("Dry run — no files written.");
    return;
  }

  // 1. Register MCP server (skipped if --skills-only)
  if (!opts.skillsOnly) {
    let config: Record<string, any> = {};
    if (existsSync(claudeConfigPath)) {
      try {
        config = JSON.parse(await readFile(claudeConfigPath, "utf8"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Could not parse existing ${claudeConfigPath}: ${message}`);
        process.exit(1);
      }
    } else {
      // Parent dir may not exist yet (first-time install).
      await mkdir(dirname(claudeConfigPath), { recursive: true });
    }

    if (client === "opencode" && !config.$schema) {
      config.$schema = "https://opencode.ai/config.json";
    }

    const serversKey = serversKeyFor(client);
    if (!config[serversKey]) config[serversKey] = {};
    config[serversKey].kairos = buildServerEntry(client);

    await writeFile(claudeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
    console.error(`  ✓ Registered MCP server 'kairos' in ${claudeConfigPath}`);
  }

  // 2. Install skills (Claude Code only)
  if (supportsSkills && !opts.skillsOnly) {
    await installSkills(skillsDestRoot);
  } else if (opts.skillsOnly) {
    if (!supportsSkills) {
      console.error(
        `[!] --skills-only is meaningless for ${clientLabel(client)} — skills are Claude-Code-specific.`
      );
      return;
    }
    await installSkills(skillsDestRoot);
  }

  console.error(
    `\nSetup complete. Restart ${clientLabel(client)}${
      supportsSkills
        ? ", then try '/kairos-onboard'"
        : " — Kairos's prompts are now in your prompt picker"
    }.`
  );
}

async function installSkills(skillsDestRoot: string): Promise<void> {
  await mkdir(skillsDestRoot, { recursive: true });
  const skillDirs = (await readdir(SKILLS_SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (skillDirs.length === 0) {
    console.error("  [!] No skills found in skills/ — nothing to install.");
    return;
  }

  for (const name of skillDirs) {
    const destDir = join(skillsDestRoot, name);
    await mkdir(destDir, { recursive: true });
    await copyFile(join(SKILLS_SRC, name, "SKILL.md"), join(destDir, "SKILL.md"));
    console.error(`  ✓ Installed skill: ${name}`);
  }
}
