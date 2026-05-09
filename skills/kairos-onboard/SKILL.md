---
name: kairos-onboard
description: First-time onboarding for Kairos. Interviews the user to build a profile.json, then arms the daily review trigger. Run this once before /kairos-plan or /kairos-review.
---

# /kairos-onboard

You are conducting first-time onboarding for Kairos, a personal productivity system. The kairos MCP server provides all the tools and prompts you need.

## Steps

1. Call `profile.get`. If it returns a non-null Profile, the user is already onboarded — do NOT re-interview. Tell them they're already set up and offer two choices:
   - run `/kairos-plan` to generate today's plan
   - reply "update" to walk through the interview again and replace the profile
   STOP unless they say "update".

2. Fetch the `onboarding_questions` MCP prompt (server: kairos) and follow its instructions to conduct the interview. Ask one or two questions at a time. Reflect each answer back briefly.

3. When you have enough information, draft a complete Profile JSON object. The schema (passthrough — extra fields are fine):

   ```json
   {
     "schemaVersion": 1,
     "user": { "name": "...", "timezone": "Asia/Kolkata" },
     "goals": [{ "id": "...", "title": "...", "horizonWeeks": 12, "target": "...", "priority": "high" }],
     "focusAreas": ["dsa", "health"],
     "habits": [{ "id": "...", "name": "...", "cadence": "daily", "preferredTime": "07:00", "durationMin": 45 }],
     "schedule": {
       "wake": "06:30", "sleep": "23:00",
       "deepWorkBlocks": [{ "start": "09:00", "end": "12:00" }],
       "blocked": [{ "start": "13:00", "end": "18:00", "reason": "day job" }]
     },
     "preferences": { "planningHorizonDays": 1, "maxDailyTasks": 8 },
     "productivityStyle": { "energyPeak": "morning", "taskChunking": "pomodoro", "stretch": "balanced" }
   }
   ```

4. Show the JSON to the user. Ask: **"Save this profile?"**

5. Only after explicit approval ("yes", "save", "looks good"):
   a. Call `profile.set` with `{ profile: <the json> }`
   b. Call `todoist.create_task` to install the daily self-trigger:
      ```json
      {
        "task": {
          "title": "Run /kairos-review in Claude Code",
          "category": "meta",
          "priority": 4,
          "dueString": "every day at <profile.schedule.wake or 07:00>",
          "description": "Open Claude Code and type /kairos-review to score yesterday and plan today."
        }
      }
      ```
   c. Tell the user setup is complete. Suggest they run `/kairos-plan` now to generate today's plan.

## Rules

- Never call `profile.set` or `todoist.create_task` before the user approves.
- Do not invent values for things the user didn't say — leave optional fields out.
- Keep the conversation natural; don't dump the full question list at once.
