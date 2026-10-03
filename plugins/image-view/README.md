# image-view

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that shows thumbnails of the images you paste, in the band above the prompt, instead of bare `[Image #1]` tags.

It draws real pixels in terminals that speak the kitty graphics protocol, and falls back to half-block thumbnails in any other truecolour terminal.

## How it draws

| Terminal                                                        | Element  | What you see                                                       |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| kitty (`TERM=xterm-kitty`), Ghostty                             | `Image`  | the picture itself, at full resolution, out of the box             |
| iTerm2 3.6+ or nightly (kitty graphics), with the setting below | `Image`  | the picture itself, at full resolution                             |
| everything else (iTerm2 without the setting, WezTerm, tmux…)    | `Raster` | a half-block thumbnail: `▀` per cell, two truecolour pixels a cell |

### iTerm2: turn on real pixels

iTerm2 draws kitty graphics from 3.6 (and the nightly builds), but Claude Code cannot detect it, so tell it to. Set `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` in the environment Claude Code starts from:

```sh
export CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1
```

or in the `env` block of Claude Code's settings (`~/.claude/settings.json`):

```json
{
  "env": {
    "CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1"
  }
}
```

Without it, iTerm2 gets the `Raster` thumbnails. kitty and Ghostty need nothing.

### The `Raster` fallback

For the `Raster` path the pasted PNG is scaled with macOS `sips` to exactly the tile's pixel size (columns × rows × 2), written as an uncompressed BMP beside Claude Code's own copy of the paste, read back, turned into cells, and the temporary file removed. Nothing leaves the machine. Decoded tiles are cached per image and size, so resizing the terminal decodes once per new size.

Off macOS, where there is no `sips`, the tile reads `no preview`.

## Behaviour

- Thumbnails appear as soon as you paste (the draft is polled every 200 ms, since a paste raises no edit event).
- Tiles are sized from the band: a lone picture can use the full width, up to 20 rows tall, with its aspect ratio kept; the row of tiles always fits the band, shrinking before it would scroll.
- An `Image` tile is sized for the real shape of a terminal cell, so the picture fills its border with no empty bands. The mod API does not report cell pixels, so it assumes a cell 2.3 times as tall as it is wide (iTerm2, kitty and Ghostty at common fonts). If your font leaves thin bands, set `IMAGE_VIEW_CELL_ASPECT` (1 to 4) to your cell's height over its width: higher removes bands above and below, lower removes them at the sides.
- Each tile has a rounded dim border and its `#n` label underneath.
- Sending the prompt clears the band.

## Try it for one session

```
claude --plugin-dir /path/to/claude-plugins/plugins/image-view
```

Needs Claude Code 2.1.287 or later.

## Credit

Adapted from [jarrodwatts/claude-image-view](https://github.com/jarrodwatts/claude-image-view) by Jarrod Watts (MIT): the prompt polling, the paste-folder lookup and the tile layout are his. The `Raster` fallback is new here. See [LICENSE](./LICENSE).
