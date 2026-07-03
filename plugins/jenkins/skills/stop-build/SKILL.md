---
name: stop-build
description: "Stops a running Jenkins build. Use this to abort a build that is stuck, triggered by mistake, or no longer needed."
---

## Step 1 — Resolve the job and build

If the user provided a job name (e.g. `/stop-build my-service`), use it directly.

If no job name was given, ask: "Which Jenkins job do you want to stop?"

If a specific build number was provided, use it. Otherwise call `get_job_status` to get the currently running build number.

If no build is currently running, say so and stop.

## Step 2 — Confirm before stopping

Show the user what will be stopped:

```
Job:    <job-name>
Build:  #<N>
Status: RUNNING
```

Ask: "Stop this build? (yes/no)"

If no, stop.

## Step 3 — Stop the build

Call `stop_build` with the job name and build number.

## Step 4 — Confirm

Verify the build was aborted by calling `get_build_status`. Report the result:

```
⚠️ Build #<N> aborted.
```

If the build is still running (stop can take a few seconds), wait and retry once before reporting failure.
