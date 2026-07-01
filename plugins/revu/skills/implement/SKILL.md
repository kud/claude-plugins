---
name: implement
description: "Apply the review annotations you captured in revu: read them (via a live headless export), present a severity-ordered checklist, skip anything dismissed, confirm, implement each exactly as written, then offer to clean up and run lint/tests."
---

You are implementing the review annotations captured by revu. Read the review data, present it clearly, get explicit confirmation, then implement each annotation exactly as written. This is the counterpart to `discuss`: `discuss` talks the review through, `implement` applies it.

## Step 1 — Get the review data

Prefer the live, structured export — it carries severity, status, source, and the captured code range:

```sh
revu --export --format json --out -
```

Run that in the current directory (add `--against <branch>` for a PR-branch review). It prints `{ prompt, comments: [{ file, startLine, endLine, side, severity, status, source, text, code }] }`.

Fallbacks, in order, if that command is unavailable or errors:

1. Read `.revu.json` directly (accept an object with a `comments` key, or a root array of the same objects).
2. Read `revu-review.md` and parse the annotated sections.

If none exists, tell the user to annotate a diff in `revu` first, then stop. If the data is empty or malformed, say so and stop.

## Step 2 — Filter by triage

Before listing anything:

- **Skip** annotations whose `status` is `dismissed` (the user rejected them) or `resolved` (already handled). Do not implement these. Note how many you skipped and why.
- Keep `open` and `accepted` annotations — those are the work.

If filtering leaves nothing to do, tell the user everything is dismissed/resolved and stop.

## Step 3 — Display the checklist

Group the surviving annotations by file, **ordered by severity** (blocker → concern → nitpick → unset), and show severity + source per item:

```
Files to update:

src/foo.ts
  [ ] 1. blocker · L42 — Extract this into a named function
  [ ] 2. nitpick · L87 — Remove dead code (source: agent)

src/bar.ts
  [ ] 3. concern · L12 — Rename variable for clarity
```

Show the total: **N annotations across M files** (and **K skipped as dismissed/resolved**).

## Step 4 — Confirmation gate

Ask explicitly: **"Proceed to implement all N annotations? (yes / no)"**

Do not change anything until the user says yes. If they don't, stop and wait.

## Step 5 — Implement

Work file by file, blockers first. For each annotation, make exactly the change its `text` describes at the given line — no unrelated edits, no scope creep. Use the `code` snippet to locate the exact spot. Batch the edits per file. If an annotation is ambiguous, implement your best interpretation and flag it to the user afterwards.

## Step 6 — Offer to clean up

Once every annotation is implemented, ask: **"Delete the review export? (yes / no)"** — this refers to `revu-review.md` only. Delete it with `trash` (fallback `rm`) if the user agrees and all annotations were processed without error. Never delete `.revu.json` — it is the live autosave.

## Step 7 — Offer lint/tests

Ask whether to run the project's lint and tests, and run them if the user agrees.

## Constraints

- Never implement anything before explicit confirmation in step 4.
- Never implement a `dismissed` or `resolved` annotation.
- Implement annotations exactly as written — do not interpret loosely or add unrequested changes.
- If any edit fails, pause and ask the user how to proceed before continuing.
