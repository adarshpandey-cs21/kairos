import { readdir } from "node:fs/promises";
import { readJson, writeJson } from "../core/atomic.js";
import { paths } from "../core/paths.js";
import { type DayRecord, DayRecordSchema } from "../schema.js";

export async function getDay(date: string): Promise<DayRecord | null> {
  const raw = await readJson(paths.historyFile(date));
  if (!raw) return null;
  return DayRecordSchema.parse(raw);
}

export async function upsertDay(input: unknown): Promise<DayRecord> {
  const parsed = DayRecordSchema.parse(input);
  await writeJson(paths.historyFile(parsed.date), parsed);
  return parsed;
}

export async function recentDays(n: number): Promise<DayRecord[]> {
  let files: string[];
  try {
    files = await readdir(paths.history);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const dates = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()
    .slice(0, n);
  const records = await Promise.all(dates.map((d) => getDay(d)));
  return records.filter((r): r is DayRecord => r !== null);
}
