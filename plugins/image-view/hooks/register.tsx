import { atom, read, update } from "claude-code"
import type { EngineInterface, Register } from "claude-code"

import type { PastedImage } from "../types"
import { cellAspectOf, fitRow, imageLabel, imageNumbers, imageSourcesOf, pngSize } from "./layout"
import type { Size } from "./layout"
import {
  canDrawImages,
  cellsOf,
  elapsedSecondsOf,
  fromBase64,
  parseBmp,
} from "./raster"

// Pasting an image raises no prompt.edit (the tag only shows up on the next keystroke),
// so the draft is polled instead.
const POLL_MS = 200

const images = atom(
  { plugin: "image-view", key: "images" } as const,
  [] as PastedImage[],
)

let tmpRoot: string | undefined
let found: { sessionId: string; dir: string } | undefined
// The image numbers last drawn, so an unchanged draft doesn't rewrite state; undefined
// while a drawn image's file is still missing, so the next poll looks again.
let shownKey: string | undefined
let isChecking = false
const sizes = new Map<string, Size | null>()
// Whether the terminal draws `Image` itself; iTerm2 and friends get `Raster` tiles.
let canDraw = false
// The cell aspect an Image box is sized with (Raster tiles always use 2).
let imageCellAspect = cellAspectOf(undefined)
// Decoded Raster cells by `${path}|${columns}|${rows}`; null when undecodable.
const rasters = new Map<string, string | null>()
const decoding = new Set<string>()

// Claude Code caches each paste as <tmp>/<project>/<session>/images/<n>.png. The project
// folder is named after a working directory that may since have moved, so find it by the
// session id instead of rebuilding it.
async function imagesDir($: EngineInterface): Promise<string | undefined> {
  const sessionId = await $.session.id()
  if (found?.sessionId === sessionId) return found.dir
  if (tmpRoot === undefined) {
    const fromEnv = await $.env.get("CLAUDE_CODE_TMPDIR")
    tmpRoot =
      fromEnv ??
      `/tmp/claude-${(await $.process.run(["id", "-u"])).stdout.trim()}`
  }
  const entries = await $.fs.list(tmpRoot).catch(() => [])
  for (const entry of entries) {
    const dir = `${tmpRoot}/${entry.name}/${sessionId}/images`
    if (entry.kind === "dir" && (await $.fs.exists(dir))) {
      found = { sessionId, dir }
      return dir
    }
  }
  return undefined
}

async function sizeOf(
  $: EngineInterface,
  path: string,
): Promise<Size | null | undefined> {
  try {
    const { base64 } = await $.fs.read(path, { as: "bytes" })
    return pngSize(base64)
  } catch {
    // Too big to read: ask sips for the dimensions so the aspect ratio still holds.
  }
  try {
    const { exitCode, stdout } = await $.process.run([
      "sips",
      "-g",
      "pixelWidth",
      "-g",
      "pixelHeight",
      path,
    ])
    if (exitCode !== 0) return undefined
    const width = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1])
    const height = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1])
    if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return undefined
  }
}

async function describe(
  $: EngineInterface,
  dir: string | undefined,
  n: number,
): Promise<PastedImage> {
  const path = `${dir}/${n}.png`
  if (dir === undefined || !(await $.fs.exists(path)))
    return { n, path: null, size: null }
  if (!sizes.has(path)) {
    const size = await sizeOf($, path)
    if (size === null) return { n, path: null, size: null }
    sizes.set(path, size ?? null)
  }
  return { n, path, size: sizes.get(path) ?? null }
}

async function show($: EngineInterface, draft: string) {
  const numbers = imageNumbers(draft)
  const key = numbers.join(",")
  if (key === shownKey) return
  // An emptied draft always clears the band on the next poll: the sent images
  // live on in the transcript, so nothing is kept above the prompt. Clearing
  // resets the key to the empty draft, so a later paste draws again.
  const dir = numbers.length > 0 ? await imagesDir($) : undefined
  const list: PastedImage[] = []
  for (const n of numbers) list.push(await describe($, dir, n))
  const sources = imageSourcesOf(draft)
  list.forEach((image, i) => {
    if (i < sources.length) image.source = sources[i]
  })
  shownKey = list.every((image) => image.path !== null) ? key : undefined
  forgetRastersOtherThan(list)
  await update($, images, () => list)
}

function forgetRastersOtherThan(list: readonly PastedImage[]) {
  const kept = new Set(list.map((image) => image.path))
  for (const key of rasters.keys()) {
    if (!kept.has(key.slice(0, key.indexOf("|")))) rasters.delete(key)
  }
}

async function check($: EngineInterface) {
  if (isChecking) return
  isChecking = true
  try {
    await show($, (await $.prompt.read()).text)
  } finally {
    isChecking = false
  }
}

function bmpPathOf(path: string, columns: number, rows: number): string {
  const slash = path.lastIndexOf("/")
  const dir = slash < 0 ? "." : path.slice(0, slash)
  const base = slash < 0 ? path : path.slice(slash + 1)
  const n = base.endsWith(".png") ? base.slice(0, -4) : base
  return `${dir}/.image-view-${n}-${columns}x${rows}.bmp`
}

