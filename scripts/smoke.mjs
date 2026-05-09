#!/usr/bin/env node
// Smoke-test the kairos MCP server end-to-end without Claude Code.
// Spawns dist/mcp/index.js, sends a handful of JSON-RPC messages, prints results.
// If TODOIST_TOKEN is set, also verifies Todoist auth.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MCP = resolve(ROOT, "dist/mcp/index.js");

if (!existsSync(MCP)) {
  console.error(`[!] ${MCP} not built. Run 'npm run build' first.`);
  process.exit(1);
}

const child = spawn("node", [MCP], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

const messages = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.1" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  { jsonrpc: "2.0", id: 3, method: "prompts/list" },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "profile.get", arguments: {} },
  },
];

if (process.env.TODOIST_TOKEN) {
  messages.push({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "todoist.list_active", arguments: {} },
  });
}

for (const m of messages) child.stdin.write(`${JSON.stringify(m)}\n`);
child.stdin.end();

console.log("");
let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx = buf.indexOf("\n");
  while (idx >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    idx = buf.indexOf("\n");
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      console.error(`! could not parse: ${line.slice(0, 200)}`);
      continue;
    }
    if (obj.error) {
      console.log(`✗ id=${obj.id}: ${obj.error.message}`);
      continue;
    }
    if (obj.id === 1) {
      const s = obj.result.serverInfo;
      console.log(`✓ initialize        → ${s.name} v${s.version}`);
    } else if (obj.id === 2) {
      console.log(`✓ tools/list        → ${obj.result.tools.length} tools`);
      for (const t of obj.result.tools) console.log(`     · ${t.name}`);
    } else if (obj.id === 3) {
      console.log(`✓ prompts/list      → ${obj.result.prompts.length} prompts`);
      for (const p of obj.result.prompts) console.log(`     · ${p.name}`);
    } else if (obj.id === 4) {
      const text = obj.result.content[0].text;
      const status = text === "null" ? "null (not yet onboarded)" : "profile exists";
      console.log(`✓ profile.get       → ${status}`);
    } else if (obj.id === 5) {
      if (obj.result.isError) {
        console.log(`✗ todoist.list_active → ${obj.result.content[0].text}`);
      } else {
        const arr = JSON.parse(obj.result.content[0].text);
        console.log(`✓ todoist.list_active → ${arr.length} active task(s) — token works`);
      }
    }
  }
});

child.on("close", (code) => {
  console.log("");
  if (!process.env.TODOIST_TOKEN) {
    console.log("[!] TODOIST_TOKEN not set — skipped Todoist test.");
    console.log("    export TODOIST_TOKEN='your-token' and re-run to verify Todoist auth.");
  }
  process.exit(code ?? 0);
});
