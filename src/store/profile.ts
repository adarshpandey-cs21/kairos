import { readJson, writeJson } from "../core/atomic.js";
import { paths } from "../core/paths.js";
import { type Profile, ProfileSchema } from "../schema.js";

export async function getProfile(): Promise<Profile | null> {
  const raw = await readJson(paths.profile);
  if (!raw) return null;
  return ProfileSchema.parse(raw);
}

export async function setProfile(input: unknown): Promise<Profile> {
  const parsed = ProfileSchema.parse(input);
  const now = new Date().toISOString();
  parsed.updatedAt = now;
  if (!parsed.createdAt) parsed.createdAt = now;
  await writeJson(paths.profile, parsed);
  return parsed;
}