async function decode(
  $: EngineInterface,
  path: string,
  columns: number,
  rows: number,
): Promise<void> {
  const key = `${path}|${columns}|${rows}`
  if (rasters.has(key) || decoding.has(key)) return
  decoding.add(key)
  try {
    const bmpPath = bmpPathOf(path, columns, rows)
    const { exitCode } = await $.process.run([
      "sips",
      "-z",
      String(rows * 2),
      String(columns),
      "-s",
      "format",
      "bmp",
      path,
      "--out",
      bmpPath,
    ])
    if (exitCode !== 0) {
      rasters.set(key, null)
      return
    }
    let parsed: { width: number; height: number; rgba: Uint8Array } | null =
      null
    try {
      const { base64 } = await $.fs.read(bmpPath, { as: "bytes" })
      parsed = parseBmp(fromBase64(base64))
    } catch {
      parsed = null
    }
    try {
      await $.process.run(["rm", "-f", bmpPath])
    } catch {
      // The thumbnail is decoded; a leftover temp file is harmless.
    }
    // A Raster whose cells do not match its box is refused, so a size sips did not honour is no preview.
    const fits =
      parsed !== null &&
      parsed.width === columns &&
      Math.ceil(parsed.height / 2) === rows
    rasters.set(
      key,
      fits && parsed ? cellsOf(parsed.rgba, parsed.width, parsed.height) : null,
    )
  } catch {
    rasters.set(key, null)
  } finally {
    decoding.delete(key)
    $.ui.invalidate("ui.render")
  }
}

// Claude Code decides whether the terminal draws pictures once, as it starts. A force
// override written to a settings file after that reaches `$.env` on the next reload but
// not Claude Code, whose `Image` then shows only its alt; such an override is ignored.
async function isForceAddedAfterStart(
  $: EngineInterface,
  cwd: string,
): Promise<boolean> {
  try {
    const configDir =
      (await $.env.get("CLAUDE_CONFIG_DIR")) ??
      `${await $.env.get("HOME")}/.claude`
    const files = {
      user: `${configDir}/settings.json`,
      project: `${cwd}/.claude/settings.json`,
      local: `${cwd}/.claude/settings.local.json`,
    } as const
    const holders: string[] = []
    for (const source of ["user", "project", "local"] as const) {
      const { env } = await $.settings.read({ source })
      if (
        typeof env === "object" &&
        env !== null &&
        "CLAUDE_CODE_FORCE_TERMINAL_IMAGES" in env
      )
        holders.push(files[source])
    }
    if (holders.length === 0) return false
    const { exitCode, stdout } = await $.process.run([
      "sh",
      "-c",
      "ps -o etime= -p $PPID",
    ])
    const elapsed = exitCode === 0 ? elapsedSecondsOf(stdout) : undefined
    if (elapsed === undefined) return false
    const startedAt = (await $.clock.now()) - (elapsed + 1) * 1000
    for (const path of holders) {
      const stat = await $.fs.stat(path).catch(() => undefined)
      if (stat !== undefined && stat.mtimeMs > startedAt) return true
    }
    return false
  } catch {
    return false
  }
}

// A transcript row never pushes the history far: its tiles fit this many rows whole.
const TRANSCRIPT_MAX_ROWS = 12
const TRANSCRIPT_FALLBACK_COLUMNS = 80

type Tiles = {
  Box: any
  Text: any
  Image: any
  Raster: any
}

function rasterFor(
  $: EngineInterface,
  ui: Tiles,
  path: string,
  columns: number,
  rows: number,
  n: number,
) {
  const { Box, Text, Raster } = ui
  const cached = rasters.get(`${path}|${columns}|${rows}`)
  if (typeof cached === "string") {
    return (
      <Raster
        key={`image-${n}`}
        columns={columns}
        rows={rows}
        cells={cached}
      />
    )
  }
  if (cached === null) {
    return (
      <Box
        width={columns}
        height={rows}
        alignItems="center"
        justifyContent="center"
      >
        <Text dimColor wrap="truncate">
          no preview
        </Text>
      </Box>
    )
  }
  void decode($, path, columns, rows)
  return (
    <Box
      width={columns}
      height={rows}
      alignItems="center"
      justifyContent="center"
    >
      <Text dimColor wrap="truncate">
        …
      </Text>
    </Box>
  )
}

