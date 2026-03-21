---
name: bookmark-search
description: "Searches your Raindrop.io bookmarks by keyword, tag, or collection. Use this to find a saved link."
---

## Step 1 — Resolve the query

If the user provided a query (e.g. `/bookmark-search react hooks`), use it directly.

If no query was given, ask: "What are you looking for?"

## Step 2 — Search

Call `search_raindrops` with the query.

## Step 3 — Present results

Show title, URL, and collection for each result. Limit to the top 10.

If no results are found, say so and suggest broadening the query.
