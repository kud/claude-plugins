---
name: flag-toggle
description: "Kills or restores a Harness FME feature flag in one or more environments. Use this to quickly disable a flag in production or bring it back after an incident."
---

## Step 1 — Resolve the flag name and action

If the user provided a flag name and action (e.g. `/flag-toggle my-flag kill` or `/flag-toggle my-flag restore`), use them directly.

If no flag name was given, ask: "Which feature flag do you want to toggle?"

If no action was given, ask: "Do you want to kill or restore it?"

## Step 2 — Resolve workspace and environments

If no workspace is specified, call `list_workspaces` and use the first result, or ask if there are multiple.

Call `list_environments` to get all available environments.

If the user specified an environment, use it. If not, ask: "Which environment? (or 'all')"

## Step 3 — Confirm before acting

Show the user a summary of the action before executing:

```
Action:  KILL / RESTORE
Flag:    <flag-name>
Env(s):  <environment(s)>
```

Ask: "Confirm? (yes/no)"

If no, stop.

## Step 4 — Execute

For each target environment:

- If killing: call `kill_feature_flag` with the workspace ID, environment ID, and flag name.
- If restoring: call `restore_feature_flag` with the workspace ID, environment ID, and flag name.

## Step 5 — Confirm result

Report the outcome per environment:

```
✅ Killed in production
✅ Killed in staging
```

or

```
✅ Restored in production
```

If any call fails, report the error clearly and do not proceed with remaining environments.
