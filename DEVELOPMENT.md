# Development

This is the contributor's manual. For end-user install, see [README](./README.md).

## Prerequisites

- Node.js 20+
- pnpm 9+ (activated automatically via `corepack`; the repo's `packageManager` field pins the version)
- A Todoist API token if you want to exercise the Todoist tools end-to-end

## Get started

```bash
git clone https://github.com/adarshpandey-cs21/kairos.git
cd kairos
corepack enable             # one-time, makes pnpm available
pnpm install                # installs deps + sets up husky hooks
pnpm run build              # tsc compile
pnpm run smoke              # end-to-end smoke test (no MCP client needed)
```

The `smoke` script spawns the built MCP server, sends real JSON-RPC messages, and prints a one-line status per call. Export `TODOIST_TOKEN` first and it'll also verify Todoist auth.

## Scripts

```bash
pnpm run build          # tsc compile to dist/
pnpm run clean          # rm -rf dist
pnpm run dev:mcp        # run MCP server from source via tsx (no build needed)
pnpm run cli -- setup --dry-run   # run the CLI from source
pnpm run smoke          # spawn the built MCP server and exercise it
pnpm run typecheck      # type check only, no emit
pnpm run lint           # biome check (lint + format)
pnpm run lint:fix       # biome auto-fix what's safe
pnpm run format         # biome format only
pnpm run release:dry    # semantic-release dry-run (won't publish)
```

## Project layout

```
src/
├── core/        paths, atomic JSON I/O, stderr logger
├── schema.ts    Zod schemas (Profile, State, TaskSpec, DayRecord)
├── store/       profile / state / history (atomic file writes)
├── todoist/     client + clientId idempotency
├── mcp/         server, tools, prompts, stdio transport
└── cli/         `kairos setup` (Claude Code/Desktop/OpenCode auto-config) + `kairos paths`

skills/
├── kairos-onboard/SKILL.md
├── kairos-plan/SKILL.md
├── kairos-review/SKILL.md
└── kairos-recast/SKILL.md
```

The decoupling rule: `src/store`, `src/todoist`, and `src/schema` know nothing about MCP. `src/mcp` is where they're glued together as tools.

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) to drive automated releases. The pre-commit hook runs Biome auto-fix on staged files; the commit-msg hook validates the message format.

| Prefix | Effect on next release |
|---|---|
| `feat: …` | minor bump (0.1.0 → 0.2.0) |
| `fix: …` | patch bump (0.1.0 → 0.1.1) |
| `feat!: …` *or* `BREAKING CHANGE:` in commit body | major bump (0.1.0 → 1.0.0) |
| `perf:`, `refactor:` | patch bump |
| `chore:`, `docs:`, `style:`, `test:`, `ci:` | no release |

See `commitlint.config.cjs` for the validated type list and `release.config.cjs` for the version-bump mapping.

## Hooks (husky + lint-staged)

The `prepare` script auto-installs husky on `pnpm install` (only inside a git repo). Two hooks are wired:

- `.husky/pre-commit` → `pnpm exec lint-staged` runs `biome check --write` on staged JS/TS/JSON files. Fixes are re-staged automatically.
- `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"` enforces Conventional Commits.

To skip hooks for a specific commit (rare — usually you should fix the issue instead): `git commit --no-verify`.

## Releases

Pushing to the `release` branch triggers `.github/workflows/release.yml`, which runs semantic-release. It computes the next version from commits since the last tag, updates `CHANGELOG.md` and `package.json`, publishes to npm, and creates a GitHub Release.

To dry-run a release locally:

```bash
pnpm run release:dry
```

This computes what version would be published from the current commits without actually publishing.

## Adding a new MCP tool

1. Define the input schema in `src/schema.ts` (Zod).
2. Add the implementation in the relevant `src/store/*` or `src/todoist/*` module.
3. Register the tool in `src/mcp/tools.ts` with name, description, input schema, and handler.
4. Update the smoke test (`scripts/smoke.mjs`) if it should be exercised.
5. Run `pnpm run smoke` to verify wire-up.
6. Update any skill markdown that should call the new tool.

## Adding support for a new MCP client

Edit `src/cli/setup.ts`:
1. Add the client name to the `Client` union.
2. Add a path resolution function for its config file.
3. Add a branch in `buildServerEntry` if its server entry shape differs from Claude's.
4. Add a branch in `serversKeyFor` if its top-level config key differs from `mcpServers`.
5. Add a setup section in `README.md` and a help entry in `src/cli/index.ts`.

The existing OpenCode branch is the template for "different shape" clients.
