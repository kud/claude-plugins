---
name: bsky-timeline
description: "Shows your Bluesky home timeline and recent notifications. Use this to catch up on what's happening on Bluesky, see what people are posting, or check recent likes, reposts, replies, and follows."
---

## Step 1 — Fetch the data

Fetch in parallel:

- `timeline` for the authenticated user's home timeline
- `notifications` for recent notifications

## Step 2 — Present the overview

Structure your response as:

```
### Timeline
<up to 8 recent posts — author, text snippet, and engagement counts>

### Notifications
<up to 5 recent notifications — likes, reposts, replies, and follows>
```

Keep it concise — no more than the counts above unless the user asks for
more. If a post references a thread the user seems interested in, offer to
fetch it with `thread` for the full context.
