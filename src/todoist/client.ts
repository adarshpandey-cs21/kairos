import { TodoistApi } from "@doist/todoist-api-typescript";
import { type TaskSpec, TaskSpecSchema } from "../schema.js";
import { embedClientId, extractClientId, newClientId, stripClientId } from "./idempotency.js";

let api: TodoistApi | null = null;

function getApi(): TodoistApi {
  if (!api) {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
      throw new Error(
        "TODOIST_TOKEN environment variable is not set. Get a token at " +
          "https://app.todoist.com/app/settings/integrations/developer and export it."
      );
    }
    api = new TodoistApi(token);
  }
  return api;
}

export interface CreatedTask {
  clientId: string;
  externalId: string;
  url: string;
  title: string;
}

export interface ExternalTask {
  externalId: string;
  clientId: string | null;
  title: string;
  description: string;
  labels: string[];
  priority: number;
  due: { date?: string; datetime?: string; string?: string } | null;
  url: string;
  isCompleted: boolean;
  completedAt?: string;
}

function toExternal(t: any): ExternalTask {
  return {
    externalId: String(t.id),
    clientId: extractClientId(t.description ?? t.content_description),
    title: t.content,
    description: stripClientId(t.description ?? ""),
    labels: t.labels ?? [],
    priority: t.priority ?? 1,
    due: t.due ?? null,
    url: t.url ?? "",
    isCompleted: !!(t.isCompleted ?? t.is_completed ?? t.checked),
    completedAt: t.completedAt ?? t.completed_at ?? undefined,
  };
}

// Defensive: paginated/non-paginated SDK shapes both seen across versions.
async function callPaginated(method: string, args?: any): Promise<any[]> {
  const a: any = getApi();
  if (typeof a[method] !== "function") {
    throw new Error(`Todoist SDK has no method '${method}'. Check installed version.`);
  }
  const all: any[] = [];
  let cursor: string | null = null;
  let safety = 0;
  do {
    const res: any = await a[method]({ ...(args ?? {}), ...(cursor ? { cursor } : {}) });
    if (Array.isArray(res)) {
      all.push(...res);
      break;
    }
    if (res?.results) {
      all.push(...res.results);
      cursor = res.nextCursor ?? null;
    } else if (res?.items) {
      all.push(...res.items);
      cursor = res.nextCursor ?? null;
    } else {
      break;
    }
    if (++safety > 50) break;
  } while (cursor);
  return all;
}

export async function listActive(): Promise<ExternalTask[]> {
  const items = await callPaginated("getTasks");
  return items.map(toExternal);
}

export async function listCompletedSince(sinceIso: string): Promise<ExternalTask[]> {
  const a: any = getApi();
  const opts = { since: sinceIso, until: new Date().toISOString() };
  const candidates = ["getCompletedTasksByCompletionDate", "getTasksCompletedByCompletionDate"];
  let res: any = null;
  for (const m of candidates) {
    if (typeof a[m] === "function") {
      res = await a[m](opts);
      break;
    }
  }
  if (res === null && a.tasks?.getCompletedByCompletionDate) {
    res = await a.tasks.getCompletedByCompletionDate(opts);
  }
  if (res === null) {
    throw new Error(
      "Todoist SDK: no completed-tasks method found. Update @doist/todoist-api-typescript."
    );
  }
  const items: any[] = Array.isArray(res) ? res : (res.items ?? res.results ?? []);
  return items.map((t) => ({ ...toExternal(t), isCompleted: true }));
}

export async function createTask(spec: TaskSpec): Promise<CreatedTask> {
  const parsed = TaskSpecSchema.parse(spec);
  const clientId = parsed.clientId ?? newClientId();

  // Idempotency check: don't double-create if a task with this clientId is already active.
  const active = await listActive();
  const existing = active.find((t) => t.clientId === clientId);
  if (existing) {
    return {
      clientId,
      externalId: existing.externalId,
      url: existing.url,
      title: existing.title,
    };
  }

  const labels = Array.from(
    new Set([
      ...(parsed.labels ?? []),
      parsed.category,
      ...(parsed.focusArea ? [`focus:${parsed.focusArea}`] : []),
    ])
  );

  const created: any = await (getApi() as any).addTask({
    content: parsed.title,
    description: embedClientId(parsed.description, clientId),
    priority: parsed.priority,
    labels,
    ...(parsed.dueString ? { dueString: parsed.dueString } : {}),
    ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
    ...(parsed.dueDatetime ? { dueDatetime: parsed.dueDatetime } : {}),
  });

  return {
    clientId,
    externalId: String(created.id),
    url: created.url ?? "",
    title: created.content,
  };
}

export async function complete(externalId: string): Promise<void> {
  await (getApi() as any).closeTask(externalId);
}

export async function update(externalId: string, patch: Partial<TaskSpec>): Promise<void> {
  const body: any = {};
  if (patch.title) body.content = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.priority) body.priority = patch.priority;
  if (patch.labels) body.labels = patch.labels;
  if (patch.dueString) body.dueString = patch.dueString;
  if (patch.dueDate) body.dueDate = patch.dueDate;
  if (patch.dueDatetime) body.dueDatetime = patch.dueDatetime;
  await (getApi() as any).updateTask(externalId, body);
}
