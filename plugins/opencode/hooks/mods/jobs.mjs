import { atom, read, update } from "claude-code"

export const PANE = "opencode-jobs"
export const COMMAND = "opencode-jobs"
export const POLL_MS = 5000
export const FETCH_TIMEOUT_MS = 1000
export const PANE_TITLE = "opencode jobs"
export const EMPTY_TOAST = "No headless opencode jobs"
export const EMPTY_LINES = [
  "No headless jobs",
  "Jobs started through mcp-opencode appear here.",
]
export const DESCRIPTION_ITERM =
  "Headless opencode jobs: open one in a new iTerm tab, or copy its attach command"
export const DESCRIPTION_COPY = "Headless opencode jobs: copy an attach command"

// A width the person kept or dragged the dock to wins over this request.
export const DOCK_COLUMNS = 52
export const INLINE_ROWS_MAX = 18
export const inlineRowsOf = (jobCount) =>
  Math.min(6 + 3 * jobCount, INLINE_ROWS_MAX)

const PANE_PADDING_X = 2
const HEADER_GAP = 2
const MAX_HOTKEYS = 9

export const DISPLAY_STATE_ORDER = { idle: 0, retry: 1, busy: 2, gone: 3 }
export const STATE_WORDS = {
  idle: "ready",
  retry: "retrying",
  busy: "running",
  gone: "gone",
}
export const STARTING_WORD = "starting"
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
const GONE = { isReachable: false }
const SESSION_ID_PATTERN = /^[A-Za-z0-9_]+$/

const jobs = atom(
  { plugin: "opencode", key: "jobs" },
  { rows: [], updatedAt: 0 },
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

export const wordOf = (row) =>
  row.state === "busy" && !row.sessionId
    ? STARTING_WORD
    : STATE_WORDS[row.state]

export const isActionable = (row) =>
  Boolean(row.sessionId) && row.state !== "gone"

const sessionsOf = (record) =>
  Array.isArray(record.sessions) && record.sessions.length > 0
    ? record.sessions
    : [{ id: null, title: "no session yet", startedAt: record.startedAt }]

export const rowsOf = (records, liveByPort) =>
  records
    .flatMap((record) => {
      const live = liveByPort[record.port] ?? GONE
      return sessionsOf(record).map((session) => ({
        port: record.port,
        repo: repoOf(record.directory),
        sessionId: session.id ?? null,
        title: session.title || "untitled",
        startedAt: session.startedAt ?? record.startedAt ?? "",
        state: stateOf(live, session.id),
      }))
    })
    .sort(
      (a, b) =>
        DISPLAY_STATE_ORDER[a.state] - DISPLAY_STATE_ORDER[b.state] ||
        (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0),
    )

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

const poll = async ($, path) => {
  if (isPolling) return
  isPolling = true
  try {
    const current = await readRecords($, path)
    const liveByPort = current.length > 0 ? await probeAll($, current) : {}
    const rows = rowsOf(current, liveByPort)
    const now = await $.clock.now()
    await update($, jobs, () => ({ rows, updatedAt: now }))
  } finally {
    isPolling = false
  }
}

const countByWord = (rows) => {
  const counts = { ready: 0, retrying: 0, running: 0 }
  for (const row of rows) {
    if (row.state === "idle") counts.ready++
    else if (row.state === "retry") counts.retrying++
    else if (row.state === "busy") counts.running++
  }
  return counts
}

export const headerCountsOf = (rows, room) => {
  if (rows.length < 2) return ""
  const counts = countByWord(rows)
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([word, count]) => `${count} ${word}`)
  while (parts.length > 0 && parts.join(" · ").length > room) parts.pop()
  return parts.join(" · ")
}

export const footerOf = (actionableCount, canOpen) => {
  if (actionableCount === 0) return "esc close"
  const last = Math.min(actionableCount, MAX_HOTKEYS)
  const digits = last === 1 ? "1" : `1–${last}`
  return canOpen
    ? `${digits} open in iTerm · tab to copy · esc close`
    : `${digits} copy attach · esc close`
}

const innerColumnsOf = (bodyColumns) =>
  Math.max(1, bodyColumns - 2 * PANE_PADDING_X)

const headerView = ({ Box, Text }, rows, bodyColumns) => {
  const inner = innerColumnsOf(bodyColumns)
  const counts = headerCountsOf(rows, inner - PANE_TITLE.length - HEADER_GAP)
  return Box({
    flexDirection: "column",
    marginBottom: 1,
    children: [
      Box({
        justifyContent: "space-between",
        children: [
          Text({ bold: true, children: [PANE_TITLE] }),
          counts ? Text({ dimColor: true, children: [counts] }) : null,
        ].filter(Boolean),
      }),
      Text({ dimColor: true, children: ["─".repeat(inner)] }),
    ],
  })
}

const footerView = ({ Box, Text }, text) =>
  Box({
    marginTop: 1,
    children: [Text({ dimColor: true, children: [text] })],
  })

const copyAttach = ($, row, surface) =>
  $.ui.copy({ text: attachCommandOf(row.port, row.sessionId), surface })

const didRunOsascript = async ($, script) => {
  try {
    const { exitCode } = await $.process.run(["osascript", "-e", script])
    return exitCode === 0
  } catch {
    return false
  }
}

