---
name: photo-search
description: "Find a freely-licensed Unsplash photo from a plain description. Use when the user wants an image of something — 'find me a photo of a foggy forest', 'a photo for my blog header about coffee'."
---

## Step 1 — Search

Call `search_photos` with the user's description as `query`. If the user hints at a shape (banner, header, wallpaper, avatar), map it to `orientation`:

- banner / header / hero / wallpaper → `landscape`
- portrait / phone / story → `portrait`
- avatar / icon / tile → `squarish`

Request `per_page: 8` so there's a spread to choose from. If the user asks for "the most recent" rather than the best match, pass `order_by: latest`.

If `search_photos` returns nothing, retry once with a broader `query` (drop the most specific adjective), then fall back to `random_photo` with the same query.

## Step 2 — Present the results

Show up to 5 candidates as a compact list — never dump the raw payload:

```
1. <description or alt_description> — <author name>
   <regular url>
2. …
```

Lead with the single best match for the user's intent. Keep it to 5 unless they ask for more.

## Step 3 — On selection

When the user picks one, call `get_photo` with its `id` to return full metadata (this also fires Unsplash's required download-tracking ping). Then remind them of the attribution rule:

> Credit the photographer — link to their Unsplash profile (`author.profile`) near where you use the image.

Never rehost the file; use the returned Unsplash URLs directly.
