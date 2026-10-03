import { describe, expect, mock, test } from "claude-code/testing"
import type { FoundElement, TestBody } from "claude-code/testing"

import { fitCells, fitRow, imageNumbers, pngSize } from "../hooks/layout"
import {
  canDrawImages,
  cellsOf,
  fromBase64,
  parseBmp,
  toBase64,
} from "../hooks/raster"

type Pixel = [r: number, g: number, b: number, a: number]

function pngHead(width: number, height: number): string {
  const bytes = new Uint8Array(33)
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
    0x44, 0x52,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return btoa(String.fromCharCode(...bytes))
}

/** A 32 bpp top-down BI_BITFIELDS BMP with a V3 header (alpha mask at 66). */
function bmp32TopDown(
  width: number,
  height: number,
  at: (x: number, y: number) => Pixel,
): string {
  const headerSize = 56
  const offset = 14 + headerSize + 4
  const bytes = new Uint8Array(offset + width * height * 4)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x42
  bytes[1] = 0x4d
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, offset, true)
  view.setUint32(14, headerSize, true)
  view.setInt32(18, width, true)
  view.setInt32(22, -height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 32, true)
  view.setUint32(30, 3, true)
  view.setUint32(54, 0x00ff0000, true)
  view.setUint32(58, 0x0000ff00, true)
  view.setUint32(62, 0x000000ff, true)
  view.setUint32(66, 0xff000000, true)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = at(x, y)
      const o = offset + (y * width + x) * 4
      bytes[o] = b
      bytes[o + 1] = g
      bytes[o + 2] = r
      bytes[o + 3] = a
    }
  }
  return toBase64(bytes)
}

/** A 24 bpp bottom-up BI_RGB BMP, rows padded to 4 bytes. */
function bmp24BottomUp(
  width: number,
  height: number,
  at: (x: number, y: number) => Pixel,
): string {
  const headerSize = 40
  const offset = 14 + headerSize
  const stride = Math.floor((24 * width + 31) / 32) * 4
  const bytes = new Uint8Array(offset + stride * height)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x42
  bytes[1] = 0x4d
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, offset, true)
  view.setUint32(14, headerSize, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(30, 0, true)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = at(x, y)
      const o = offset + (height - 1 - y) * stride + x * 3
      bytes[o] = b
      bytes[o + 1] = g
      bytes[o + 2] = r
    }
  }
  return toBase64(bytes)
}

function wordsOf(cells: string): number[] {
  return [...new Uint32Array(fromBase64(cells).buffer)]
}

