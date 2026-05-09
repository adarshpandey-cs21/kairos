#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "../core/logger.js";
import { registerHandlers } from "./tools.js";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "kairos", version: "0.1.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );
  registerHandlers(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("kairos MCP server connected on stdio");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  startMcpServer().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("MCP server failed to start", { error: message });
    process.exit(1);
  });
}
