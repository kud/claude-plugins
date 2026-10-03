/** Base64 over chunks, so one huge string never blows the argument limit. */
export function toBase64(bytes: Uint8Array): string {
  let text = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(text)
}

export function fromBase64(base64: string): Uint8Array {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

const channelOf = (pixel: number, mask: number): number => {
  if (mask === 0) return 0
  let rest = mask >>> 0
  let shift = 0
  while ((rest & 1) === 0) {
    rest >>>= 1
    shift++
  }
  let bits = 0
  while ((rest & 1) === 1) {
    rest >>>= 1
    bits++
  }
  if (bits === 0) return 0
  const value = (pixel >>> shift) & (bits >= 32 ? 0xffffffff : (1 << bits) - 1)
  return bits >= 8
    ? value >>> (bits - 8)
    : Math.round((value * 255) / ((1 << bits) - 1))
}

/**
 * RGBA pixels, top-down, from BMP bytes. Handles 24 and 32 bpp with compression
 * 0 (BI_RGB; 32 bpp reads as BGRX, always opaque) and 3 (BI_BITFIELDS, with the
 * channel masks at 54/58/62 and the alpha mask at 66 once the header is 56+;
 * a zero alpha mask means opaque). Null for anything else or truncated data.
 */
export function parseBmp(
  bytes: Uint8Array,
): { width: number; height: number; rgba: Uint8Array } | null {
  if (bytes.length < 54) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4d) return null
  const offset = view.getUint32(10, true)
  const headerSize = view.getUint32(14, true)
  if (headerSize < 40) return null
  const width = view.getInt32(18, true)
  const heightRaw = view.getInt32(22, true)
  if (width <= 0 || heightRaw === 0) return null
  if (view.getUint16(26, true) !== 1) return null
  const bpp = view.getUint16(28, true)
  if (bpp !== 24 && bpp !== 32) return null
  const compression = view.getUint32(30, true)
  if (compression !== 0 && compression !== 3) return null

  let red = 0
  let green = 0
  let blue = 0
  let alpha = 0
  if (compression === 3) {
    if (bytes.length < 66) return null
    red = view.getUint32(54, true)
    green = view.getUint32(58, true)
    blue = view.getUint32(62, true)
    if (headerSize >= 56) {
      if (bytes.length < 70) return null
      alpha = view.getUint32(66, true)
    }
    if (offset < (headerSize >= 56 ? 70 : 66)) return null
  } else if (offset < 14 + headerSize) {
    return null
  }

  const height = Math.abs(heightRaw)
  const topDown = heightRaw < 0
  const stride = Math.floor((bpp * width + 31) / 32) * 4
  if (offset + stride * height > bytes.length) return null

  let rgba: Uint8Array
  try {
    rgba = new Uint8Array(width * height * 4)
  } catch {
    return null
  }
  const step = bpp / 8
  for (let y = 0; y < height; y++) {
    const row = offset + (topDown ? y : height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const at = row + x * step
      let r: number
      let g: number
      let b: number
      let a = 255
      if (compression === 3) {
        const pixel =
          step === 4
            ? view.getUint32(at, true)
            : view.getUint8(at) |
              (view.getUint8(at + 1) << 8) |
              (view.getUint8(at + 2) << 16)
        r = channelOf(pixel, red)
        g = channelOf(pixel, green)
        b = channelOf(pixel, blue)
        a = alpha === 0 ? 255 : channelOf(pixel, alpha)
      } else {
        b = view.getUint8(at)
        g = view.getUint8(at + 1)
        r = view.getUint8(at + 2)
      }
      const out = (y * width + x) * 4
      rgba[out] = r
      rgba[out + 1] = g
      rgba[out + 2] = b
      rgba[out + 3] = a
    }
  }
  return { width, height, rgba }
}

const TERMINAL_DEFAULT = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

/**
 * A Raster `cells` string for `columns = width`, `rows = ceil(height / 2)`: each
 * cell folds two pixels into one half-block glyph, transparent past the last row
 * of an odd height. Alpha under 128 reads as transparent.
 */
export function cellsOf(
  rgba: Uint8Array,
  width: number,
  height: number,
): string {
  const rows = Math.ceil(height / 2)
  const words = new Uint32Array(width * rows * 3)
  const opaque = (x: number, y: number): number | null => {
    if (x < 0 || x >= width || y < 0 || y >= height) return null
    const at = (y * width + x) * 4
    const [r = 0, g = 0, b = 0, a = 0] = rgba.subarray(at, at + 4)
    return a >= 128 ? (r << 16) | (g << 8) | b : null
  }
  let i = 0
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < width; x++) {
      const top = opaque(x, row * 2)
      const bottom = opaque(x, row * 2 + 1)
      let code = 0x20
      let fg = TERMINAL_DEFAULT
      let bg = TERMINAL_DEFAULT
      if (top !== null && bottom !== null) {
        code = UPPER_HALF
        fg = top
        bg = bottom
      } else if (top !== null) {
        code = UPPER_HALF
        fg = top
      } else if (bottom !== null) {
        code = LOWER_HALF
        fg = bottom
      }
      words[i++] = code
      words[i++] = fg >>> 0
      words[i++] = bg >>> 0
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

const isForced = (value: string | undefined): boolean =>
  value !== undefined && !["", "0", "false"].includes(value.trim().toLowerCase())

/**
 * True only where the terminal draws the `Image` element itself (kitty graphics). The
 * mod API reports no such capability, so this mirrors Claude Code: its force override
 * (iTerm2 nightly and other kitty-graphics terminals), then kitty and Ghostty.
 */
export function canDrawImages(env: {
  TERM?: string
  TERM_PROGRAM?: string
  CLAUDE_CODE_FORCE_TERMINAL_IMAGES?: string
}): boolean {
  return (
    isForced(env.CLAUDE_CODE_FORCE_TERMINAL_IMAGES) ||
    env.TERM === "xterm-kitty" ||
    env.TERM_PROGRAM === "ghostty"
  )
}
