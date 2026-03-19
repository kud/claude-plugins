---
name: bookmark-search
description: "Searches your Raindrop.io bookmarks by keyword, tag, or collection, and presents matching results. Use this when you remember saving something but can't find it."
---

## Step 1 — Resolve the search query

If the user provided a query (e.g. `/bookmark-search react hooks`), use it directly.

If no query was given, ask: "What are you looking for? You can search by keyword, tag, or topic."

## Step 2 — Search bookmarks

Call `search_bookmarks` with:

- `search` — the query string
- `perpage` — 10 results by default

If the user mentions a collection (e.g. "in my dev collection"), call `get_collections` first to resolve the collection ID, then pass it as `collection`.

## Step 3 — Present results

```
### Bookmarks matching "<query>"

1. **[<title>](<url>)**
   <excerpt or description if available>
   Tags: <tags> | Saved: <date>

2. ...
```

If no results are found, suggest trying broader terms or checking a specific collection.

## Step 4 — Offer to organise (optional)

If results look like unsorted bookmarks (no tags, in "Unsorted"), offer to tag or move them to a collection.
