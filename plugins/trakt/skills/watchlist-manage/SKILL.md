---
name: watchlist-manage
description: "Add or remove movies and shows from your Trakt watchlist. Use this to manage what you plan to watch next."
---

## Step 1 — Resolve the action and item

If the user provided a title and action (e.g. `/watchlist-manage add Dune` or `/watchlist-manage remove Severance`), use them directly.

If no action was given, ask: "Do you want to add or remove something from your watchlist?"

If no title was given, ask: "What movie or show?"

## Step 2 — Search for the item

Call `search` with the title. If multiple results are returned, show the top 3 with year and type (movie/show) and ask the user to pick one.

## Step 3 — Confirm

Show the user what will happen:

```
Action:  ADD to watchlist
Title:   Dune: Part Two (2024)
Type:    Movie
```

Ask: "Confirm? (yes/no)"

If no, stop.

## Step 4 — Execute

- If adding: call `add_to_watchlist` with the selected item.
- If removing: call `remove_from_watchlist` with the selected item.

## Step 5 — Confirm result

```
✅ Added "Dune: Part Two" to your watchlist.
```

or

```
✅ Removed "Severance" from your watchlist.
```
