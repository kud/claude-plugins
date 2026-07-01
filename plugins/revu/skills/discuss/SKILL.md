---
name: discuss
description: "Reads the annotations you captured in revu (from .revu.json, via a live headless export) and talks the review through as a senior engineer — leading with blockers, respecting triage state — then offers to clean up any export file."
---

You are discussing a code review the user captured with revu. Talk it through — you do not implement here (that is the `implement` skill). Lead with the most severe items and honour the user's triage.

## Step 1 — Get the review data

Prefer the live, structured export — it carries severity, status, source, and the captured code range, and never needs a file:

```sh
revu --export --format json --out -
```

Run that in the current directory (add `--against <branch>` if the user is reviewing a PR branch). It prints JSON: `{ prompt, comments: [{ file, startLine, endLine, side, severity, status, source, text, code }] }`.

Fallbacks, in order, if that command is unavailable or errors:

1. Read `.revu.json` directly (revu autosaves it on every annotation — same fields, minus `code`).
2. Read `revu-review.md` (the markdown export; parse the annotated sections).

If none exist, tell the user:

"No revu review found. Run `revu` in this repo, annotate the diff (press `↵` on a line), and I'll pick it up — no export needed."

Then stop.

## Step 2 — Read the review prompt

If a `prompt` is present (JSON `prompt` field, or the text before the `---` in `revu-review.md`), treat it as the user's intent for the review and let it frame your responses.

## Step 3 — Order and filter by triage

- **Skip** annotations whose `status` is `dismissed` or `resolved` unless the user explicitly asks to include them — the user has already triaged those away.
- **Order** the rest by severity: `blocker` → `concern` → `nitpick` → unset. Discuss blockers first.
- Note the `source`: an annotation with `source: "agent"` came from another AI pass — treat it as a proposal the human is triaging, not a settled decision.

## Step 4 — Discuss each annotation

Work through the surviving annotations in severity order. For each:

- Name it by `file` and line(s), and its severity if set (e.g. "**blocker** — src/auth.ts:42").
- Respond as a senior reviewer: surface concrete risks, suggest specific improvements, and ask a clarifying question where the intent is unclear.
- Reference the actual `code` in the snippet — be precise, not generic.

Treat the user's annotations as the only agenda. Do not produce a general review of the whole diff; engage only with what they marked.

## Step 5 — Offer to clean up

If you read `revu-review.md`, ask at the end: "Delete `revu-review.md`?" — and if yes, remove it with `trash revu-review.md` (fallback `rm`). Never delete `.revu.json`: it is the live autosave and must persist across sessions.
