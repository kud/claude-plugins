---
name: bookmark-organise
description: "Organises Raindrop.io bookmarks — move items between collections, bulk-tag, rename collections, or clean up duplicates and broken links. Use this to tidy your library."
---

Bulk changes to a bookmark library are hard to undo and easy to get wrong at scale.
This skill always shows the work before it touches anything.

## Step 1 — Understand the intent

If the user described a specific action (e.g. `/bookmark-organise move all "react" tagged items to "Frontend"`), parse it directly.

If no specific action was given, ask: "What would you like to do? For example: move bookmarks to a collection, bulk-tag, rename a collection, or clean up duplicates and broken links."

## Step 2 — Fetch context

Resolve names to ids first — every write tool takes ids, never names.

- **Collections** — `find_collections` with `search` set to the name the user used. Prefer this over guessing an id.
- **Tags** — `find_tags`. Pass `tags` when the exact names are known, `search` when they aren't.
- **The bookmarks to act on** — `find_bookmarks`. Reach for its filters rather than fetching everything and sifting:

  | Goal | Filter |
  | --- | --- |
  | Duplicates | `is_duplicate: true` |
  | Broken links | `has_broken_link: true` |
  | Untagged items | `is_tagged: false` |
  | Has all of these tags | `has_tags: [...]` |
  | Missing these tags | `lacks_tags: [...]` |
  | By URL shape | `url_pattern: ["*github.com*"]` |

- **Tidying an existing collection or tag** — `find_misplaced_bookmarks` takes `collection_ids` and `find_mistagged_bookmarks` takes `tags`, so resolve those first. Both return **candidates**: verify before acting, and never pipe their output straight into a write.

## Step 3 — Plan and confirm

Never mutate without showing the plan. State the count, the exact change, and where it lands:

```
Action:  Move 12 bookmarks tagged "react" → collection "Frontend" (id 4823)
```

```
Action:  Add tag "archived" to 5 bookmarks in "Old Stuff" (id 1190)
```

If the set is large, or came from a semantic search, list the first few titles so the user can sanity-check the match before agreeing to all of it.

Ask: "Apply these changes? (yes/no)". If no, stop.

**Deleting needs its own confirmation, every time.** `delete_bookmarks` permanently destroys anything already in Trash — there is no second bin. Say so in the prompt, and never fold a delete into a broader "apply these changes?" batch.

## Step 4 — Execute

- **Move to a collection** — `update_bookmarks` with `updates: [{ bookmark_ids, collection_id }]`.
- **Bulk tag** — `update_bookmarks` with `updates: [{ bookmark_ids, tags: { add: [...], remove: [...] } }]`. Both keys are optional.
- **Move and tag together** — one operation carrying `collection_id` *and* `tags`. Don't split it into two calls.
- **Rename or re-parent a collection** — `update_collections` with `updates: [{ collection_id, title }]`. `parent_id: null` moves it to the top level.
- **Create a collection** — `create_collections`. `parent_id` is required: pass `null` for top level.
- **Delete bookmarks** — `delete_bookmarks` with `bookmark_ids`, only after the separate confirmation above.

Everything caps at **150 items per call**. Past that, batch — and report the total rather than the batch size, so the user sees what actually happened.

## Step 5 — Confirm result

One line per action:

```
✅ Moved 12 bookmarks to "Frontend"
✅ Renamed "Old Stuff" → "Archive"
```

If a batch partly failed, say which part and what is still outstanding. Never report a total that includes items that didn't land.
