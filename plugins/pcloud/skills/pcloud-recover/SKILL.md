---
name: pcloud-recover
description: "Find a lost or deleted pCloud file and restore it — from trash or by rewinding to an older version. Use this when a file was accidentally deleted, overwritten, or corrupted and needs to come back."
---

## Step 1 — Understand what's lost

Ask (or infer from the request) what happened to the file:

- **Deleted** — it was removed and needs restoring from trash.
- **Overwritten / corrupted / wrong content** — the file still exists but an
  older, good version is needed.

If it's unclear which, check both in parallel in Step 2.

## Step 2 — Find the candidates

Depending on the case from Step 1:

- **Deleted** — call `list_trash` and filter for files matching the name or
  path the user gave. Note each candidate's file ID, original path, and
  deletion date.
- **Wrong/old content** — call `get_file_stat` to confirm the file's current
  path, then `list_rewind_events` (for point-in-time snapshots) and
  `list_revisions` (for saved revisions) on that path. Note each candidate's
  timestamp/revision ID and size.

If nothing matches, widen the search with `list_folder` on the parent
directory to check for a rename or a different location, then retry.

## Step 3 — Present the options

Show the user a short list of candidates, newest first, with enough detail to
tell them apart:

```
1. <path> — deleted <date> (trash)
2. <path> — revision from <date>, <size>
3. <path> — rewind snapshot from <date>
```

Ask which one to restore. If there's exactly one unambiguous candidate,
propose it directly rather than making the user pick from a list of one.

## Step 4 — Confirm before restoring

Restoring can overwrite the current file or create a new one at the target
path. Before calling any restore tool, state plainly what will happen and
ask for explicit confirmation:

```
Restore <path> to its state from <date> using <trash | rewind | revision>?
This will <overwrite the current file at <path> | create a new file at <path>>.
```

Do not proceed without a clear yes.

## Step 5 — Restore and verify

Once confirmed, call the matching tool:

- Trash → `restore_from_trash`
- Rewind snapshot → `restore_from_rewind`
- Revision → `revert_revision`

Then call `get_file_stat` on the resulting path to confirm the restore
succeeded, and report back the final path and timestamp to the user.