describe("parseBmp", () => {
  test("reads a 32 bpp top-down BITFIELDS BMP, alpha included", () => {
    const bmp = parseBmp(
      fromBase64(
        bmp32TopDown(2, 2, (x, y) =>
          x === 0 && y === 0
            ? [255, 0, 0, 255]
            : x === 1 && y === 0
              ? [0, 255, 0, 128]
              : x === 0 && y === 1
                ? [0, 0, 255, 0]
                : [255, 255, 255, 255],
        ),
      ),
    )
    expect(bmp).toMatchObject({ width: 2, height: 2 })
    expect([...bmp!.rgba]).toEqual([
      255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 255,
    ])
  })

  test("reads a 24 bpp bottom-up BI_RGB BMP, padding and row order intact", () => {
    const bmp = parseBmp(
      fromBase64(
        bmp24BottomUp(3, 2, (x, y) =>
          y === 0
            ? [10 + x, 20 + x, 30 + x, 255]
            : [110 + x, 120 + x, 130 + x, 255],
        ),
      ),
    )
    expect(bmp).toMatchObject({ width: 3, height: 2 })
    expect([...bmp!.rgba]).toEqual([
      10, 20, 30, 255, 11, 21, 31, 255, 12, 22, 32, 255, 110, 120, 130, 255,
      111, 121, 131, 255, 112, 122, 132, 255,
    ])
  })

  test("reads what macOS sips writes: V5 header, BITFIELDS, top-down", () => {
    // `sips -z 6 8 -s format bmp shot.png --out shot.bmp`, byte for byte.
    const SIPS_8X6 =
      "Qk1KAQAAAAAAAIoAAAB8AAAACAAAAPr///8BACAAAwAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0c7P/8XExP/HxcX/y8rK/8zKyv/Ny8v/zMrK/8jGxv9IMz3/ODo8/zg0M/81KCv/NDM0/zYtL/9FOj3/Mycp/zEiIf8uHx7/NCIf/zAhH/8uIR//LyQl/ysgIv8hFhf/NCgn/zYrKv84LCv/Oy4r/z4uKP88LCb/OSwq/zMnJv80Jyb/PC8u/zsuLP8+MjH/PDEw/zstKv87Liz/T0VE/zIoKP8kIij/JiYs/y8iIf8rHh3/LyIi/zUpKP8pHBv/"
    const bmp = parseBmp(fromBase64(SIPS_8X6))
    expect(bmp).toMatchObject({ width: 8, height: 6 })
    expect([...bmp!.rgba.slice(0, 4)]).toEqual([0xcf, 0xce, 0xd1, 0xff])
    expect(wordsOf(cellsOf(bmp!.rgba, 8, 6)).length).toBe(8 * 3 * 3)
  })

  test("refuses anything else or truncated data", () => {
    expect(parseBmp(new Uint8Array(10))).toBeNull()
    expect(parseBmp(fromBase64(btoa("BM" + "x".repeat(60))))).toBeNull()
    const jpeg = fromBase64(bmp32TopDown(1, 1, () => [0, 0, 0, 255]))
    jpeg[0] = 0xff
    expect(parseBmp(jpeg)).toBeNull()
    const truncated = fromBase64(
      bmp32TopDown(2, 2, () => [1, 2, 3, 255]),
    ).slice(0, 70)
    expect(parseBmp(truncated)).toBeNull()
    // 8 bpp and RLE compression are out of scope.
    const eight = fromBase64(bmp24BottomUp(2, 1, () => [1, 2, 3, 255]))
    new DataView(eight.buffer).setUint16(28, 8, true)
    expect(parseBmp(eight)).toBeNull()
    const rle = fromBase64(bmp24BottomUp(2, 1, () => [1, 2, 3, 255]))
    new DataView(rle.buffer).setUint32(30, 1, true)
    expect(parseBmp(rle)).toBeNull()
  })
})

describe("cellsOf", () => {
  test("folds pixel pairs into half-blocks, odd heights leave a lone top row", () => {
    // 2 wide, 3 tall: rows = 2. (0,0) both opaque, (1,0) bottom only,
    // (0,1) top only (bottom past the last row), (1,1) neither.
    const rgba = new Uint8Array([
      255, 0, 0, 255, 1, 2, 3, 0, 0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255,
      255, 9, 9, 9, 127,
    ])
    expect(wordsOf(cellsOf(rgba, 2, 3))).toEqual([
      0x2580, 0xff0000, 0x0000ff, 0x2584, 0x00ff00, 0x01000000, 0x2580,
      0xffffff, 0x01000000, 0x20, 0x01000000, 0x01000000,
    ])
  })

  test("one pixel column is one cell: 1px stripes stay distinct, never paired", () => {
    const width = 6
    const rgba = new Uint8Array(width * 2 * 4)
    for (let x = 0; x < width; x++) {
      const shade = x % 2 === 0 ? 0 : 255
      for (const y of [0, 1])
        rgba.set([shade, shade, shade, 255], (y * width + x) * 4)
    }
    const words = wordsOf(cellsOf(rgba, width, 2))
    expect(words.length).toBe(width * 3)
    const foregrounds = words.filter((_, i) => i % 3 === 1)
    expect(foregrounds).toEqual([
      0x000000, 0xffffff, 0x000000, 0xffffff, 0x000000, 0xffffff,
    ])
  })
})

describe("canDrawImages", () => {
  test("only kitty-graphics terminals draw Image", () => {
    expect(canDrawImages({ TERM: "xterm-kitty" })).toBe(true)
    expect(canDrawImages({ TERM_PROGRAM: "ghostty" })).toBe(true)
    expect(canDrawImages({ TERM_PROGRAM: "iTerm.app" })).toBe(false)
    expect(
      canDrawImages({ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }),
    ).toBe(false)
    expect(canDrawImages({})).toBe(false)
  })

  test("the force override draws Image anywhere, iTerm2 included", () => {
    const iTerm = { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }
    expect(
      canDrawImages({ ...iTerm, CLAUDE_CODE_FORCE_TERMINAL_IMAGES: "1" }),
    ).toBe(true)
    expect(canDrawImages({ CLAUDE_CODE_FORCE_TERMINAL_IMAGES: "true" })).toBe(
      true,
    )
    for (const off of ["", "0", "false"]) {
      expect(
        canDrawImages({ ...iTerm, CLAUDE_CODE_FORCE_TERMINAL_IMAGES: off }),
      ).toBe(false)
    }
  })
})

