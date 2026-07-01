---
name: watch
description: "Live-watch the revu review: on each run, detect annotations added or changed in .revu.json since last time and discuss just those. Designed to run under /loop for a hands-free side-by-side session (you annotate in revu, Claude reacts). Discusses only — never edits code."
---

This skill turns revu into a live review partner. You annotate lines in revu on one side; on the other, this skill picks up each new annotation and discusses it — as it happens.

Claude Code cannot be woken by a file change, so "live" means **polling**: run this skill under the `/loop` primitive. Each run is cheap when nothing changed.

**Recommended invocation:**

```
/loop 15s /revu:watch
```

Stop the loop when you're done reviewing (or it stops itself after a period of no changes — see Step 4).

## Step 1 — Snapshot the current annotations

Get the current review (prefer the live export, which carries severity/status/source):

```sh
revu --export --format json --out -
```

Fall back to reading `.revu.json` directly if that errors. If there are no annotations at all, say "waiting for annotations…" briefly and stop this run.

## Step 2 — Load the last-seen state

Read the state file for this repo:

```
${TMPDIR:-/tmp}/revu-watch-<basename-of-cwd>.json
```

It holds the signatures seen on the previous run. A signature per annotation is: `file:side:startLine:endLine` + `|` + `severity` + `|` + `status` + `|` + a short hash (or the first ~40 chars) of `text`. If the state file is missing, treat every current annotation as new.

## Step 3 — Diff and discuss the new/changed ones

Compute which annotations are **new** (signature not in last-seen) or **changed** (same location, different severity/status/text). If there are none, say "no new annotations" in one line and go to Step 4.

For each new or changed annotation, in severity order (blocker → concern → nitpick → unset):

- Name it (`file:line`, severity) and, if it changed, what changed (e.g. "you bumped this to blocker", "you marked this dismissed").
- Give a short, senior-engineer take: the risk, a concrete suggestion, or a clarifying question. Keep it tight — this is a live stream, not a full report.
- Skip anything now `dismissed` or `resolved` except to acknowledge in one line that the user triaged it away.

Do **not** edit any code. This skill discusses only. If the user wants changes applied, they run `/revu:implement` explicitly.

## Step 4 — Update state and pace the loop

Write the current signatures back to the state file so the next run only surfaces what's newer.

To avoid spinning forever: keep a small counter in the state file of consecutive "no new annotations" runs. After ~20 idle runs (e.g. ~5 minutes at 15s), say the review looks idle and suggest stopping the loop — do not schedule another wake-up yourself; the `/loop` harness controls cadence.

## Constraints

- Discuss only — never modify files. `implement` is the only skill that edits code, and only behind its confirmation gate.
- Never delete `.revu.json` — it is the live channel.
- Keep each run's output short; this is meant to stream alongside an open revu session.
