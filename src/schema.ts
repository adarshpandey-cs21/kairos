import { z } from "zod";

// Use passthrough so Claude can extend objects with extra fields without us
// breaking on parse — every extension is preserved on disk.
const flex = <T extends z.ZodRawShape>(s: T) => z.object(s).passthrough();

const TimeWindow = z.object({
  start: z.string(),
  end: z.string(),
  reason: z.string().optional(),
});

export const ProfileSchema = flex({
  schemaVersion: z.literal(1).default(1),
  user: flex({
    name: z.string(),
    timezone: z.string().default("UTC"),
  }),
  goals: z
    .array(
      flex({
        id: z.string(),
        title: z.string(),
        horizonWeeks: z.number().int().positive().optional(),
        target: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .default([]),
  focusAreas: z.array(z.string()).default([]),
  habits: z
    .array(
      flex({
        id: z.string(),
        name: z.string(),
        cadence: z.string(), // e.g. "daily", "weekday", "every monday"
        preferredTime: z.string().optional(),
        durationMin: z.number().int().positive().optional(),
      })
    )
    .default([]),
  schedule: flex({
    wake: z.string().optional(),
    sleep: z.string().optional(),
    deepWorkBlocks: z.array(TimeWindow).default([]),
    blocked: z.array(TimeWindow).default([]),
  }).default({}),
  preferences: flex({
    planningHorizonDays: z.number().int().positive().default(1),
    maxDailyTasks: z.number().int().positive().default(8),
  }).default({}),
  productivityStyle: flex({}).default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const StateSchema = flex({
  schemaVersion: z.literal(1).default(1),
  streaks: z
    .record(
      z.string(),
      flex({
        current: z.number().int().nonnegative().default(0),
        best: z.number().int().nonnegative().default(0),
      })
    )
    .default({}),
  rollingScores: flex({
    completion7d: z.number().min(0).max(1).optional(),
    consistency7d: z.number().min(0).max(1).optional(),
    productivity7d: z.number().min(0).max(1).optional(),
  }).default({}),
  goalProgress: z.record(z.string(), flex({})).default({}),
  recentMisses: z.array(flex({})).default([]),
  lastReviewAt: z.string().optional(),
});
export type State = z.infer<typeof StateSchema>;

export const TaskCategory = z.enum(["habit", "goal", "deep-work", "meta", "adhoc"]);

export const TaskSpecSchema = flex({
  clientId: z.string().optional(), // generated when missing
  title: z.string(),
  description: z.string().optional(),
  dueString: z.string().optional(), // Todoist natural language ("today at 9am")
  dueDate: z.string().optional(), // YYYY-MM-DD
  dueDatetime: z.string().optional(), // ISO 8601
  priority: z.number().int().min(1).max(4).default(3),
  labels: z.array(z.string()).default([]),
  category: TaskCategory.default("adhoc"),
  focusArea: z.string().optional(),
});
export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const PlannedTaskSchema = TaskSpecSchema.extend({
  clientId: z.string(),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
});
export type PlannedTask = z.infer<typeof PlannedTaskSchema>;

export const CompletionSchema = flex({
  clientId: z.string().optional(),
  externalId: z.string().optional(),
  title: z.string(),
  completedAt: z.string().optional(),
});
export type Completion = z.infer<typeof CompletionSchema>;

export const DayRecordSchema = flex({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plan: z.array(PlannedTaskSchema).default([]),
  completions: z.array(CompletionSchema).default([]),
  scores: flex({
    completion: z.number().min(0).max(1).optional(),
    consistency: z.number().min(0).max(1).optional(),
    productivity: z.number().min(0).max(1).optional(),
    perFocusArea: z.record(z.string(), z.number()).default({}),
  }).default({}),
  reviewSummary: z.string().optional(),
  generatedAt: z.string().optional(),
  reviewedAt: z.string().optional(),
});
export type DayRecord = z.infer<typeof DayRecordSchema>;
