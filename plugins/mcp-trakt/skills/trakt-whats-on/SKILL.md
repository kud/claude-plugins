---
name: trakt-whats-on
description: "Shows what's currently in your Trakt watchlist, what you've been watching recently, and what's up next in your shows. Use this for a quick 'what should I watch tonight?' summary."
---

## Step 1 — Fetch your watching context

Run these in parallel:

- Call `get_watchlist` (type: `movies`) to get movies you've saved to watch
- Call `get_watchlist` (type: `shows`) to get shows in your watchlist
- Call `get_history` (limit: 5) to get your most recently watched items

## Step 2 — Find next episodes (optional)

For the top 3 shows in your watchlist, call `get_show_progress` or `get_next_episode` to find which episode you'd watch next.

## Step 3 — Present the summary

Structure the output as:

```
### What's On 🎬

#### Up Next (Shows)
- **<Show Name>** — S<X>E<Y>: <Episode Title>
- ...

#### Movies to Watch
- **<Movie Title>** (<year>) — <tagline or genre>
- ...

#### Recently Watched
- <Title> — watched <relative time>
- ...
```

Keep it scannable — no more than 5 items per section.

## Step 4 — Offer to check in (optional)

Ask: "Want to check in to something, or get recommendations?"
