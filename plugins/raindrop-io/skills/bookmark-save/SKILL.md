---
name: bookmark-save
description: "Saves a URL to Raindrop.io, checking first whether it is already in your library. Use this to bookmark a link."
---

Saving the same link twice is the most common way a bookmark library gets messy.
This skill looks before it writes.

## Step 1 — Resolve the URL

If the user provided a URL (e.g. `/bookmark-save https://example.com`), use it directly.

If no URL was given, ask: "What URL would you like to save?"

## Step 2 — Check whether it is already saved

Call `find_bookmarks` with `url_pattern` built from the URL's host and path, wildcarded at both ends — `*example.com/article*`. Match on the URL, not on the title.

- **Already there** — don't save a second copy. Report where it lives and stop:

  ```
  Already saved: <title> — in "<collection>", tagged <tags>
  ```

  Then offer, in one line, to add tags or move it instead. Don't create a duplicate unless the user explicitly asks for one.

- **Not there** — continue to Step 3.

Skip this check only if the user has said to just save it.

## Step 3 — Save

Call `create_bookmarks` with `create: [{ link }]`.

- **Leave `title` out.** Raindrop fetches it from the page, and a guessed title is worse than the real one.
- **Leave `collection_id` out** unless the user named a collection — it defaults to Unsorted, which is the right place for something filed without thought.
- If the user *did* name a collection, resolve it with `find_collections` using `search` and pass the id. If no collection matches, say so and save to Unsorted rather than inventing one.
- **Don't ask for tags.** Add them only if the user supplied them.

## Step 4 — Confirm

```
✓ Saved: <title> — <url>
```

Name the collection too when it wasn't Unsorted.
