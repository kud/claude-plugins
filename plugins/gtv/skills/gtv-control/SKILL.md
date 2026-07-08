---
name: gtv-control
description: "Control a paired Google TV — launch an app, send a remote key or sequence of keys, type into a focused field, or check what's on. Use this for 'open Netflix on the TV', 'turn up the volume', 'go back to the home screen', 'type <search term> into the TV', or 'what's playing on the TV'."
---

## Step 1 — Resolve the target device

If more than one device might be paired, or the user names a specific TV,
call `gtv_list_devices` first and pick the match (or confirm with the user
if it's ambiguous). Otherwise skip straight to Step 2 and let the server use
its current device.

If the user names a device that isn't the current one, call `gtv_set_device`
with its host or name before doing anything else.

## Step 2 — Classify the request

- **Check what's on** → call `gtv_get_state` and report power, volume, and
  the foreground app.
- **Launch an app** → call `gtv_launch_app` with the app's catalog id
  (`netflix`, `youtube`, `primevideo`, `plex`, `putio`, `arte`, `disney`,
  `spotify`, `twitch`, `max`) or a raw deep-link URI if the user names
  something outside the catalog.
- **Navigate or control playback/volume/power** → call `gtv_send_key` with
  one of: `home`, `back`, `power`, `up`, `down`, `left`, `right`, `select`,
  `play`, `stop`, `next`, `prev`, `fwd`, `rwd`, `vol-up`, `vol-down`, `mute`,
  `menu`, `search`, `sleep`, `wakeup`, `input`, `enter`, `channel-up`,
  `channel-down`, `info`, `guide`, `settings`. For a sequence (e.g. "go
  home then open the search field"), send the keys one at a time in order.
- **Type text** (e.g. into a search field) → call `gtv_type_text` with the
  literal text. Send `search` first if a search field isn't already
  focused.

## Step 3 — Confirm the result

Every control tool returns the TV's resulting state. Read it back and tell
the user what actually happened — don't just assume the action landed:

- For `gtv_launch_app`, check the `confirmed` flag. If the store page opened
  instead of the app (a known limitation — the Play Store sometimes shows an
  "Open" button rather than auto-launching), send `select` via `gtv_send_key`
  to complete the launch, then re-check state.
- For power/volume keys, report the echoed state (on/off, new volume level).
- If a request needs menu or list navigation _inside_ an app (not just
  launching it), say so plainly — the server has no screen awareness beyond
  power, volume, and the foreground app, so reliable in-app navigation isn't
  possible.
