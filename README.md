# Kairos

> Plug-and-play personal productivity MCP server. The system exists to put the right task at the right hour.

Kairos is a Model Context Protocol (MCP) server that turns your AI coding assistant into a personal planner. It interviews you once, then every morning scores yesterday's progress, plans today, and syncs tasks to Todoist for in-day push notifications.

## Works with any MCP client

Kairos speaks MCP over stdio (protocol version 2024-11-05), so any MCP-compatible client can use it: Claude Desktop, Claude Code, OpenCode, Cursor, Continue, Cline, Goose — anything that supports MCP servers.

## Install

You don't need to install Kairos globally. Your MCP client spawns it via `npx -y` on demand and it stays in your local npx cache.

First, get a Todoist API token: https://app.todoist.com/app/settings/integrations/developer

```bash
export TODOIST_TOKEN='your-token-here'
```

Then pick your client and run **one command**:

### Claude Code

```bash
npx -y @adarsh-pandey/kairos setup
```

Writes the MCP server entry to `~/.claude.json`, copies the slash-command skills (`/kairos-onboard`, `/kairos-plan`, `/kairos-review`, `/kairos-recast`) to `~/.claude/skills/`, and bakes your `TODOIST_TOKEN` into the config. Restart Claude Code and run `/kairos-onboard`.

### Claude Desktop

```bash
npx -y @adarsh-pandey/kairos setup --client claude-desktop
```

Writes the MCP server entry to your platform's `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/...`). Claude Desktop has no skills surface — its prompt picker exposes our MCP prompts directly. Restart Claude Desktop and pick `onboarding_questions` from the prompts menu.

### OpenCode

```bash
npx -y @adarsh-pandey/kairos setup --client opencode
```

Writes the MCP server entry to `~/.config/opencode/opencode.json` (or `%APPDATA%\opencode\opencode.json` on Windows). For project-level config (`./opencode.json`), add `--scope project`. Restart OpenCode.

### Other MCP clients (Cursor, Continue, Cline, …)

Any client that lets you spawn a stdio MCP server. Use:

- command: `npx`
- args: `["-y", "@adarsh-pandey/kairos"]`
- env: `TODOIST_TOKEN=your-token-here`

If your client uses the Claude-style `mcpServers` block, paste:

```json
{
  "mcpServers": {
    "kairos": {
      "command": "npx",
      "args": ["-y", "@adarsh-pandey/kairos"],
      "env": {
        "TODOIST_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Manual install (skills only, for users who already configured the MCP server)

```bash
npx -y @adarsh-pandey/kairos setup --skills-only
```

## Usage

The server provides three **prompts** (server-rendered, every MCP client supports these) and twelve **tools**.

### Prompts (universal — every MCP client)

- `onboarding_questions` — first-time interview rubric
- `plan_rubric` — generate today's plan
- `review_rubric` — score yesterday and roll into today

In Claude Desktop / OpenCode / etc., invoke prompts via your client's prompt picker.

### Slash commands (Claude Code — via skills)

- `/kairos-onboard` — first-time interview, writes profile.json, arms morning trigger
- `/kairos-plan` — generate today's plan, sync to Todoist
- `/kairos-review` — score yesterday, then roll into today
- `/kairos-recast` — mid-day re-cast when reality diverges

The skills are thin orchestrators that call our MCP tools and prompts in the right order.

## Local data

State lives in `~/.kairos/` (override with `KAIROS_HOME`):

| File | Contents |
|---|---|
| `profile.json` | Goals, focus areas, habits, schedule, preferences. Written once at /kairos-onboard. |
| `state.json` | Streaks, 7-day rolling scores, momentum, recent misses. |
| `history/<YYYY-MM-DD>.json` | One file per day: plan, completions, scores, review summary. |

The morning self-trigger is a recurring Todoist task — Todoist's mobile app pushes a notification at your wake time; you tap it, open your AI client, run review, the loop continues.

## Documentation

Building locally? Check out [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT — see [LICENSE](./LICENSE).
