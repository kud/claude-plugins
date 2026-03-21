---
name: ci-diagnose
description: "Fetches the console log of a failing Jenkins build, identifies the root cause, and explains what went wrong. Use this when a build is red and you want a fast diagnosis."
---

## Step 1 — Resolve the job and build

If the user provided a job name (e.g. `/ci-diagnose my-service`), use it directly.

If the user provided a job name and build number (e.g. `/ci-diagnose my-service 42`), use both.

If neither was given, ask: "Which Jenkins job are you looking at, and which build number (or should I check the last build)?"

## Step 2 — Fetch the build status

Call `get_job_status` with the job name to get the last build number and its result (if no build number was specified).

If a specific build number was provided, call `get_build_status` with the job name and build number.

## Step 3 — Fetch the console log

Call `get_console_log` with the job name and build number.

Limit the log to the most relevant portion — look for lines containing `ERROR`, `FAILED`, `Exception`, `exit code`, or `BUILD FAILURE`.

## Step 4 — Diagnose the failure

Analyse the console output and identify:

- The **root cause** — the first real error, not downstream noise
- The **affected stage or step**
- Any **missing dependencies**, **config issues**, or **flaky test** indicators

## Step 5 — Present the diagnosis

Structure your response as:

```
### CI Diagnosis — <job-name> #<build-number>

**Status**: <FAILURE / ABORTED / etc.>
**Root cause**: <one-sentence summary>

**Details**:
<explanation of what went wrong and why>

**Suggested fix**:
<concrete next step — e.g. "update the dependency", "re-run the flaky test", "check the env var X">
```

If the build is not failing (status is SUCCESS), say so and skip the diagnosis.

## Step 6 — Offer to fetch more context (optional)

If relevant, offer to fetch:

- `get_test_results` — to see which tests failed
- `get_pipeline_stages` — to see which pipeline stage broke
- `get_build_changes` — to correlate with recent commits