const openInIterm = async ($, row, press) => {
  const script = openScriptOf(row.port, row.sessionId)
  if (!script) {
    $.ui.toast(`Refused to open ${row.repo}: unexpected session id or port`)
    return
  }
  if (await didRunOsascript($, script)) {
    $.ui.toast(`Opened ${row.repo} in a new iTerm tab`)
    return
  }
  const copied = await copyAttach($, row, press.surface)
  $.ui.toast(
    copied.isCopied
      ? "Couldn't open iTerm, attach command copied"
      : `Couldn't open iTerm, and not copied: ${copied.reason}`,
  )
}

const copyButtonOf = ({ Button }, $, row, hotkey, isSecondary) =>
  Button({
    key: `copy:${row.port}:${row.sessionId}`,
    label: "copy",
    plain: true,
    ...(isSecondary ? { dimColor: true } : {}),
    ...(hotkey ? { hotkey } : {}),
    onPress: async (press) => {
      const copied = await copyAttach($, row, press.surface)
      $.ui.toast(
        copied.isCopied
          ? `Copied attach command for ${row.repo}`
          : `not copied: ${copied.reason}`,
      )
    },
  })

const actionsView = (elements, $, row, hotkey, canOpen) => {
  const { Box, Button } = elements
  const buttons = canOpen
    ? [
        Button({
          key: `open:${row.port}:${row.sessionId}`,
          label: "open",
          plain: true,
          ...(hotkey ? { hotkey } : {}),
          onPress: (press) => openInIterm($, row, press),
        }),
        copyButtonOf(elements, $, row, undefined, true),
      ]
    : [copyButtonOf(elements, $, row, hotkey, false)]
  return Box({
    flexDirection: "column",
    flexShrink: 0,
    paddingLeft: 2,
    children: buttons,
  })
}

const rowView = (elements, $, row, hotkey, now, canOpen) => {
  const { Box, Text } = elements
  const isGone = row.state === "gone"
  const dim = isGone ? { dimColor: true } : {}
  const stateColor = STATE_COLORS[row.state]

  const titleLine = Box({
    children: [
      Text({ ...stateColor, children: [GLYPHS[row.state]] }),
      Box({
        paddingLeft: 2,
        flexShrink: 1,
        minWidth: 0,
        children: [
          Text({ ...dim, wrap: "truncate-end", children: [row.title] }),
        ],
      }),
    ],
  })

  const factsLine = Box({
    paddingLeft: 3,
    children: [
      Box({
        flexShrink: 1,
        minWidth: 0,
        children: [
          Text({ dimColor: true, wrap: "truncate-end", children: [row.repo] }),
        ],
      }),
      Text({ dimColor: true, children: [" · "] }),
      Text({ ...stateColor, children: [wordOf(row)] }),
      Text({
        dimColor: true,
        children: [` · ${ageOf(row.startedAt, now)}`],
      }),
    ],
  })

  return Box({
    children: [
      Box({
        flexDirection: "column",
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        children: [titleLine, factsLine],
      }),
      isActionable(row) ? actionsView(elements, $, row, hotkey, canOpen) : null,
    ].filter(Boolean),
  })
}

export const summaryText = (rows) =>
  rows.length === 0
    ? EMPTY_TOAST
    : rows
        .map(
          (row) =>
            `${GLYPHS[row.state]} ${wordOf(row)} ${row.repo} ${row.title}`,
        )
        .join("\n")

const hotkeysOf = (rows) => {
  let next = 0
  return rows.map((row) => {
    if (!isActionable(row)) return undefined
    next += 1
    return next <= MAX_HOTKEYS ? String(next) : undefined
  })
}

export const register = (on) => {
  on("session.start", async ($, e, next) => {
    const canOpen = canOpenIn(e.surface, await $.env.get("TERM_PROGRAM"))
    await $.command.register({
      name: COMMAND,
      description: canOpen ? DESCRIPTION_ITERM : DESCRIPTION_COPY,
    })
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

  on("command.run", { command: COMMAND }, async ($) => {
    const { rows } = await read($, jobs)
    if (rows.length === 0) {
      $.ui.toast(EMPTY_TOAST)
      return {}
    }
    const opened = await $.ui.open({
      id: PANE,
      title: PANE_TITLE,
      focus: true,
      closeOnEscape: true,
      columns: DOCK_COLUMNS,
      rows: inlineRowsOf(rows.length),
    })
    if (opened.isPlaced) return {}
    return { text: summaryText(rows) }
  })

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const { rows, updatedAt } = await read($, jobs)
    const bodyColumns = e.props.bodyColumns
    const root = (children) =>
      Box({
        flexDirection: "column",
        paddingX: PANE_PADDING_X,
        paddingTop: 1,
        paddingBottom: 1,
        children,
      })

    if (rows.length === 0) {
      return root([
        headerView(elements, rows, bodyColumns),
        Box({
          flexDirection: "column",
          children: EMPTY_LINES.map((line) =>
            Text({ dimColor: true, children: [line] }),
          ),
        }),
        footerView(elements, footerOf(0, false)),
      ])
    }

    const canOpen = canOpenIn(e.surface, await $.env.get("TERM_PROGRAM"))
    const hotkeys = hotkeysOf(rows)
    const actionableCount = rows.filter(isActionable).length
    return root([
      headerView(elements, rows, bodyColumns),
      Box({
        flexDirection: "column",
        rowGap: 1,
        children: rows.map((row, index) =>
          rowView(elements, $, row, hotkeys[index], updatedAt, canOpen),
        ),
      }),
      footerView(elements, footerOf(actionableCount, canOpen)),
    ])
  })
}
