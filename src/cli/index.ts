#!/usr/bin/env node
import { Command } from "commander";
import { startMcpServer } from "../mcp/index.js";
import { runSetup } from "./setup.js";

const program = new Command();
program
  .name("kairos")
  .description(
    "Kairos — personal productivity MCP server. Run with no arguments to start the server on stdio (this is what your MCP client invokes)."
  );

program.action(async () => {
  await startMcpServer();
});

program
  .command("setup")
  .description(
    "Auto-configure your MCP client. Writes the kairos server entry to your client's config (and installs skills for Claude Code)."
  )
  .option(
    "--client <client>",
    "target client: claude-code | claude-desktop | opencode",
    "claude-code"
  )
  .option("--scope <scope>", "config scope: user | project (ignored for claude-desktop)", "user")
  .option("--skills-only", "install skills only, don't touch the MCP config (Claude Code only)")
  .option("--dry-run", "print actions without writing")
  .action(
    async (opts: {
      client: "claude-code" | "claude-desktop" | "opencode";
      scope: "user" | "project";
      skillsOnly?: boolean;
      dryRun?: boolean;
    }) => {
      await runSetup(opts);
    }
  );

program
  .command("paths")
  .description("Print local state paths")
  .action(async () => {
    const { paths } = await import("../core/paths.js");
    console.log(JSON.stringify(paths, null, 2));
  });

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