describe("layout", () => {
  test("image numbers come from the draft, deduplicated, in order", () => {
    expect(
      imageNumbers("look [Image #2] and [Image #1] again [Image #2]"),
    ).toEqual([2, 1])
    expect(imageNumbers("[Image 1] [image #3] #4")).toEqual([])
  })

  test("PNG size is read from the IHDR header", () => {
    expect(pngSize(pngHead(1630, 632))).toEqual({ width: 1630, height: 632 })
    expect(
      pngSize(btoa("\xff\xd8\xff\xe0 this is a jpeg, not a png...")),
    ).toBeNull()
  })

  test("thumbnails keep aspect ratio within the tile", () => {
    // Square: 20 rows tall, twice as many columns because cells are tall.
    expect(fitCells({ width: 500, height: 500 })).toEqual({
      columns: 40,
      rows: 20,
    })
    // Very wide: capped at the given width, rows shrink to match.
    expect(fitCells({ width: 3000, height: 500 }, 20, 32)).toEqual({
      columns: 32,
      rows: 3,
    })
    // Very tall: never narrower than 4 columns.
    expect(fitCells({ width: 100, height: 2000 })).toEqual({
      columns: 4,
      rows: 20,
    })
  })

  test("a row of tiles shrinks to fit the band so it never scrolls", () => {
    const square = { width: 500, height: 500 }
    // Plenty of room: full 20-row tiles, never taller.
    expect(fitRow([square], 40, 120)).toEqual([{ columns: 40, rows: 20 }])
    // A short band: border and label take 3 rows, so the picture gets the rest.
    expect(fitRow([square], 7, 120)).toEqual([{ columns: 8, rows: 4 }])
    // A narrow band: three squares need 3 * (2 * rows + 2) + 2 columns; 40 forces 5 rows.
    expect(fitRow([square, square, square], 20, 40)).toEqual([
      { columns: 10, rows: 5 },
      { columns: 10, rows: 5 },
      { columns: 10, rows: 5 },
    ])
  })

  test("a lone wide screenshot takes the band's width, not a fixed thumbnail", () => {
    // 1540 x 980 at 120 columns: 20 rows, 63 columns, so 63 x 40 samples.
    expect(fitRow([{ width: 1540, height: 980 }], 40, 120)).toEqual([
      { columns: 63, rows: 20 },
    ])
    // Wider than the band: the full body width less the border, rows to match.
    expect(fitRow([{ width: 3000, height: 500 }], 40, 120)).toEqual([
      { columns: 118, rows: 10 },
    ])
  })
})

