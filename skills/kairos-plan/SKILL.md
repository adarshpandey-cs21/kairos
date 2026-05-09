---
name: kairos-plan
description: Generate today's Kairos plan from profile + state + recent history, then sync approved tasks to Todoist. Run after /kairos-review or any time you want a fresh plan.
---

# /kairos-plan

Generate today's plan and sync it to Todoist. The kairos MCP server provides all tools.

## Steps

1. Call `profile.get`. If null, tell the user to run `/kairos-onboard` first. STOP.

2. Gather context (in parallel where possible):
   - `state.get`
   - `history.recent` with `{ days: 7 }`
   - `history.get` with today's date (in profile.user.timezone, YYYY-MM-DD)

3. If today's history record already has a non-empty `plan`:
   - Show the existing plan
   - Ask: "A plan already exists for today. Replace it, edit it, or keep it?"
   - On "keep" → STOP. On "edit" → walk through edits, then re-sync only changed/new tasks. On "replace" → continue.

4. Fetch the `plan_rubric` MCP prompt and follow it to draft the plan.

5. Show the draft as a clean list (title · category · priority · time/dueString · focusArea). Ask: **"Approve this plan?"**

6. Iterate on edits until approved.

7. Once approved, for each task in the approved plan, call `todoist.create_task` with `{ task: <TaskSpec> }`. Capture each response's `clientId`, `externalId`, `url`.

8. Call `history.append` with:
   ```json
   {
     "record": {
       "date": "<today YYYY-MM-DD>",
       "plan": [
         { "...TaskSpec fields...", "clientId": "...", "externalId": "...", "externalUrl": "..." }
       ],
       "generatedAt": "<now ISO>"
     }
   }
   ```

9. Tell the user the plan is live in Todoist. Mention the meta task ("Run /kairos-review tomorrow") will fire as a notification at their wake time.

## Rules

- Never create Todoist tasks before the user approves the plan.
- Always include exactly one `category: "meta"` task: the morning self-trigger ("Run /kairos-review in Claude Code", dueString "tomorrow at <wake_time>"). This is what gets you back into Claude.
- Cap non-meta tasks at `profile.preferences.maxDailyTasks`.
- Skip any deep-work scheduling that overlaps `profile.schedule.blocked` windows.
