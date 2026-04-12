---
name: discuss
description: "Reads the revu review export (revu-review.md) or autosave (.revu.json) from the current directory, presents the annotated diff comments for AI review discussion, then asks whether to delete the export file."
---

## Step 1 — Find the review data

Look for `revu-review.md` in the current directory first. If it exists, use it (it contains an optional AI prompt followed by the annotated diff).

If `revu-review.md` does not exist, fall back to `.revu.json` and parse it as structured JSON (`{ comments: [{ file, startLine, endLine, text }] }`).

If neither file exists, tell the user:

"No review found. Run revu, annotate the diff, then press `e` to export to `revu-review.md`."

Then stop.

## Step 2 — Read the review prompt (if present)

If reading `revu-review.md`, check whether it starts with a prompt section before the `---` separator. If so, treat that text as the user's intent for the review — use it to frame your responses throughout the discussion.

## Step 3 — Discuss each annotated section

Work through each annotation the user left. For each one:

- Acknowledge what the user has flagged
- Respond as a senior code reviewer: surface concrete risks, suggest specific improvements, and ask clarifying questions where the intent behind a change is unclear
- Reference the actual code shown in the snippet — be precise, not generic

Treat the user's annotations as the primary input. Do not produce a general review of the whole diff; only engage with what the user has marked.

## Step 4 — Offer to delete the export file

After the full discussion, ask:

"Delete `revu-review.md`?"

If the user confirms yes, delete it using `trash revu-review.md` (fallback: `rm revu-review.md`). Do not delete `.revu.json` — that is the autosave and should persist across sessions.
