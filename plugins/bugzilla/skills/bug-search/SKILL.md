---
name: bug-search
description: "Search Firefox/Mozilla bugs by product, component, status, severity, or free-text query. Use this to find bugs matching a topic, component, or keyword."
---

## Step 1 — Resolve the search criteria

If the user gave a free-text phrase (e.g. `/bug-search crash on startup`), treat it
as a `quicksearch` query — Bugzilla's quicksearch syntax already understands
product/component shorthand, status keywords, and free text combined.

If the user gave structured filters instead (product, component, status,
severity, assignee, keywords), collect whichever were provided. Don't ask for
filters that weren't mentioned — an empty filter is a valid "show me
everything open" search.

If nothing at all was given, ask: "What are you looking for — a keyword, a
product/component, or a specific status?"

## Step 2 — Search

Call `search_bugs` with the resolved criteria:

- Free-text phrase → pass it as `quicksearch`.
- Structured filters → pass `product`, `component`, `status`, `severity`,
  `assignee`, and/or `keywords` as given.
- If the user didn't mention status, default to open bugs (`UNCONFIRMED`,
  `NEW`, `ASSIGNED`, `REOPENED`) rather than including closed ones.

If the product or component name is ambiguous or the search returns nothing,
call `get_products` (and `get_product` for the closest match) to confirm the
correct spelling before retrying once.

## Step 3 — Present results

List up to 15 matches, most recently modified first if that ordering is
available:

```
### Bugs matching "<query/filters>"

| ID | Status | Severity | Summary |
| -- | ------ | -------- | ------- |
| 1234567 | NEW | S2 | <summary> |
```

If there are more than 15 matches, say how many total and offer to narrow the
search (by component, severity, or a tighter keyword) or show the next page.

If the user wants more detail on a specific bug, call `get_bug` for the full
record and `get_comments` for its discussion, then summarise both.