const BAND = {
  plugin: "image-view",
  component: "AbovePrompt",
  requestId: "above-prompt",
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const ok = {
  exitCode: 0,
  stdout: "",
  stderr: "",
  isStdoutTruncated: false,
  isStderrTruncated: false,
}

function imageWorld(
  on: Parameters<TestBody>[1],
  dir: string,
  draft: string,
  alsoExisting: readonly string[] = [],
) {
  const entry = { size: 0, mtimeMs: 0, isLink: false }
  on("session.start", () => ({ cwd: "/work" }))
  on("prompt.read", () => ({ value: { text: draft, cursor: draft.length } }))
  on("session.id", () => ({ value: "sess-1" }))
  on("fs.list", () => ({
    value: [
      { name: "-other", kind: "dir", ...entry },
      { name: "notes.txt", kind: "file", ...entry },
      { name: "-work", kind: "dir", ...entry },
    ],
  }))
  on("fs.exists", ($, e) => ({
    value:
      e.path === dir ||
      e.path === `${dir}/1.png` ||
      alsoExisting.includes(e.path),
  }))
  on("ui.render", () => ({
    type: "Text",
    props: {},
    children: ["engine band"],
  }))
}

test("iTerm band shows a placeholder, then a Raster once sips decodes", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TERM_PROGRAM: "iTerm.app",
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  const draft = "see [Image #1]"
  imageWorld(on, dir, draft)
  on("fs.read", ($, e) => {
    if (e.path.endsWith(".bmp")) {
      const match = /\.image-view-(\d+)-(\d+)x(\d+)\.bmp$/.exec(e.path)
      const columns = Number(match![2])
      const rows = Number(match![3])
      return {
        value: {
          base64: bmp32TopDown(columns, rows * 2, () => [200, 100, 50, 255]),
        },
      }
    }
    return { value: { base64: pngHead(800, 400) } }
  })
  const runs: string[][] = []
  let releaseSips!: () => void
  const sipsGate = new Promise<void>((resolve) => {
    releaseSips = resolve
  })
  on("process.run", ($, e) => {
    runs.push([...e.argv])
    if (e.argv[0] === "sips" && e.argv[1] === "-z")
      return sipsGate.then(() => ({ value: ok }))
    return { value: ok }
  })

  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  expect(await ui.find({ type: "Text", text: "…" })).toBeDefined()
  expect(await ui.find({ type: "Raster" })).toBeUndefined()
  releaseSips()

  let raster: FoundElement | undefined
  for (let i = 0; i < 20 && !raster; i++) {
    await clock.settle()
    raster = await ui.find({ type: "Raster" })
  }
  expect(raster?.props).toMatchObject({ columns: 68, rows: 17 })
  expect(wordsOf(raster!.props.cells as string).length).toBe(68 * 17 * 3)

  const sips = runs.find((argv) => argv[0] === "sips" && argv[1] === "-z")
  expect(sips!.slice(0, 7)).toEqual([
    "sips",
    "-z",
    "34",
    "68",
    "-s",
    "format",
    "bmp",
  ])
  expect(sips!.slice(-2)).toEqual(["--out", `${dir}/.image-view-1-68x17.bmp`])
  expect(
    runs.some(
      (argv) =>
        argv[0] === "rm" && argv.includes(`${dir}/.image-view-1-68x17.bmp`),
    ),
  ).toBe(true)
  await ui.unmount()
})

test("a failed decode keeps the no-preview tile", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TERM_PROGRAM: "iTerm.app",
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  imageWorld(on, dir, "see [Image #1]")
  on("fs.read", () => ({ value: { base64: pngHead(800, 400) } }))
  on("process.run", () => ({ value: { ...ok, exitCode: 1 } }))

  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  for (
    let i = 0;
    i < 20 && !(await ui.find({ type: "Text", text: "no preview" }));
    i++
  ) {
    await clock.settle()
  }
  expect(await ui.find({ type: "Text", text: "no preview" })).toBeDefined()
  expect(await ui.find({ type: "Raster" })).toBeUndefined()
  await ui.unmount()
})

test("an oversized PNG still gets its aspect from sips", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TERM_PROGRAM: "ghostty",
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  imageWorld(on, dir, "see [Image #1]")
  on("fs.read", () => {
    throw new Error("over 4 MiB")
  })
  on("process.run", ($, e) => ({
    value: {
      ...ok,
      stdout: `${dir}/1.png\n  pixelWidth: 800\n  pixelHeight: 400\n`,
    },
  }))

  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  const image = await ui.find({ type: "Image" })
  expect(image?.props).toMatchObject({
    source: { file: `${dir}/1.png`, format: "png" },
    columns: 68,
    rows: 17,
  })
  await ui.unmount()
})

test("a kitty-protocol terminal keeps the Image element", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TERM_PROGRAM: "ghostty",
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  imageWorld(on, dir, "see [Image #1] [Image #2]")
  on("fs.read", () => ({ value: { base64: pngHead(800, 400) } }))
  on("process.run", () => ({ value: ok }))

  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  const image = await ui.find({ type: "Image" })
  expect(image?.props).toMatchObject({
    source: { file: `${dir}/1.png`, format: "png" },
    columns: 64,
    rows: 16,
  })
  expect(await ui.find({ type: "Raster" })).toBeUndefined()
  // #2 has no cached file, so it gets a placeholder tile instead of a broken Image.
  expect(await ui.find({ type: "Text", text: "no preview" })).toBeDefined()
  await ui.unmount()
})

