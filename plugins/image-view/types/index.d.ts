export type PastedImage = {
  n: number
  /** Absolute path of the cached PNG; null when it can't be found. */
  path: string | null
  /** Pixel size; null when unknown, and the tile falls back to a default shape. */
  size: { width: number; height: number } | null
  /** Original file path the paste recorded (`[Image: source: …]`), if any; labels use its name. */
  source?: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'image-view': { images: PastedImage[] }
  }
}