// One bordered tile with its picture and file-name label, shared by the band
// above the prompt and the transcript rows.
function tileFor(
  $: EngineInterface,
  ui: Tiles,
  image: PastedImage,
  columns: number,
  rows: number,
) {
  const { Box, Text, Image } = ui
  return (
    <Box
      key={`image-${image.n}`}
      flexDirection="column"
      alignItems="center"
      borderStyle="round"
      borderColor="inactive"
      paddingX={1}
    >
      {image.path === null ? (
        <Box
          width={columns}
          height={rows}
          alignItems="center"
          justifyContent="center"
        >
          <Text dimColor wrap="truncate">
            no preview
          </Text>
        </Box>
      ) : canDraw ? (
        <Image
          key={`image-${image.n}`}
          source={{ file: image.path, format: "png" }}
          columns={columns}
          rows={rows}
          alt=" "
        />
      ) : (
        rasterFor($, ui, image.path, columns, rows, image.n)
      )}
      <Text color="text" bold wrap="truncate">
        {imageLabel(image, columns + 2)}
      </Text>
    </Box>
  )
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const [term, termProgram, forceImages, cellAspect] = await Promise.all([
      $.env.get("TERM"),
      $.env.get("TERM_PROGRAM"),
      $.env.get("CLAUDE_CODE_FORCE_TERMINAL_IMAGES"),
      $.env.get("IMAGE_VIEW_CELL_ASPECT"),
    ])
    const isForceUnseen =
      forceImages !== undefined && (await isForceAddedAfterStart($, e.cwd))
    canDraw = canDrawImages({
      TERM: term ?? undefined,
      TERM_PROGRAM: termProgram ?? undefined,
      CLAUDE_CODE_FORCE_TERMINAL_IMAGES: isForceUnseen
        ? undefined
        : (forceImages ?? undefined),
    })
    imageCellAspect = cellAspectOf(cellAspect ?? undefined)
    $.clock.every(POLL_MS, () => check($))
    return next(e)
  })

  on("turn.complete", async ($, e, next) => {
    try {
      shownKey = undefined
      await update($, images, () => [])
    } catch {
      // The band clears on the next poll; never block the turn.
    }
    $.ui.invalidate("ui.render")
    return next(e)
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.surface !== "terminal" || e.props.hasSurvey) return next(e)
    const list = await read($, images)
    if (list.length === 0) return next(e)

    const ui = $.ui.resolve(e)
    const { Box } = ui
    const cells = fitRow(
      list.map((image) => image.size),
      e.props.maxRows,
      e.props.bodyColumns,
      canDraw ? imageCellAspect : undefined,
    )
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          {list.map((image, i) => {
            const { columns, rows } = cells[i] ?? { columns: 4, rows: 1 }
            return tileFor($, ui, image, columns, rows)
          })}
        </Box>
        {below}
      </Box>
    )
  })

  on("ui.render", { component: "UserMessage" }, async ($, e, next) => {
    try {
      const event = e as unknown as {
        surface?: unknown
        viewport?: { columns?: unknown }
        props?: {
          text?: unknown
          origin?: unknown
          isExpanded?: unknown
          onScreen?: unknown
        }
      }
      if (event.surface !== "terminal") return next(e)
      const props = event.props
      if (typeof props?.text !== "string") return next(e)
      // Only the composer's own rows carry pasted images; other origins keep
      // the engine's rendering, as do rows the engine reports as off-screen.
      // `origin` itself is never modified.
      const origin = props.origin as { kind?: unknown } | null | undefined
      if (
        origin !== undefined &&
        origin !== null &&
        typeof origin === "object" &&
        "kind" in origin &&
        origin.kind !== "composer"
      )
        return next(e)
      // A collapsed row stays a single line of tags; a row drawn outside the
      // viewport (`onScreen` null) keeps the engine's rendering, so long
      // transcripts stay cheap. Where the surface says nothing (`onScreen`
      // absent), the row draws.
      if (props.isExpanded === false) return next(e)
      if (props.onScreen === null) return next(e)
      const numbers = imageNumbers(props.text)
      if (numbers.length === 0) return next(e)
      // The band's polled state is gone by the time older rows render, so each
      // number resolves to the session's cached paste exactly as the band does.
      // Decoded tiles come from the same cache, so redrawing is cheap.
      const dir = await imagesDir($)
      const list: PastedImage[] = []
      for (const n of numbers) list.push(await describe($, dir, n))
      if (!list.some((image) => image.path !== null)) return next(e)
      const sources = imageSourcesOf(props.text)
      list.forEach((image, i) => {
        if (i < sources.length) image.source = sources[i]
      })

      const ui = $.ui.resolve(e)
      const { Box } = ui
      const viewportColumns = event.viewport?.columns
      const bodyColumns =
        typeof viewportColumns === "number" && Number.isFinite(viewportColumns)
          ? viewportColumns
          : TRANSCRIPT_FALLBACK_COLUMNS
      const cells = fitRow(
        list.map((image) => image.size),
        TRANSCRIPT_MAX_ROWS,
        bodyColumns,
        canDraw ? imageCellAspect : undefined,
      )
      const message = await next(e)

      return (
        <Box flexDirection="column">
          {message}
          <Box flexDirection="row" columnGap={1}>
            {list.map((image, i) => {
              const { columns, rows } = cells[i] ?? { columns: 4, rows: 1 }
              return tileFor($, ui, image, columns, rows)
            })}
          </Box>
        </Box>
      )
    } catch {
      // The message text always survives: failures keep the engine's rendering.
      return next(e)
    }
  })
}
