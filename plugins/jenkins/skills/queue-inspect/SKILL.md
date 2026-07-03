---
name: queue-inspect
description: "Shows what is currently in the Jenkins build queue and lets you cancel queued items. Use this when builds are stuck waiting or you want to drain the queue."
---

## Step 1 — Fetch the queue

Call `get_queue` to retrieve all currently queued build items.

## Step 2 — Present the queue

If the queue is empty, say: "Jenkins queue is empty." and stop.

Otherwise display:

```
### Jenkins Build Queue (<N> items)

| # | Job | Waiting | Reason |
|---|-----|---------|--------|
| 1 | my-service | 3m 12s | Build #45 is already running |
| 2 | other-job  | 1m 05s | Waiting for executor |
```

## Step 3 — Offer to cancel (optional)

Ask: "Would you like to cancel any of these? Provide the item number(s), or press enter to skip."

If the user provides item numbers, call `cancel_queue` for each one.

Confirm each cancellation:

```
✅ Cancelled: my-service (queue item #1)
```
