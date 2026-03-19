---
name: bookmark-save
description: "Saves a URL to Raindrop.io with optional tags and collection. Use this when you want to bookmark something without leaving Claude."
---

## Step 1 — Resolve the URL and metadata

If the user provided a URL (e.g. `/bookmark-save https://example.com`), use it directly.

If the user also provided tags (e.g. `/bookmark-save https://example.com #dev #react`), parse them.

If no URL was given, ask: "What URL do you want to save?"

## Step 2 — Resolve the collection (optional)

If the user mentioned a collection name, call `get_collections` to find the matching collection ID.

If no collection was specified, save to the default (Unsorted).

## Step 3 — Save the bookmark

Call `create_bookmark` with:

- `link` — the URL
- `tags` — parsed tags if provided
- `collection.id` — the resolved collection ID if specified

## Step 4 — Confirm

```
✅ Saved: **<title>**
   <url>
   Collection: <collection name>
   Tags: <tags or "none">
```

If Raindrop already has this URL, inform the user and offer to update the tags or collection instead.
