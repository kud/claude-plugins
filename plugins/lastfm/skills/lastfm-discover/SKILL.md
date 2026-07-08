---
name: lastfm-discover
description: "Discover music similar to an artist you like — similar artists and their most popular tracks. Use this for 'find me something like X' or 'who sounds like X' requests."
---

## Step 1 — Resolve the artist

If the user named an artist (e.g. `/lastfm-discover Radiohead`), use it directly.

If no artist was given, ask: "Similar to which artist?"

## Step 2 — Fetch similar artists and top tracks

Fetch both in parallel:

- `get_similar_artists` with `artist` set to the resolved name and `limit: 8`
- `get_artist_top_tracks` with the same `artist` and `limit: 5` (to anchor the recommendation in what the seed artist is known for)

## Step 3 — Present the results

```
### Sounds like <artist>
1. <similar artist> (<match>% match)
2. …

### <artist>'s most popular tracks
1. <track>
2. …
```

Keep each section to what was fetched — don't pad with invented entries. If `get_similar_artists` comes back empty, say so plainly rather than falling back to the top tracks list alone.
