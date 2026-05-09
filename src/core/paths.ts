import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = process.env.KAIROS_HOME ?? join(homedir(), ".kairos");

export const paths = {
  root: ROOT,
  profile: join(ROOT, "profile.json"),
  state: join(ROOT, "state.json"),
  history: join(ROOT, "history"),
  historyFile: (date: string) => join(ROOT, "history", `${date}.json`),
};