test("iTerm2 with the force override draws Image, not Raster", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TERM_PROGRAM: "iTerm.app",
    CLAUDE_CODE_FORCE_TERMINAL_IMAGES: "1",
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  imageWorld(on, dir, "see [Image #1]")
  on("fs.read", () => ({ value: { base64: pngHead(800, 400) } }))
  const runs: string[][] = []
  on("process.run", ($, e) => {
    runs.push([...e.argv])
    return { value: ok }
  })

  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  const image = await ui.find({ type: "Image" })
  expect(image?.props).toMatchObject({
    source: { file: `${dir}/1.png`, format: "png" },
  })
  expect(await ui.find({ type: "Raster" })).toBeUndefined()
  expect(runs.some((argv) => argv[0] === "sips" && argv[1] === "-z")).toBe(false)
  await ui.unmount()
})

const IMGCAT = "/Applications/iTerm.app/Contents/Resources/utilities/imgcat"

async function bandWithOneImage(
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  env: Record<string, string>,
  answer: (argv: readonly string[]) => number,
) {
  const clock = mock.clock(on)
  mock.env(on, {
    CLAUDE_CODE_TMPDIR: "/tmp/claude-501",
    TMPDIR: "/var/folders/xy/T/",
    HOME: "/Users/someone",
    ...env,
  })
  const dir = "/tmp/claude-501/-work/sess-1/images"
  imageWorld(on, dir, "see [Image #1]", [IMGCAT])
  on("fs.read", () => ({ value: { base64: pngHead(800, 400) } }))
  const runs: string[][] = []
  const writes: { path: string; text: string }[] = []
  on("process.run", ($, e) => {
    runs.push([...e.argv])
    return { value: { ...ok, exitCode: answer(e.argv) } }
  })
  on("fs.write", ($, e) => {
    writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  await $.session.start({
    surface: "terminal",
    isInteractive: true,
    cwd: "/work",
  })
  await clock.advance(200)
  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  return { ui, runs, writes, image: `${dir}/1.png` }
}

test("each tile's label is a button, hotkeyed by its image number", async ($, on) => {
  const { ui } = await bandWithOneImage(
    $,
    on,
    { TERM_PROGRAM: "ghostty" },
    () => 0,
  )
  const button = await ui.find({ type: "Button" })
  expect(button?.props).toMatchObject({
    key: "open-1",
    hotkey: "1",
    label: "full size",
  })
  await ui.unmount()
})

test("in iTerm2, full size splits Claude Code's own session and runs imgcat", async ($, on) => {
  const { ui, runs, writes, image } = await bandWithOneImage(
    $,
    on,
    { TERM_PROGRAM: "iTerm.app", ITERM_SESSION_ID: "w0t1p0:ABC-123" },
    () => 0,
  )
  await ui.press({ key: "open-1" })
  const script = "/var/folders/xy/T/image-view/view-1.zsh"
  expect(writes).toHaveLength(1)
  expect(writes[0]!.path).toBe(script)
  expect(writes[0]!.text).toContain(`'${IMGCAT}' '${image}'`)
  const osascript = runs.find((argv) => argv[0] === "osascript")
  expect(osascript?.[2]).toContain('if unique id of aSession is "ABC-123"')
  expect(osascript?.[2]).toContain(
    `split vertically with default profile command "/bin/zsh -f '${script}'"`,
  )
  expect(runs.some((argv) => argv.join(" ").includes("qlmanage"))).toBe(false)
  await ui.unmount()
})

test("in iTerm2, a failed split falls back to Quick Look", async ($, on) => {
  const { ui, runs, image } = await bandWithOneImage(
    $,
    on,
    { LC_TERMINAL: "iTerm2" },
    (argv) => (argv[0] === "osascript" ? 1 : 0),
  )
  await ui.press({ key: "open-1" })
  expect(runs.at(-1)).toEqual([
    "/bin/sh",
    "-c",
    'qlmanage -p "$1" >/dev/null 2>&1 &',
    "image-view",
    image,
  ])
  await ui.unmount()
})

test("outside iTerm2, full size goes straight to Quick Look", async ($, on) => {
  const { ui, runs, writes } = await bandWithOneImage(
    $,
    on,
    { TERM_PROGRAM: "ghostty" },
    () => 0,
  )
  await ui.press({ key: "open-1" })
  expect(runs.some((argv) => argv[0] === "osascript")).toBe(false)
  expect(writes).toHaveLength(0)
  expect(runs.at(-1)?.[2]).toContain("qlmanage -p")
  await ui.unmount()
})
