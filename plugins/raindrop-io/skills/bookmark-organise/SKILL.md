---
name: bookmark-organise
description: "Organises Raindrop.io bookmarks — move items between collections, bulk-tag, rename collections, or clean up duplicates. Use this to tidy your library."
---

## Step 1 — Understand the intent

If the user described a specific action (e.g. `/bookmark-organise move all "react" tagged items to "Frontend"`), parse it directly.

If no specific action was given, ask: "What would you like to do? For example: move bookmarks to a collection, bulk-tag, rename a collection, or find duplicates."

## Step 2 — Fetch context

Based on the intent, fetch what is needed:

- For collection operations: call `get_collections` to list available collections.
- For tag operations: call `get_tags` to list existing tags.
- For duplicate detection: call `library_audit` if available, or search for items and compare URLs.

## Step 3 — Plan and confirm

Show the user what will happen before making any changes:

```
Action:  Move 12 bookmarks tagged "react" → collection "Frontend"
```

or

```
Action:  Add tag "archived" to 5 bookmarks in collection "Old Stuff"
```

Ask: "Apply these changes? (yes/no)"

If no, stop.

## Step 4 — Execute

Depending on the action:

- **Move to collection**: call `bulk_raindrops` with the target collection ID and the matched raindrop IDs.
- **Bulk tag**: call `bulk_raindrops` with the tags to add/remove and the matched raindrop IDs.
- **Rename collection**: call `update_collection` with the new name.
- **Delete bookmarks**: call `bulk_raindrops` with the delete action after confirming.
- **Create collection**: call `create_collection` with the name and any parent collection.

## Step 5 — Confirm result

Report what was done:

```
✅ Moved 12 bookmarks to "Frontend"
✅ Renamed "Old Stuff" → "Archive"
```
