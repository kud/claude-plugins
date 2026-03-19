---
name: trakt-checkin
description: "Checks you in to a movie or TV episode on Trakt — marks it as currently watching. Use this when you sit down to watch something and want to track it."
---

## Step 1 — Resolve what to check in to

If the user provided a title (e.g. `/trakt-checkin Severance S02E01`), parse it:

- If it looks like a show + episode (`S01E02` or `season 1 episode 2`), treat it as an episode check-in
- Otherwise treat it as a movie check-in

If no title was given, ask: "What are you watching? (movie title or show + episode)"

## Step 2 — Search for the item

Call `search` with the title to find the Trakt ID. If multiple results come back, present the top 3 and ask the user to confirm which one.

## Step 3 — Check in

Call `checkin_movie` or `checkin_episode` with the resolved Trakt ID.

## Step 4 — Confirm

Present a confirmation:

```
✅ Checked in: **<Title>** (<year>)
   <Episode title if applicable>
   Tracked on Trakt.
```

If the check-in fails because another item is already active, offer to override it.
