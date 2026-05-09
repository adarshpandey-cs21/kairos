---
name: kairos-review
description: Review yesterday's progress in Kairos — fetch completions from Todoist, compute scores, update streaks and rolling averages, then immediately run /kairos-plan for today. Run this each morning.
---

# /kairos-review

Score yesterday and roll into today's plan. The kairos MCP server provides all tools.

## Steps

1. Call `profile.get`. If null → tell user to run `/kairos-onboard` first. STOP.

2. Compute yesterday's date in `profile.user.timezone` (YYYY-MM-DD).

3. Call `history.get` with `{ date: <yesterday> }`.
   - If null → no plan yesterday. Tell user, then jump to step 9 (run /kairos-plan for today).

4. Call `todoist.list_completed_since` with `{ since: "<yesterday>T00:00:00<tz-offset>" }`.

5. Fetch the `review_rubric` MCP prompt and follow its scoring rules.

6. Reconcile completions to planned tasks:
   - Match by `clientId` first (preferred — embedded in Todoist task description as `[kairos:UUID]`).
   - Fall back to `externalId` match.
   - A planned task with no match is "missed".

7. Compute scores. **Exclude `category: "meta"` tasks from numerator and denominator** of completion and consistency.
   - completion = completed_non_meta / total_non_meta
   - consistency = completed(category=habit) / total(category=habit)
   - productivity = priority-weighted average over completed (category in {deep-work, goal}); weights: 4=1.0, 3=0.75, 2=0.5, 1=0.25
   - perFocusArea[area] = completed(focusArea=area) / total(focusArea=area)

8. Persist:
   a. Call `history.append` with the updated yesterday record:
      ```json
      {
        "record": {
          "date": "<yesterday>",
          "plan": [...unchanged...],
          "completions": [{ "clientId": "...", "externalId": "...", "title": "...", "completedAt": "..." }],
          "scores": { "completion": 0.72, "consistency": 0.66, "productivity": 0.81, "perFocusArea": { "dsa": 1.0 } },
          "reviewSummary": "1–2 sentence narrative",
          "reviewedAt": "<now ISO>"
        }
      }
      ```
   b. Call `state.get`, then `state.patch` with:
      - `rollingScores`: 7-day moving averages (recompute from `history.recent { days: 7 }`)
      - `streaks`: for each habit, increment current if all of yesterday's habit-tasks for that habit completed; else reset current to 0; bump best if current > best
      - `lastReviewAt`: now
      - `recentMisses`: append any uncompleted non-meta task with a brief reason guess if obvious

9. Show the user a 3-line summary:
   - Yesterday: completion %, plus one notable detail
   - Streaks: one habit's current/best, framed positively or as a reset
   - Observation: one thing to adjust today

10. Continue immediately to `/kairos-plan` for today (you may load that skill or perform the same steps inline).

## Rules

- Never modify Todoist during review. Read-only on Todoist; writes go to history.append and state.patch.
- If reconciliation looks ambiguous (Todoist task with no clientId), prefer to skip it rather than mis-attribute.
- Be terse with the summary — the user opens this every morning.
