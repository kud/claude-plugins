---
name: bookmark-search
description: "Searches your Raindrop.io bookmarks by meaning, tag, collection, or URL shape. Use this to find a saved link."
---

Raindrop's search understands meaning, not just keywords — it matches across title,
note, URL, tags and the page text itself. This skill uses that rather than
keyword-matching, and narrows with filters instead of asking follow-up questions.

## Step 1 — Resolve the query

If the user provided a query (e.g. `/bookmark-search react hooks`), use it directly.

If no query was given, ask: "What are you looking for?"

## Step 2 — Search

Call `find_bookmarks`. Pass the user's own words as `search` — it is a natural-language
parameter, so **don't reduce a phrase to keywords**. "that article about why CSS grid beat
flexbox" works better whole than as `css grid flexbox`.

Translate anything else the user said into filters rather than a second search:

| They said | Filter |
| --- | --- |
| "in my Reading collection" | `collection_ids` (resolve via `find_collections` with `search`) |
| "tagged react" | `has_tags: ["react"]` |
| "from GitHub" | `url_pattern: ["*github.com*"]` |
| "saved last month" | `created: { gte, lte }` |
| "the videos" / "the PDFs" | `type` — but only if they asked; detection is lossy and will miss matches |
| "ones I starred" | `is_favorite: true` |
| "the untagged ones" | `is_tagged: false` |

Leave `sort` alone unless the user wants oldest-first (`created_asc`) or a random sample (`random`) — the default already sorts by relevance for a semantic search.

## Step 3 — Present results

Show the top 10: title, URL, collection, and tags where there are any. Link the title rather than printing a bare URL.

Semantic results are **candidates**, not exact matches — if the top hits look loosely related, say so rather than presenting them as certain.

If nothing comes back, don't just report zero. Say which filters were applied and offer the specific loosening that would help — dropping the collection filter, widening the date range, or searching without the tag.
