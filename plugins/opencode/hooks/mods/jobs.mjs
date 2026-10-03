import { atom, read, update } from "claude-code"

export const POLL_MS = 5000
export const FETCH_TIMEOUT_MS = 1000
export const COPIED_MS = 1500
export const IDLE_ROWS_MAX = 3

export const DISPLAY_STATE_ORDER = { idle: 0, retry: 1, busy: 2, gone: 3 }
export const STARTING_TITLE = "starting…"
export const GLYPHS = { idle: "✓", retry: "⚠", busy: "◌", gone: "?" }
// Palette indices 12 (bright blue) and 11 (bright yellow), so the terminal's own
// theme paints them. A bare name such as "blueBright" is drawn as a fixed hex,
// and the "ansi:" form is refused in plugin trees.
export const STATE_COLORS = {
  idle: { color: "ansi256(12)" },
  retry: { color: "ansi256(11)" },
  busy: {},
  gone: { dimColor: true },
}
export const FOOTER_OPEN = "enter open · c copy · esc back"
export const FOOTER_COPY = "enter copy · esc back"
export const COPY_KEY = "copy"

const GLYPH_GAP = "  "
const FOCUS_MARK = "› "
const NO_MARK = "  "
const IDLE_INDENT = "   "
const FOCUSED_INDENT = "     "
const GONE = { isReachable: false }
const SESSION_ID_PATTERN = /^[A-Za-z0-9_]+$/
const ROW_KEY_PREFIX = "job:"

const jobs = atom(
  { plugin: "opencode", key: "jobs" },
  { rows: [], updatedAt: 0 },
)
const focus = atom(
  { plugin: "opencode", key: "focus" },
  { isFocused: false, order: [], cursor: null, copied: null },
)

export const registryPathOf = (stateDir, home) =>
  `${stateDir || `${home}/.local/state/mcp-opencode`}/instances.json`

const isInstanceRecord = (value) =>
  typeof value === "object" &&
  value !== null &&
  Number.isInteger(value.port) &&
  typeof value.directory === "string"

export const parseRegistry = (text) => {
  try {
    const rows = JSON.parse(text)
    return Array.isArray(rows) ? rows.filter(isInstanceRecord) : []
  } catch {
    return []
  }
}

export const repoOf = (directory) =>
  directory.replace(/\/+$/, "").split("/").pop() || directory

export const attachCommandOf = (port, sessionId) =>
  `opencode attach http://127.0.0.1:${port} --session ${sessionId}`

const isValidPort = (port) => Number.isInteger(port) && port > 0 && port < 65536

export const openScriptOf = (port, sessionId) => {
  if (!isValidPort(port)) return null
  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId))
    return null
  return [
    'tell application "iTerm2"',
    "  if (count of windows) = 0 then create window with default profile",
    "  tell current window",
    "    create tab with default profile",
    `    tell current session to write text "${attachCommandOf(port, sessionId)}"`,
    "  end tell",
    "end tell",
  ].join("\n")
}

export const canOpenIn = (surface, termProgram) =>
  surface === "terminal" && termProgram === "iTerm.app"

export const statusUrlOf = (port, directory) =>
  `http://127.0.0.1:${port}/session/status?directory=${encodeURIComponent(directory)}`

export const ageOf = (startedAt, now) => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  if (!Number.isFinite(seconds)) return "?"
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

const stateOf = (live, sessionId) => {
  if (!live.isReachable) return "gone"
  if (!sessionId) return "busy"
  const type = live.statuses[sessionId]?.type
  return type === "busy" || type === "retry" ? type : "idle"
}

const sessionsOf = (record) =>
  Array.isArray(record.sessions) && record.sessions.length > 0
    ? record.sessions
    : [{ id: null, title: STARTING_TITLE, startedAt: record.startedAt }]

export const rowKeyOf = (row) =>
  `${ROW_KEY_PREFIX}${row.port}:${row.sessionId ?? "starting"}`

const isRowKey = (key) =>
  typeof key === "string" && key.startsWith(ROW_KEY_PREFIX)

