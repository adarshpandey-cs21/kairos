---
name: kairos-recast
description: Mid-day re-cast of today's Kairos plan. Reshuffle remaining tasks based on what's already happened (a missed deep-work block, an unexpected meeting). Use when reality has diverged from this morning's plan.
---

# /kairos-recast

Re-cast the remainder of today without losing the morning's history. "Recast" because the day's mould is already poured — we're reshaping the part that's still soft. The kairos MCP server provides all tools.

## Steps

1. Call `profile.get`. If null → tell user to run `/kairos-onboard`. STOP.

2. Compute today's date in `profile.user.timezone`.

3. Load context (parallel):
   - `history.get` with today's date
   - `todoist.list_active` (current task state in Todoist)
   - `todoist.list_completed_since` with `{ since: "<today>T00:00:00<tz-offset>" }` (anything completed already today)

4. If today's history record is null or has no plan → no plan to revise. Suggest `/kairos-plan` instead. STOP.

5. Categorise current state:
   - **Completed already today** — leave alone
   - **Still active** — candidates for reschedule, reprioritise, or drop
   - **Active in Todoist but not in our plan** — note them but don't touch unless user asks

6. Ask the user what changed: "What happened? What's left of the day?" Use their answer to decide:
   - drop / defer tasks (call `todoist.update` with new dueString, or `todoist.complete` if they want it cleared)
   - add new tasks (call `todoist.create_task` with `{ task: ... }` — fresh clientIds)
   - reorder priorities (call `todoist.update` with new priority)

7. Show the revised remaining-day plan. Ask: **"Apply these changes?"**

8. Only after approval, perform the Todoist mutations.

9. Update today's history record via `history.append`. Replace `plan` with the new full list (completed tasks at the front, revised remainder after). Add a `reviewSummary` note like "Mid-day recast: dropped 2 deep-work blocks (unexpected meeting), shifted DSA practice to evening."

## Rules

- Don't touch the morning meta task ("Run /kairos-review tomorrow") — leave it alone.
- Don't call `state.patch` — recasting is intra-day; scoring happens at /kairos-review.
- If the user just wants to add one task quickly, skip the full categorisation and call `todoist.create_task` + `history.append` directly.
