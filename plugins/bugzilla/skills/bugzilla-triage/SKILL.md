---
name: bugzilla-triage
description: "Search a set of Firefox/Mozilla bugs, summarise their state and recent activity, and propose triage actions (comment, reassign, mark duplicate, change status). Use this to work through a backlog for a product or component."
---

## Step 1 — Resolve the scope

If the user gave explicit bug IDs (e.g. `/bugzilla-triage 1234567 1234599`), use
those directly — skip to Step 3.

Otherwise resolve a search scope: product, component, status, severity, or a
free-text query. If none of that was given, ask: "Which product/component (or
search term) should I triage, and which statuses — e.g. UNCONFIRMED and NEW?"

Default to untriaged-leaning statuses (`UNCONFIRMED`, `NEW`) when the user
didn't specify, since that's the common triage intent.

## Step 2 — Fetch the candidate bugs

Call `search_bugs` with the resolved scope. Cap the batch at 10 bugs per run —
triage output is only useful if it stays readable; offer to continue with the
next batch afterwards.

## Step 3 — Enrich each bug

For each bug in the batch, fetch in parallel:

- `get_bug` — current status, severity, assignee, product/component
- `get_comments` — to see the most recent comment and gauge activity/staleness
- `get_bug_history` — only if the user asked about churn or wants to know what
  changed recently; skip by default to keep this fast

## Step 4 — Present the triage summary

```
### Triage — <scope>

| ID | Status | Severity | Assignee | Last activity | Signal |
| -- | ------ | -------- | -------- | -------------- | ------ |
| 1234567 | UNCONFIRMED | -- | nobody@mozilla.org | 3 comments, last 2d ago | Needs severity + owner |
| 1234599 | NEW | S3 | nobody@mozilla.org | no comments in 90d | Stale — consider needinfo |
```

For each bug, call out one **signal** in plain language: unconfirmed with no
severity set, no owner, gone quiet for a long stretch, looks like a duplicate
of another bug in the batch, or genuinely ready to work.

## Step 5 — Propose next actions

List concrete suggested actions per bug (severity to set, needinfo to request,
a duplicate to mark, a comment to post). Don't execute anything yet.

## Step 6 — Confirm before writing

Any action that mutates Bugzilla (`create_comment`, `update_bug`,
`update_comment_tags`) requires `MCP_BUGZILLA_API_KEY` to be configured — if a
write call fails with an auth error, tell the user the API key is missing and
stop rather than retrying.

Show the exact action(s) about to run:

```
Action: UPDATE_BUG
Bug:    1234599
Change: severity → S3, add comment "still reproducible on latest Nightly, needinfo :owner"
```

Ask: "Confirm? (yes/no)"

If no, skip that bug and move to the next.

## Step 7 — Execute and report

For each confirmed action, call the matching write tool
(`update_bug` for status/severity/CC/duplicate changes, `create_comment` for
comments, `update_comment_tags` for tagging). Report per-bug outcomes:

```
✅ 1234599 — severity set to S3, comment posted
```

If a call fails, report the error for that bug and continue with the rest of
the batch rather than aborting the whole run.