export const rowsOf = (records, liveByPort) =>
  records
    .flatMap((record) => {
      const live = liveByPort[record.port] ?? GONE
      return sessionsOf(record).map((session) => ({
        port: record.port,
        repo: repoOf(record.directory),
        sessionId: session.id ?? null,
        title: session.id ? session.title || "untitled" : STARTING_TITLE,
        startedAt: session.startedAt ?? record.startedAt ?? "",
        state: stateOf(live, session.id),
      }))
    })
    .filter((row) => row.state !== "gone")
    .sort(
      (a, b) =>
        DISPLAY_STATE_ORDER[a.state] - DISPLAY_STATE_ORDER[b.state] ||
        (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0),
    )

const truncate = (text, room) => {
  if (text.length <= room) return text
  if (room <= 1) return "…"
  return `${text.slice(0, room - 1)}…`
}

// One row's text fitted to `columns`: the repo goes first, then the title is
// cut with an ellipsis; the age (or "copied") always sits at the right edge.
export const rowLayoutOf = (row, { columns, prefix, tail }) => {
  const fixed = prefix.length + 1 + GLYPH_GAP.length + 1 + tail.length
  const room = Math.max(1, columns - fixed)
  const withRepo = row.title.length + 3 + row.repo.length
  const repo = withRepo <= room ? row.repo : ""
  const title = repo ? row.title : truncate(row.title, room)
  const used = title.length + (repo ? 3 + repo.length : 0)
  const pad = Math.max(
    1,
    columns - prefix.length - 1 - GLYPH_GAP.length - used - tail.length,
  )
  return { title, repo, pad }
}

// Idle: at most three job rows, the "+N more" line counting toward maxRows.
export const idleSliceOf = (rows, maxRows) => {
  const limit = Math.min(IDLE_ROWS_MAX, Math.max(0, maxRows))
  if (rows.length <= limit) return { shown: rows, overflow: 0 }
  const shown = rows.slice(0, Math.min(IDLE_ROWS_MAX, Math.max(0, maxRows - 1)))
  return { shown, overflow: rows.length - shown.length }
}

// Focused: the order frozen at focus time, rows that appeared since appended,
// gone ones dropped; up to maxRows less the footer, overflow line included.
export const focusedSliceOf = (rows, order, maxRows) => {
  const byKey = new Map(rows.map((row) => [rowKeyOf(row), row]))
  const kept = order
    .filter((key) => byKey.has(key))
    .map((key) => byKey.get(key))
  const known = new Set(order)
  const added = rows.filter((row) => !known.has(rowKeyOf(row)))
  const all = [...kept, ...added]
  const limit = Math.max(0, maxRows - 1)
  if (all.length <= limit) return { shown: all, overflow: 0 }
  const shown = all.slice(0, Math.max(0, limit - 1))
  return { shown, overflow: all.length - shown.length }
}

const withTimeout = async ($, promise, ms) => {
  const timedOut = $.clock.sleep(ms).then(() => GONE)
  return Promise.race([promise, timedOut])
}

const liveOf = async ($, record) => {
  try {
    const response = await $.http.fetch(
      statusUrlOf(record.port, record.directory),
    )
    if (!response.ok) return GONE
    const statuses = JSON.parse(response.text)
    return typeof statuses === "object" && statuses !== null
      ? { isReachable: true, statuses }
      : GONE
  } catch {
    return GONE
  }
}

const probeAll = async ($, records) => {
  const probed = await Promise.all(
    records.map(async (record) => [
      record.port,
      await withTimeout($, liveOf($, record), FETCH_TIMEOUT_MS),
    ]),
  )
  return Object.fromEntries(probed)
}

let registryStamp = null
let records = []
let isPolling = false
let hasPolled = false
let drawnSignature = null
let lastStates = new Map()
const toastedKeys = new Set()
let isFocusedMirror = false

