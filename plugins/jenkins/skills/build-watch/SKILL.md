---
name: build-watch
description: "Triggers a Jenkins build and watches it until completion, streaming status updates. Use this when you want to kick off a build and get notified when it's done."
---

## Step 1 — Resolve the job and parameters

If the user provided a job name (e.g. `/build-watch my-service`), use it directly.

If the user provided parameters (e.g. `/build-watch my-service BRANCH=main ENV=staging`), parse them as key-value pairs.

If no job name was given, ask: "Which Jenkins job do you want to trigger?"

## Step 2 — Trigger the build

Call `trigger_build` with the job name and any provided parameters.

Confirm the build was queued and note the queue ID if returned.

## Step 3 — Poll until complete

Call `get_job_status` every 15 seconds to check whether the build has started and what its current state is.

Once the build number is known (it may take a few seconds to move from queue to running), switch to `get_build_status` with the specific build number.

Report status updates as they happen:

- `QUEUED` → "Build is queued..."
- `RUNNING` → "Build #N is running (started <time>)..."
- `SUCCESS` → "✅ Build #N passed"
- `FAILURE` → "❌ Build #N failed"
- `ABORTED` → "⚠️ Build #N was aborted"

Stop polling after 30 minutes. If the build hasn't finished by then, say so and provide the build URL.

## Step 4 — Post-build summary

On completion, present:

```
### Build <job-name> #<N> — <STATUS>

**Duration**: <duration>
**Triggered by**: <cause>
**Branch**: <branch if available>
```

If the build failed, automatically run the `ci-diagnose` skill to explain the failure.

## Step 5 — Offer next steps (optional)

Offer to:

- Fetch `get_test_results` if tests ran
- Fetch `get_artifacts` if the build produced artifacts
- Replay the build with `replay_build` if it failed due to a transient issue
