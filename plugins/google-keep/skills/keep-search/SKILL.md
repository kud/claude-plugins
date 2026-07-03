---
name: keep-search
description: "Search your Google Keep notes by text, label, or colour. Use this to find a note when you don't remember exactly where it is."
---

## Step 1 — Resolve the search query

If the user provided a query (e.g. `/keep-search recipe` or `/keep-search label:ideas`), parse it directly.

Supported query forms:

- Plain text: `/keep-search pasta recipe`
- By label: `/keep-search label:shopping`
- By colour: `/keep-search colour:red`

If no query was given, ask: "What are you looking for? You can search by text, label, or colour."

## Step 2 — Search notes

Call `list_notes` with the appropriate filters derived from the query.

## Step 3 — Present results

If no notes match, say: "No notes found matching '<query>'."

Otherwise display a concise list:

```
### Notes matching "<query>" (<N> found)

1. **<title or first line>** — <label(s) if any> — <colour if set>
   <first 80 characters of content>

2. ...
```

## Step 4 — Offer to open or act on a result (optional)

If there is only one result, ask if the user wants to see the full content.

If there are multiple results, ask: "Would you like to see the full content of any of these?"

Display the full note content if requested.
