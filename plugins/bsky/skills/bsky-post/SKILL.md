---
name: bsky-post
description: "Compose and publish a post, reply, or thread to Bluesky, always previewing the exact text and asking for confirmation before it goes live. Use this when the user asks to post, reply, or share something on Bluesky, or to post a thread."
---

## Step 1 — Compose

Draft the post text from the user's request. Bluesky posts are capped at 300
graphemes — if the draft runs over, trim it or ask the user which parts to
cut rather than truncating silently.

If the user wants a reply, use `thread` first to fetch the target post and
confirm you're replying to the right one. If the user wants a multi-post
thread, split the content into an ordered list of posts instead of one long
one.

## Step 2 — Preview and confirm

Show the exact text (or, for a thread, each post in order) as a draft
preview and ask the user to confirm before publishing. Never call a write
tool until the user has explicitly confirmed — treat this as a hard gate,
not a formality.

## Step 3 — Publish

Once confirmed, call the matching tool with `confirm: true`:

- `post` — a standalone post
- `reply` — a reply to a specific post (pass the target post's URI/CID from `thread`)
- `thread_post` — a self-thread, each post replying to the previous one

## Step 4 — Report

Return the published post's URL (or the first post's URL for a thread) so
the user can open it directly.
