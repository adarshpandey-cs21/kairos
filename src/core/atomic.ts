import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";

export async function readJson<T = unknown>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
