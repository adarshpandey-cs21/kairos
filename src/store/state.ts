import { readJson, writeJson } from "../core/atomic.js";
import { paths } from "../core/paths.js";
import { type State, StateSchema } from "../schema.js";

const empty = (): State => StateSchema.parse({});

export async function getState(): Promise<State> {
  const raw = await readJson(paths.state);
  if (!raw) return empty();
  return StateSchema.parse(raw);
}

// Shallow-merge patch into current state. Nested keys (streaks, rollingScores,
// goalProgress) are replaced wholesale if present in patch — Claude is
// expected to read-modify-write via state.get + state.patch.
export async function patchState(patch: Record<string, unknown>): Promise<State> {
  const current = await getState();
  const merged = StateSchema.parse({ ...current, ...patch });
  await writeJson(paths.state, merged);
  return merged;
}
