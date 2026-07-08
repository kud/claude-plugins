---
name: lastfm-recommend
description: "Recommend music to listen to, grounded in your Last.fm listening history and loved tracks. Works from a free-text mood, a seed artist/track, or your recent taste. Triggers on: 'what should I listen to', 'recommend an album/artist', 'find me something like X', 'music for <vibe>', '/lastfm-recommend <vibe or seed>'."
---

Recommend music grounded in real Last.fm data — the user's own taste graph plus Last.fm's similarity and tag data. This is a discovery skill: read their taste, reason over it, then anchor every pick in something a tool actually returned.

## Step 1 — Establish the seed

Work out what anchors the recommendation, in this order:

- **Explicit seed** — an artist, track, or tag/genre the user named.
- **A stated vibe** — a mood, activity, or era ("something for deep focus", "rainy Sunday jazz", "90s shoegaze"). Map it to one or two Last.fm tags.
- **Their taste** — if they give no anchor at all ("what should I listen to?"), lean on Step 2 alone.

## Step 2 — Gather taste context (parallel)

Fetch in parallel to ground the picks in what they already listen to. With `MCP_LASTFM_USERNAME` configured, omit the `user` argument — these resolve to their own account:

- `get_user_top_artists` with `period: "3month"` — their current rotation, the strongest recent signal.
- `get_user_loved_tracks` — explicitly loved tracks, the highest-intent taste signal.
- `get_user_top_tracks` with `period: "overall"` — long-run favourites for grounding.

Keep it light — you're sampling taste, not auditing the whole history. If a call errors because no username is set, ask for one rather than guessing.

## Step 3 — Expand via Last.fm's similarity graph (parallel)

From the seed and the taste context, pull real neighbours rather than inventing them:

- Seed or top artist → `get_similar_artists` (limit 8) — the backbone of the recommendation.
- Seed or loved track → `get_similar_tracks` (limit 8) — track-level discovery.
- Vibe or tag → `get_tag_top_artists` / `get_tag_top_tracks` on the mapped tag.

Favour **discovery** — lean away from artists already in their top/loved lists unless they explicitly asked for deep cuts or more of a known favourite.

## Step 4 — Present

Rank by fit and keep it scannable — 5 picks unless they ask for more:

```
### For <seed / vibe>

1. **<Artist — Track/Album>** · <tag/genre>
   <one line: why it fits, tied to their taste or the seed — cite the similarity match or shared tag>
2. …
```

Every pick must trace back to something a tool returned — a similar-artist match, a similar track, a tag top-list. Don't pad with invented entries; if the graph came back thin, say so plainly rather than filling the gap.

## Step 5 — Offer a next step

End with a single offer, not a menu: open the top pick's Last.fm page (every result carries a `url`), or dig deeper on one artist (`get_artist` for bio and tags, `get_artist_top_tracks` for where to start). This server is read-only — no scrobbling, loving, or playlist writes.
