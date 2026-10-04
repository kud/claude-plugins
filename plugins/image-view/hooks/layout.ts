export type Size = { width: number; height: number }
export type Cells = { columns: number; rows: number }

// A picture is never taller than this, so the prompt stays usable below it.
const TILE_ROWS = 20
// The widest box `Image` takes (`Raster` takes 512); the band width is the real cap.
const MAX_COLUMNS = 255
const MIN_COLUMNS = 4
// A Raster cell holds two pixel rows, so its samples are square at this aspect; sips
// scales to exactly that grid, so a Raster never letterboxes.
export const RASTER_CELL_ASPECT = 2
// An Image keeps the picture's aspect inside its box, so the box must match the real
// cell (height over width) or the picture letterboxes. The mod API reports no cell
// pixels: this is a typical one (iTerm2 at JetBrains Mono 14 with 1.1 line spacing is
// about 2.33, Ghostty and kitty defaults 2.1 to 2.25). IMAGE_VIEW_CELL_ASPECT overrides it.
export const IMAGE_CELL_ASPECT = 2.3
// Used when the size is unknown (file over $.fs.read's 4 MiB cap, or no file).
const FALLBACK: Size = { width: 16, height: 10 }
// Each tile adds a border on every side, a column of padding each side, and a label row under the picture.
const TILE_CHROME_ROWS = 3
const TILE_CHROME_COLUMNS = 4
const GAP = 1

/** The distinct image numbers a draft references, in the order they first appear. */
export function imageNumbers(draft: string): number[] {
  const seen = new Set<number>()
  for (const match of draft.matchAll(/\[Image #(\d+)\]/g)) seen.add(Number(match[1]))
  return [...seen]
}

/**
 * The original paths a paste recorded as `[Image: source: /path/to/file.png]`,
 * in the order they appear. The i-th record belongs to the i-th pasted image.
 */
export function imageSourcesOf(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/\[Image:\s*source:\s*([^\]]+)\]/g)) {
    const path = match[1].trim()
    if (path !== "") found.push(path)
  }
  return found
}

/** The file name of a recorded source path. */
export function baseNameOf(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path
  const slash = trimmed.lastIndexOf("/")
  return slash < 0 ? trimmed : trimmed.slice(slash + 1)
}

const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

/** Display width in terminal cells: wide characters and emoji (among them 📸) count 2. */
export function cellWidthOf(text: string): number {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    width += code > 0xffff || WIDE.test(char) ? 2 : 1
  }
  return width
}

function takeWidth(text: string, budget: number): string {
  let width = 0
  let out = ""
  for (const char of text) {
    const next = width + cellWidthOf(char)
    if (next > budget) break
    out += char
    width = next
  }
  return out
}

function takeWidthEnd(text: string, budget: number): string {
  let width = 0
  let out = ""
  for (const char of [...text].reverse()) {
    const next = width + cellWidthOf(char)
    if (next > budget) break
    out = char + out
    width = next
  }
  return out
}

const ELLIPSIS = "…"

/** Shorten `name` to `budget` cells, keeping the extension and cutting the stem's middle. */
export function truncateName(name: string, budget: number): string {
  if (budget <= 0) return ""
  if (cellWidthOf(name) <= budget) return name
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name
  const ext = stem === name ? "" : name.slice(dot)
  const keep = budget - cellWidthOf(ext) - cellWidthOf(ELLIPSIS)
  if (keep < 2) {
    const cut = takeWidth(name, budget - cellWidthOf(ELLIPSIS))
    return cut + (cellWidthOf(cut) < budget ? ELLIPSIS : "")
  }
  const endKeep = Math.floor(keep / 2)
  return takeWidth(stem, keep - endKeep) + ELLIPSIS + takeWidthEnd(stem, endKeep) + ext
}

const LABEL_SUFFIX = " 📸"

/**
 * The caption under a tile: the source file's name when the paste recorded one,
 * else `[Image #n]`. Truncated to `innerWidth` cells (the tile's picture width
 * plus its padding), extension kept.
 */
export function imageLabel(
  image: { n: number; source?: string | null },
  innerWidth: number,
): string {
  if (innerWidth < cellWidthOf(LABEL_SUFFIX) + 1) return "📸"
  const name =
    image.source !== undefined && image.source !== null && image.source !== ""
      ? baseNameOf(image.source)
      : `[Image #${image.n}]`
  return truncateName(name, innerWidth - cellWidthOf(LABEL_SUFFIX)) + LABEL_SUFFIX
}

/** Width and height from a PNG's IHDR chunk, or null when the bytes aren't a PNG. */
export function pngSize(base64: string): Size | null {
  // 24 bytes cover the signature and IHDR's width and height; 32 base64 chars decode to exactly 24.
  const head = Uint8Array.from(atob(base64.slice(0, 32)), char => char.charCodeAt(0))
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (head.length < 24 || signature.some((byte, i) => head[i] !== byte)) return null
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  return width > 0 && height > 0 ? { width, height } : null
}

/** The cell aspect IMAGE_VIEW_CELL_ASPECT asks for, when it is a number from 1 to 4. */
export function cellAspectOf(value: string | undefined, fallback = IMAGE_CELL_ASPECT): number {
  const aspect = Number(value)
  return value !== undefined && value.trim() !== "" && aspect >= 1 && aspect <= 4 ? aspect : fallback
}

/**
 * A picture box at most `tileRows` tall and `maxColumns` wide that keeps the
 * picture's aspect ratio: as tall as allowed, unless that would be too wide.
 */
export function fitCells(
  size: Size | null,
  tileRows = TILE_ROWS,
  maxColumns = MAX_COLUMNS,
  cellAspect = RASTER_CELL_ASPECT,
): Cells {
  const { width, height } = size ?? FALLBACK
  const widest = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, maxColumns))
  let rows = tileRows
  let columns = Math.round((rows * cellAspect * width) / height)
  if (columns > widest) {
    columns = widest
    rows = Math.max(1, Math.round((widest * height) / (cellAspect * width)))
  }
  return { columns: Math.max(MIN_COLUMNS, columns), rows: Math.min(rows, tileRows) }
}

/**
 * Picture boxes for one row of tiles that fits the band whole, so it never scrolls:
 * the tallest tiles (up to TILE_ROWS) whose chrome fits in `maxRows` and whose
 * total width fits in `bodyColumns`. A lone picture may take the band's full width.
 * `cellAspect` is the cell's height over its width as the tile's element draws it.
 */
export function fitRow(
  sizes: readonly (Size | null)[],
  maxRows: number,
  bodyColumns: number,
  cellAspect = RASTER_CELL_ASPECT,
): Cells[] {
  const tallest = Math.max(1, Math.min(TILE_ROWS, maxRows - TILE_CHROME_ROWS))
  const widest = bodyColumns - TILE_CHROME_COLUMNS
  for (let tileRows = tallest; tileRows > 1; tileRows--) {
    const cells = sizes.map(size => fitCells(size, tileRows, widest, cellAspect))
    const width = cells.reduce((sum, c) => sum + c.columns + TILE_CHROME_COLUMNS, 0) + GAP * (cells.length - 1)
    if (width <= bodyColumns) return cells
  }
  return sizes.map(size => fitCells(size, 1, widest, cellAspect))
}