const readRecords = async ($, path) => {
  let stat
  try {
    stat = await $.fs.stat(path)
  } catch {
    registryStamp = null
    records = []
    return records
  }
  const stamp = `${stat.mtimeMs}:${stat.size}`
  if (stamp === registryStamp) return records
  try {
    records = parseRegistry(await $.fs.read(path))
  } catch {
    records = []
  }
  registryStamp = stamp
  return records
}

const signatureOf = (rows, now) =>
  JSON.stringify(
    rows.map((row) => [
      rowKeyOf(row),
      row.state,
      row.title,
      row.repo,
      ageOf(row.startedAt, now),
    ]),
  )

const toastNewlyReady = ($, rows) => {
  for (const row of rows) {
    const key = rowKeyOf(row)
    const previous = lastStates.get(key)
    if (row.state !== "idle" || !row.sessionId) continue
    if (!hasPolled || previous === "idle" || toastedKeys.has(key)) continue
    toastedKeys.add(key)
    $.ui.toast(`opencode · ${row.title} is ready`)
  }
  lastStates = new Map(rows.map((row) => [rowKeyOf(row), row.state]))
}

const poll = async ($, path) => {
  if (isPolling) return
  isPolling = true
  try {
    const current = await readRecords($, path)
    const liveByPort = current.length > 0 ? await probeAll($, current) : {}
    const rows = rowsOf(current, liveByPort)
    const now = await $.clock.now()
    toastNewlyReady($, rows)
    hasPolled = true
    const signature = signatureOf(rows, now)
    if (signature === drawnSignature) return
    drawnSignature = signature
    await update($, jobs, () => ({ rows, updatedAt: now }))
  } finally {
    isPolling = false
  }
}

const setFocus = async ($, fn) => {
  await update($, focus, (value) => {
    const next = fn(value)
    isFocusedMirror = next.isFocused
    return next
  })
}

const leaveFocus = ($) =>
  setFocus($, (value) => ({
    ...value,
    isFocused: false,
    order: [],
    cursor: null,
  }))

const copyAttach = ($, row, surface) =>
  $.ui.copy({ text: attachCommandOf(row.port, row.sessionId), surface })

const showCopied = async ($, key) => {
  await setFocus($, (value) => ({ ...value, copied: key }))
  $.clock.after(COPIED_MS, () => {
    void setFocus($, (value) =>
      value.copied === key ? { ...value, copied: null } : value,
    )
  })
}

const copyRow = async ($, row, surface) => {
  if (!row.sessionId) return
  const copied = await copyAttach($, row, surface)
  if (copied.isCopied) await showCopied($, rowKeyOf(row))
  else $.ui.toast(`not copied: ${copied.reason}`)
}

const didRunOsascript = async ($, script) => {
  try {
    const { exitCode } = await $.process.run(["osascript", "-e", script])
    return exitCode === 0
  } catch {
    return false
  }
}

const openInIterm = async ($, row, surface) => {
  const script = openScriptOf(row.port, row.sessionId)
  if (!script) {
    $.ui.toast(`Refused to open ${row.repo}: unexpected session id or port`)
    return
  }
  if (await didRunOsascript($, script)) {
    $.ui.toast(`Opened ${row.repo} in a new iTerm tab`)
    return
  }
  const copied = await copyAttach($, row, surface)
  $.ui.toast(
    copied.isCopied
      ? "Couldn't open iTerm, attach command copied"
      : `Couldn't open iTerm, and not copied: ${copied.reason}`,
  )
}

const rowView = ({ Box, Text, Button }, $, row, view) => {
  const key = rowKeyOf(row)
  const tail = view.copied === key ? "copied" : ageOf(row.startedAt, view.now)
  const prefix = view.isFocused
    ? view.cursor === key
      ? FOCUS_MARK
      : NO_MARK
    : ""
  const { title, repo, pad } = rowLayoutOf(row, {
    columns: view.columns,
    prefix,
    tail,
  })
  const children = [
    prefix ? Text({ children: [prefix] }) : null,
    Text({ ...STATE_COLORS[row.state], children: [GLYPHS[row.state]] }),
    Text({ children: [GLYPH_GAP] }),
    Button({
      key,
      label: title,
      plain: true,
      ...(view.isFirst ? { autoFocus: true } : {}),
      onPress: (press) => {
        if (!row.sessionId) return
        return view.canOpen
          ? openInIterm($, row, press.surface)
          : copyRow($, row, press.surface)
      },
    }),
    repo ? Text({ dimColor: true, children: [` · ${repo}`] }) : null,
    Text({ children: [" ".repeat(pad)] }),
    Text({ dimColor: true, children: [tail] }),
  ].filter(Boolean)
  return Box({ children })
}

