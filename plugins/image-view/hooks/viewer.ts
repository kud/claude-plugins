// Opening a pasted image at full resolution: an iTerm2 split running imgcat, else Quick Look.
// Everything here is pure; register.tsx does the I/O.

export type TerminalEnv = {
  TERM_PROGRAM?: string
  LC_TERMINAL?: string
}

export type Viewer = "iterm-split" | "quick-look"

// The split takes this share of the session's columns; iTerm2 halves it otherwise.
const SPLIT_SHARE = 0.4

// iTerm2 ships imgcat inside the app bundle; shell integration installs another copy.
export const IMGCAT_CANDIDATES = [
  "/Applications/iTerm.app/Contents/Resources/utilities/imgcat",
  "~/.iterm2/imgcat",
] as const

/** iTerm2 sets TERM_PROGRAM itself; LC_TERMINAL survives ssh and tmux, which overwrite it. */
export function isITerm(env: TerminalEnv): boolean {
  return env.TERM_PROGRAM === "iTerm.app" || env.LC_TERMINAL === "iTerm2"
}

/** The first viewer to try; Quick Look is also where a failed split lands. */
export function chooseViewer(env: TerminalEnv): Viewer {
  return isITerm(env) ? "iterm-split" : "quick-look"
}

/** One POSIX shell word, whatever the text holds. */
export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`
}

/** One AppleScript string literal. */
export function appleScriptString(text: string): string {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

/** `w0t0p0:UUID` → `UUID`, the session's `unique id` in iTerm2's AppleScript. */
export function iTermSessionUuid(
  itermSessionId: string | undefined,
): string | undefined {
  const uuid = itermSessionId?.split(":").pop()?.trim()
  return uuid ? uuid : undefined
}

/**
 * The zsh script the new pane runs: the picture through imgcat, or the inline-image
 * escape (OSC 1337) printed straight to the pane's TTY when there is no imgcat, then
 * one keypress to close.
 */
export function paneScript(imagePath: string, imgcat: string | null): string {
  const image = shellQuote(imagePath)
  const draw =
    imgcat === null
      ? `printf '\\033]1337;File=inline=1;preserveAspectRatio=1;size=%d:%s\\a\\n' "$(wc -c < ${image} | tr -d ' ')" "$(base64 < ${image} | tr -d '\\n')"`
      : `${shellQuote(imgcat)} ${image}`
  return [
    "clear",
    draw,
    "print -n '\\npress any key to close'",
    "read -sk1",
    "",
  ].join("\n")
}

/** The command iTerm2 runs in the split; it splits on spaces and honours shell quoting. */
export function paneCommand(scriptPath: string): string {
  return `/bin/zsh -f ${shellQuote(scriptPath)}`
}

/**
 * AppleScript for `osascript -e`: split the session Claude Code runs in (found by its
 * unique id, else the current one) vertically, and narrow the new pane to ~40%.
 */
export function splitScript(
  command: string,
  sessionUuid: string | undefined,
): string {
  const find =
    sessionUuid === undefined
      ? []
      : [
          "  repeat with aWindow in windows",
          "    repeat with aTab in tabs of aWindow",
          "      repeat with aSession in sessions of aTab",
          `        if unique id of aSession is ${appleScriptString(sessionUuid)} then set origin to aSession`,
          "      end repeat",
          "    end repeat",
          "  end repeat",
        ]
  return [
    'tell application id "com.googlecode.iterm2"',
    "  set origin to missing value",
    ...find,
    "  if origin is missing value then set origin to current session of current window",
    "  set total to columns of origin",
    "  tell origin",
    `    set pane to (split vertically with default profile command ${appleScriptString(command)})`,
    "  end tell",
    "  try",
    `    set columns of pane to (round (total * ${SPLIT_SHARE}))`,
    "  end try",
    "end tell",
  ].join("\n")
}

/** Quick Look in the background: qlmanage blocks until its window closes. */
export function quickLookArgv(imagePath: string): string[] {
  return [
    "/bin/sh",
    "-c",
    'qlmanage -p "$1" >/dev/null 2>&1 &',
    "image-view",
    imagePath,
  ]
}

/** Expands a leading `~/` against HOME. */
export function expandHome(
  path: string,
  home: string | undefined,
): string | undefined {
  if (!path.startsWith("~/")) return path
  return home ? `${home}${path.slice(1)}` : undefined
}

/** Hotkeys are one digit, so only images #1 to #9 get one; the rest are click-only. */
export function hotkeyOf(n: number): string | undefined {
  return n >= 1 && n <= 9 ? String(n) : undefined
}

/**
 * The label of a tile's open button, kept within the tile's width: a hotkeyed one is
 * drawn `1: full size`, the rest `#12 full size`; a narrow tile gets the glyph alone.
 */
export function openLabel(n: number, columns: number): string {
  const prefix = hotkeyOf(n) ? "" : `#${n} `
  const reserved = hotkeyOf(n) ? 3 : 0
  const full = `${prefix}full size`
  return reserved + full.length <= columns ? full : `${prefix}⤢`
}
