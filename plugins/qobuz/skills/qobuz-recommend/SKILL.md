---
name: qobuz-recommend
description: "Recommend music to listen to on Qobuz from a free-text mood, a seed artist/album/track, or what's playing now. Uses your Qobuz favourites and playlists as taste context, then resolves each pick against the Qobuz catalogue. Triggers on: 'what should I listen to', 'recommend an album', 'find me something like X', 'music for <vibe>', '/qobuz-recommend <vibe or seed>'."
---

Recommend music the user can actually play on Qobuz. This is a discovery skill: read their taste, reason over it, then confirm every pick exists in the catalogue before presenting it.

## Step 1 — Establish the seed

Work out what anchors the recommendation, in this order:

- **Explicit seed** — an artist, album, track, or genre the user named.
- **A stated vibe** — a mood, activity, or era ("something for deep focus", "rainy Sunday jazz", "90s shoegaze").
- **What's on now** — if they say "more like this" or give no anchor at all, call `now-playing` and use the current track as the seed. On non-macOS hosts this returns an error — fall back to the taste signal in Step 2.

## Step 2 — Gather taste context (parallel)

Fetch in parallel to ground the picks in what they already love:

- `list-favourites` with type `artists` — the strongest signal.
- `list-favourites` with type `albums` — recurring labels, eras, production styles.
- `list-playlists` — themed listening they've curated (fetch a relevant one with `get-playlist` only if its title matches the request).

Keep this lightweight — you're sampling taste, not auditing the whole library.

## Step 3 — Reason, then resolve

1. Combine the seed, the taste context, and your own music knowledge to draft **5–8 candidate picks** (artists or albums). Favour **discovery** — lean away from artists already in their favourites unless they explicitly asked for deep cuts or more of a known favourite.
2. For each candidate, call `search` on Qobuz to confirm it exists and capture the real album/artist ID. **Drop anything the search doesn't return** — never recommend something not in the catalogue.
3. Note availability quality where it matters (e.g. Hi-Res) if the search surfaces it.

## Step 4 — Present

Rank by fit and keep it scannable — 5 picks unless they ask for more:

```
### For <seed / vibe>

1. **<Artist — Album>** · <year> · <genre>
   <one line: why it fits, tied to their taste or the seed>
2. …
```

End with a single offer, not a menu: ask whether to **open** the top pick in the Qobuz app (`open` via the CLI is out of scope here — link the album instead) or **build a playlist** from the set.

## Step 5 — Optional playlist (guarded)

Only if the user says yes:

- `create-playlist` with `confirm: true`, then `add-to-playlist` with the resolved track/album IDs and `confirm: true`.
- Never write without an explicit go-ahead — these tools are guarded for a reason.
