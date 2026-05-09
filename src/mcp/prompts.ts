// Versioned prompt templates served via MCP `prompts/get`. Skills load these
// into Claude's context to drive each flow.

export const ONBOARDING_QUESTIONS = `You are conducting first-time onboarding for Kairos, a personal productivity system.

Goal: produce a complete Profile JSON object after a short, conversational interview.

Cover these areas, but ask only one or two questions at a time. Reflect each answer back briefly to confirm you understood.

1. Identity & timezone
   - Name
   - Timezone (e.g. Asia/Kolkata, America/Los_Angeles)
   - Typical wake / sleep times

2. Goals (1–3 long-horizon goals)
   - Title
   - Horizon in weeks
   - What "done" looks like
   - Priority: low | medium | high

3. Focus areas
   - Short tags (e.g. dsa, health, learning, side-project)

4. Habits
   - For each: name, cadence (daily / weekday / "every monday"), preferred time, duration in minutes

5. Daily schedule constraints
   - Deep-work blocks (time windows you can do focused work)
   - Blocked windows (e.g. 09:00–18:00 day job, 13:00–14:00 lunch)

6. Preferences
   - Max daily tasks (default 8)
   - Anything else worth recording

7. Productivity style
   - Energy peak (morning / afternoon / evening)
   - Task chunking (pomodoro / timeboxed / freeform)
   - Risk tolerance for stretch goals (conservative / balanced / ambitious)

When you have enough, draft the full Profile JSON. Show it to the user. Wait for explicit approval ("save", "looks good", "yes"). Only then call profile.set.`;

export const PLAN_RUBRIC = `You are generating a single-day plan for Kairos.

Inputs to fetch first:
- profile.get
- state.get
- history.recent { days: 7 }
- history.get { date: <today> } (skip if it already has a plan; ask user before overwriting)

Constraints:
- Cap non-meta tasks at profile.preferences.maxDailyTasks
- Never schedule deep-work tasks inside profile.schedule.blocked windows
- Place priority-4 tasks inside profile.schedule.deepWorkBlocks
- Each habit in profile.habits should appear (respecting its cadence)
- Always include exactly one meta task: title "Run /kairos-review in Claude Code", category "meta", dueString "tomorrow at <wake time, default 07:00>", priority 4

Categories (one per task):
- "habit"      — recurring habit
- "goal"       — goal work (set focusArea)
- "deep-work"  — focused block
- "meta"       — system task (excluded from scoring)
- "adhoc"      — one-off

Adapt to recent state:
- If state.rollingScores.completion7d < 0.5 → plan ~30% fewer tasks (avoid burnout loop).
- If a habit has missed 3+ recent days → keep it, but lower priority and place it at the energy peak.
- If a goal area has stalled (no completions in 3 days) → schedule one specific, small starter task in that area.

Process:
1. Draft the plan as a list of TaskSpec objects.
2. Show the plan to the user. Allow edits.
3. ONLY after explicit approval, for each task call todoist.create_task. Capture clientId and externalId from each response.
4. Call history.append with { record: { date: <today>, plan: [PlannedTask...], generatedAt: now } }. Each PlannedTask = TaskSpec + { clientId, externalId, externalUrl }.
5. Tell the user the plan is live in Todoist. Mention Todoist will handle the in-day reminders.`;

export const REVIEW_RUBRIC = `You are reviewing yesterday's progress for Kairos and updating scores.

Process:
1. Compute yesterday's date in profile.user.timezone (YYYY-MM-DD).
2. Load history.get { date: yesterday }. If null, tell the user there's no plan to review and offer to run /kairos-plan instead.
3. Call todoist.list_completed_since with ISO datetime = yesterday at 00:00 (in user timezone).
4. Reconcile completions to planned tasks by clientId (preferred) or externalId.
5. Compute scores. Exclude category="meta" from numerators and denominators of completion/consistency.
   - completion = completedNonMeta / totalNonMeta
   - consistency = completed(category=habit) / total(category=habit)
   - productivity = priority-weighted average of completed (category in {deep-work, goal})
       weights: priority 4=1.0, 3=0.75, 2=0.5, 1=0.25
   - perFocusArea[area] = completed(focusArea=area) / total(focusArea=area)
6. Write yesterday back via history.append with { record: { ...yesterday, completions, scores, reviewSummary, reviewedAt: now } }. reviewSummary = 1–2 sentence narrative ("Solid morning, missed evening workout — third miss this week.").
7. Update state via state.patch:
   - rollingScores: 7-day moving averages over the last 7 reviewed days (use history.recent { days: 7 })
   - streaks: for each habit, increment current if all of yesterday's habit-tasks for that habit completed; else current=0; bump best if current > best
   - lastReviewAt: now
8. Show the user a 3-line summary:
   - Yesterday's completion rate + 1 detail
   - Streak status (one habit either + or reset)
   - One observation or recommendation
9. Then continue immediately to /kairos-plan for today.`;

export const PROMPTS: Record<string, { description: string; text: string }> = {
  onboarding_questions: {
    description: "Conduct first-time onboarding to build a profile.",
    text: ONBOARDING_QUESTIONS,
  },
  plan_rubric: {
    description: "Generate today's plan from profile + state + history.",
    text: PLAN_RUBRIC,
  },
  review_rubric: {
    description: "Review yesterday's completions and update scores.",
    text: REVIEW_RUBRIC,
  },
};
