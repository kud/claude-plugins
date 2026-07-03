---
name: feed-inspect
description: "Read-only debug view of a GetStream feed — shows recent activities, what the feed follows, and who follows it. Use this to diagnose fan-out issues such as missing notifications."
---

## Step 1 — Resolve the feed

If the user provided a feed (e.g. `/feed-inspect notification:user-123`), use it directly.

If no feed was given, ask: "Which feed do you want to inspect? (e.g. notification:user-123)"

## Step 2 — Fetch all three data sources in parallel

Call these three tools simultaneously:

- `getstream_feed_activities` — recent activities on the feed
- `getstream_feed_following` — what this feed currently follows
- `getstream_feed_followers` — who follows this feed

## Step 3 — Present the report

Structure the output in three sections:

```
### Feed: <feed-type>:<feed-id>

#### Activities

<list recent activities — actor, verb, object, timestamp — or "No recent activities">

#### Following

<list feeds this feed follows — or "Not following anything">

#### Followers

<list feeds that follow this feed — or "No followers">
```

If the user mentioned a specific activity they expected to appear and it is absent, note which step in the fan-out chain may be broken — e.g. the source feed is not followed, or the activity was never posted to the source.
