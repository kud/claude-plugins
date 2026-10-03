# image-view

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that shows thumbnails of the images you paste, in the band above the prompt, instead of bare `[Image #1]` tags.

It works in **iTerm2** and any truecolour terminal, not only the ones that speak the kitty graphics protocol.

## How it draws

| Terminal                                 | Element  | What you see                                                       |
| ---------------------------------------- | -------- | ------------------------------------------------------------------ |
| kitty (`TERM=xterm-kitty`), Ghostty      | `Image`  | the picture itself, at full resolution                             |
| everything else (iTerm2, WezTerm, tmux…) | `Raster` | a half-block thumbnail: `▀` per cell, two truecolour pixels a cell |

For the `Raster` path the pasted PNG is scaled with macOS `sips` to exactly the tile's pixel size (columns × rows × 2), written as an uncompressed BMP beside Claude Code's own copy of the paste, read back, turned into cells, and the temporary file removed. Nothing leaves the machine. Decoded tiles are cached per image and size, so resizing the terminal decodes once per new size.

Off macOS, where there is no `sips`, the tile reads `no preview`.

## Behaviour

- Thumbnails appear as soon as you paste (the draft is polled every 200 ms, since a paste raises no edit event).
- Tiles are sized from the band: a lone picture can use the full width, up to 20 rows tall, with its aspect ratio kept; the row of tiles always fits the band, shrinking before it would scroll.
- Each tile has a rounded dim border and its `#n` label underneath.
- Sending the prompt clears the band.

## Full size

Under each tile is `1: full size` (the digit is the image number). To open the picture at full resolution:

- **click** it, or
- press **ctrl+x tab** to move the focus to the band, then the image's **number** (1 to 9; images from #10 are click-only). Esc returns to the prompt.

Digits are never taken from the prompt while you type, and a press only acts while the draft still holds that image's `[Image #n]` tag. Claude Code's mod API has no free modifier chord (such as ⌥1) to bind, which is why the focus step is there.

What opens:

| Where you run Claude Code                                 | What happens                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| iTerm2 (`TERM_PROGRAM=iTerm.app` or `LC_TERMINAL=iTerm2`) | the session is split vertically (the new pane about 40% wide) and runs `imgcat` on the image; press any key there to close the pane |
| iTerm2 without `imgcat`                                   | the same pane prints iTerm2's inline-image escape (OSC 1337) itself                                                                 |
| anywhere else, or if the split fails                      | Quick Look (`qlmanage -p`), in the background                                                                                       |

The image is Claude Code's own cached copy of the paste, never the thumbnail. The split is driven by AppleScript through `osascript`, so macOS may ask once to let your terminal control iTerm2. `imgcat` is looked up in iTerm2's app bundle, `~/.iterm2/` (shell integration), then `PATH`.

## Try it for one session

```
claude --plugin-dir /path/to/claude-plugins/plugins/image-view
```

Needs Claude Code 2.1.287 or later.

## Credit

Adapted from [jarrodwatts/claude-image-view](https://github.com/jarrodwatts/claude-image-view) by Jarrod Watts (MIT): the prompt polling, the paste-folder lookup and the tile layout are his. The `Raster` fallback is new here. See [LICENSE](./LICENSE).
