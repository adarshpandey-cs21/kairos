import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { logger } from "../core/logger.js";
import { DayRecordSchema, ProfileSchema, TaskSpecSchema } from "../schema.js";
import * as historyStore from "../store/history.js";
import * as profileStore from "../store/profile.js";
import * as stateStore from "../store/state.js";
import * as todoist from "../todoist/client.js";
import { PROMPTS } from "./prompts.js";

interface ToolDef<I extends z.ZodTypeAny> {
  name: string;
  description: string;
  input: I;
  handler: (args: z.infer<I>) => Promise<unknown>;
}
const tool = <I extends z.ZodTypeAny>(t: ToolDef<I>) => t;

const TOOLS: ToolDef<any>[] = [
  tool({
    name: "profile.get",
    description: "Get the user's stored profile. Returns null if onboarding hasn't run.",
    input: z.object({}),
    handler: async () => profileStore.getProfile(),
  }),
  tool({
    name: "profile.set",
    description:
      "Save the user's profile. Validates against the Profile schema. Always call after explicit user approval.",
    input: z.object({ profile: ProfileSchema }),
    handler: async ({ profile }) => profileStore.setProfile(profile),
  }),

  tool({
    name: "state.get",
    description: "Get mutable user state (streaks, rolling scores, goal progress).",
    input: z.object({}),
    handler: async () => stateStore.getState(),
  }),
  tool({
    name: "state.patch",
    description:
      "Shallow-merge a patch into state. Read-modify-write: get state first, mutate, then patch.",
    input: z.object({ patch: z.record(z.unknown()) }),
    handler: async ({ patch }) => stateStore.patchState(patch),
  }),

  tool({
    name: "history.get",
    description: "Get the day record for a date (YYYY-MM-DD), or null if missing.",
    input: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    handler: async ({ date }) => historyStore.getDay(date),
  }),
  tool({
    name: "history.recent",
    description: "Get the most recent N day records, newest first.",
    input: z.object({ days: z.number().int().min(1).max(60).default(7) }),
    handler: async ({ days }) => historyStore.recentDays(days),
  }),
  tool({
    name: "history.append",
    description:
      "Upsert a day record. Use to write the day's plan, completions, scores, and review summary.",
    input: z.object({ record: DayRecordSchema }),
    handler: async ({ record }) => historyStore.upsertDay(record),
  }),

  tool({
    name: "todoist.create_task",
    description:
      "Create a Todoist task. Idempotent on clientId (auto-generated if absent). Returns clientId, externalId, url, title.",
    input: z.object({ task: TaskSpecSchema }),
    handler: async ({ task }) => todoist.createTask(task),
  }),
  tool({
    name: "todoist.list_active",
    description: "List currently-active (non-completed) Todoist tasks.",
    input: z.object({}),
    handler: async () => todoist.listActive(),
  }),
  tool({
    name: "todoist.list_completed_since",
    description: "List Todoist tasks completed since the given ISO datetime.",
    input: z.object({ since: z.string() }),
    handler: async ({ since }) => todoist.listCompletedSince(since),
  }),
  tool({
    name: "todoist.complete",
    description: "Mark a Todoist task complete by external (Todoist) id.",
    input: z.object({ externalId: z.string() }),
    handler: async ({ externalId }) => {
      await todoist.complete(externalId);
      return { ok: true };
    },
  }),
  tool({
    name: "todoist.update",
    description: "Update a Todoist task (title/description/priority/labels/due) by external id.",
    input: z.object({ externalId: z.string(), patch: TaskSpecSchema.partial() }),
    handler: async ({ externalId, patch }) => {
      await todoist.update(externalId, patch);
      return { ok: true };
    },
  }),
];

export function registerHandlers(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.input, {
        $refStrategy: "none",
      }) as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const t = TOOLS.find((x) => x.name === req.params.name);
    if (!t) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
      };
    }
    try {
      const args = t.input.parse(req.params.arguments ?? {});
      const result = await t.handler(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`tool ${t.name} failed`, { error: message });
      return {
        isError: true,
        content: [{ type: "text", text: `Error in ${t.name}: ${message}` }],
      };
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Object.entries(PROMPTS).map(([name, p]) => ({
      name,
      description: p.description,
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const p = PROMPTS[req.params.name];
    if (!p) throw new Error(`Unknown prompt: ${req.params.name}`);
    return {
      description: p.description,
      messages: [{ role: "user", content: { type: "text", text: p.text } }],
    };
  });
}
