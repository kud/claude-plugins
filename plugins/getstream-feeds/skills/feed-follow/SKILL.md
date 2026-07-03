---
name: feed-follow
description: "Manages GetStream feed subscriptions — follow or unfollow one feed from another. Use this to repair missing fan-out or clean up stale subscriptions."
---

## Step 1 — Resolve the action, source, and target

If the user provided all three inline (e.g. `/feed-follow notification:user-123 follows timeline:post-456` or `/feed-follow unfollow notification:user-123 timeline:post-456`), parse directly:

- Detect the action from keywords: `follow` / `follows` → FOLLOW, `unfollow` → UNFOLLOW.
- Source feed: the feed that will follow or unfollow.
- Target feed: the feed being followed or unfollowed.

If any of action, source, or target is missing, ask for the missing pieces:

- "What action? (follow / unfollow)"
- "Which source feed? (e.g. notification:user-123)"
- "Which target feed? (e.g. timeline:post-456)"

## Step 2 — Confirm before writing

Show a summary of the pending change:

```
Action:  FOLLOW / UNFOLLOW
Source:  <source-feed>
Target:  <target-feed>
```

Ask: "Confirm? (yes/no)"

If no, stop.

## Step 3 — Execute

- If FOLLOW: call `getstream_feed_follow` with the source feed, target feed, and `confirm: true`.
- If UNFOLLOW: call `getstream_feed_unfollow` with the source feed, target feed, and `confirm: true`.

## Step 4 — Confirm result

Report the outcome:

```
✅ notification:user-123 now follows timeline:post-456
```

or

```
✅ notification:user-123 unfollowed timeline:post-456
```

If the call fails, report the error clearly and do not retry automatically.
