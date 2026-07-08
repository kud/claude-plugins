---
name: lastfm-recent
description: "Shows a Last.fm user's recent scrobbles, including what's currently playing. Use this to check listening history or what someone's playing right now."
---

## Step 1 — Resolve the username

If the user gave a Last.fm username (e.g. `/lastfm-recent kud`), use it directly.

If no username was given, ask: "Whose Last.fm history — what's the username?"

## Step 2 — Fetch recent tracks

Call `get_user_recent_tracks` with `user` set to the resolved username and `limit: 10`.

## Step 3 — Present the results

If the first track carries `@attr.nowplaying`, lead with it separately:

```
▶ Now playing: <track> — <artist>

### Recently played
1. <track> — <artist> (<relative time>)
2. …
```

Keep it to 10 tracks unless the user asks for more history.
