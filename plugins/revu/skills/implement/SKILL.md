---
name: implement
description: "Apply the review comments from a revu export (.revu.json or revu-review.md) in the current directory: present them as a checklist, confirm, implement each exactly as written, then offer to delete the export."
---

You are implementing the review comments captured by revu. Your job is to read the review data, present it clearly, get explicit confirmation, then implement each comment exactly as written. This is the counterpart to `discuss`: `discuss` talks the review through, `implement` applies it.

## Step 1 — Find the review data

Look for these in the current working directory, in order:

1. `.revu.json` — structured JSON, preferred because it is directly implementable. Accept either a root array or an object with a `comments` key:
   - `{ "comments": [ { "file": "...", "startLine": 42, "endLine": 42, "text": "..." }, ... ] }`
   - or a root array of the same comment objects.
2. `revu-review.md` — fall back to parsing the annotated diff comments if no `.revu.json` exists.

If neither file exists, tell the user to export a review from revu first, then stop. If the file is empty or malformed, tell the user and stop.

## Step 2 — Display the checklist

Group comments by file and present a numbered TODO checklist:

```
Files to update:

src/foo.ts
  [ ] 1. Line 42 — Extract this into a named function
  [ ] 2. Line 87 — Remove dead code

src/bar.ts
  [ ] 3. Line 12 — Rename variable for clarity
```

Show the total: **N comments across M files**.

## Step 3 — Confirmation gate

Ask explicitly: **"Proceed to implement all N comments? (yes / no)"**

Do not change anything until the user says yes. If they don't, stop and wait.

## Step 4 — Implement

Work file by file. For each comment, make exactly the change its text describes at the given line — no unrelated edits, no scope creep. Batch the edits per file. If a comment is ambiguous, implement your best interpretation and flag it to the user afterwards.

## Step 5 — Offer to delete the export

Once every comment has been implemented, ask: **"Delete the review export (.revu.json / revu-review.md)? (yes / no)"** Delete it only if the user agrees and all comments were processed without error.

## Step 6 — Offer lint/tests

Ask whether to run the project's lint and tests, and run them if the user agrees.

## Constraints

- Never implement anything before explicit confirmation in step 3.
- Implement comments exactly as written — do not interpret loosely or add unrequested changes.
- Do not delete the export unless all comments were processed successfully.
- If any edit fails, pause and ask the user how to proceed before continuing.