const overflowView = ({ Text }, overflow, isFocused) =>
  Text({
    dimColor: true,
    children: [
      isFocused
        ? `${FOCUSED_INDENT}+${overflow} more`
        : `${IDLE_INDENT}+${overflow} more · ctrl+x tab`,
    ],
  })

const footerView = ({ Box, Text, Button }, $, rows, view) => {
  if (!view.canOpen)
    return Text({ dimColor: true, children: [`${NO_MARK}${FOOTER_COPY}`] })
  const copyCursor = async (press) => {
    const { cursor } = await read($, focus)
    const row = rows.find((candidate) => rowKeyOf(candidate) === cursor)
    if (row) await copyRow($, row, press.surface)
  }
  return Box({
    children: [
      Text({ dimColor: true, children: [`${NO_MARK}enter open · `] }),
      Button({
        key: COPY_KEY,
        label: "copy",
        hotkey: "c",
        plain: true,
        dimColor: true,
        onPress: copyCursor,
      }),
      Text({ dimColor: true, children: [" · esc back"] }),
    ],
  })
}

export const register = (on) => {
  on("session.start", async ($, e, next) => {
    const path = registryPathOf(
      await $.env.get("MCP_OPENCODE_STATE_DIR"),
      await $.env.get("HOME"),
    )
    $.clock.every(POLL_MS, () => {
      void poll($, path)
    })
    void poll($, path)
    return next(e)
  })

  // The band has no "focused" prop: the ring landing on one of our rows is the
  // sign it took the keyboard, and the person editing the prompt that it left.
  on("ui.focus", { component: "AbovePrompt" }, async ($, e, next) => {
    const result = await next(e)
    if (result?.deny) return result
    const isOurs = e.plugin === "opencode"
    if (isOurs && e.element === COPY_KEY) return result
    if (!isOurs || !isRowKey(e.element)) {
      if (isFocusedMirror) await leaveFocus($)
      return result
    }
    const { rows } = await read($, jobs)
    await setFocus($, (value) => ({
      ...value,
      isFocused: true,
      order: value.isFocused ? value.order : rows.map(rowKeyOf),
      cursor: e.element,
    }))
    return result
  })

  on("prompt.edit", async ($, e, next) => {
    if (isFocusedMirror) await leaveFocus($)
    return next(e)
  })

  on("prompt.submit", async ($, e, next) => {
    if (isFocusedMirror) await leaveFocus($)
    return next(e)
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { rows, updatedAt } = await read($, jobs)
    if (rows.length === 0) return next(e)

    const elements = $.ui.resolve(e)
    const { Box } = elements
    const focused = await read($, focus)
    const isFocused = focused.isFocused
    const canOpen = canOpenIn(e.surface, await $.env.get("TERM_PROGRAM"))
    const { shown, overflow } = isFocused
      ? focusedSliceOf(rows, focused.order, e.props.maxRows)
      : idleSliceOf(rows, e.props.maxRows)

    const lines = shown.map((row, index) =>
      rowView(elements, $, row, {
        columns: e.props.bodyColumns,
        now: updatedAt,
        isFocused,
        isFirst: index === 0,
        cursor: focused.cursor,
        copied: focused.copied,
        canOpen,
      }),
    )
    if (overflow > 0) lines.push(overflowView(elements, overflow, isFocused))
    if (isFocused) lines.push(footerView(elements, $, rows, { canOpen }))

    const below = await next(e)
    return Box({
      flexDirection: "column",
      children: below ? [...lines, below] : lines,
    })
  })
}
