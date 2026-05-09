import { v4 as uuidv4 } from "uuid";

// Marker we embed in Todoist task descriptions so we can recognise our own
// tasks on the way back, regardless of how the user edits them.
const MARKER = "kairos";
const RE = /\[kairos:([0-9a-f-]{8,})\]/i;

export const newClientId = (): string => uuidv4();

export function embedClientId(description: string | undefined, clientId: string): string {
  const base = description ? `${description.trimEnd()}\n\n` : "";
  return `${base}[${MARKER}:${clientId}]`;
}

export function extractClientId(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(RE);
  return m ? m[1] : null;
}

export function stripClientId(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(/\n*\[kairos:[0-9a-f-]+\]\s*$/i, "").trimEnd();
}
