---
name: bookmark-save
description: "Saves a URL to Raindrop.io with optional tags and collection. Use this to bookmark a link."
---

## Step 1 — Resolve the URL

If the user provided a URL (e.g. `/bookmark-save https://example.com`), use it directly.

If no URL was given, ask: "What URL would you like to save?"

## Step 2 — Save

Call `create_raindrop` with the URL. Include any tags or collection the user specified.

Do not ask for tags or a collection if the user didn't provide them — Raindrop auto-detects the title and type.

## Step 3 — Confirm

Confirm the saved bookmark:

```
✓ Saved: <title> — <url>
```
