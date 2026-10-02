import { atom, read, update } from "claude-code"

export const PANE = "opencode-jobs"
export const COMMAND = "opencode-jobs"
export const POLL_MS = 5000
export const FETCH_TIMEOUT_MS = 1000
export const EMPTY_LINE = "no headless opencode jobs"

export const DISPLAY_STATE_ORDER = { idle: 0, retry: 1, busy: 2, gone: 3 }
export const STATE_WORDS = {
  idle: "ready",
  retry: "retrying",
  busy: "running",
  gone: "gone",
}
export const GLYPHS = { idle: "✓", retry: "⚠", busy: "◌", gone: "" }
const GONE = { isReachable: false }

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
  const type = live.statuses[sessionId]?.type
  return type === "busy" || type === "retry" ? type : "idle"
}

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

const countByState = (rows) => {
  const counts = { idle: 0, retry: 0, busy: 0, gone: 0 }
  for (const row of rows) counts[row.state]++
  return counts
}

const headerView = ({ Box, Text }, rows) => {
  const counts = countByState(rows)
  const parts = []
  if (counts.idle) parts.push(`${counts.idle} ready`)
  if (counts.retry) parts.push(`${counts.retry} retrying`)
  if (counts.busy) parts.push(`${counts.busy} running`)
  return Box({
    justifyContent: "space-between",
    children: [
      Text({ bold: true, children: ["opencode jobs"] }),
      Text({ dimColor: true, children: [parts.join(" · ")] }),
    ],
  })
}

const rowView = ({ Box, Text, Button }, $, row, displayIndex, now) => {
  const isGone = row.state === "gone"
  const stateWord = STATE_WORDS[row.state]
  const glyph = GLYPHS[row.state]
  const leftLabel = glyph ? `${glyph} ${stateWord}` : stateWord
  const paddedLeft = leftLabel.padEnd(9)
  const hotkey = displayIndex < 9 ? String(displayIndex + 1) : undefined

  const line1Left = Box({
    columnGap: 1,
    children: [
      Text({
        bold: row.state === "idle",
        dimColor: row.state === "busy" || row.state === "gone",
        ...(row.state === "retry" ? { color: "yellow" } : {}),
        children: [paddedLeft],
      }),
      Text({
        dimColor: isGone,
        bold: row.state === "idle",
        children: [row.repo],
      }),
    ],
  })

  const line1Right = Text({
    dimColor: true,
    children: [`${ageOf(row.startedAt, now)} :${row.port}`],
  })

  const line2Left = Text({
    dimColor: isGone,
    wrap: "truncate-end",
    children: [`  ${row.title}`],
  })

  const line2Right =
    row.sessionId && !isGone
      ? Button({
          key: `attach:${row.port}:${row.sessionId}`,
          label: "copy attach",
          plain: true,
          ...(hotkey ? { hotkey } : {}),
          onPress: async (press) => {
            const copied = await $.ui.copy({
              text: attachCommandOf(row.port, row.sessionId),
              surface: press.surface,
            })
            $.ui.toast(
              copied.isCopied
                ? `Copied attach for ${row.repo}`
                : `not copied: ${copied.reason}`,
            )
          },
        })
      : null

  return Box({
    flexDirection: "column",
    children: [
      Box({
        justifyContent: "space-between",
        children: [line1Left, line1Right],
      }),
      Box({
        justifyContent: "space-between",
        children: [line2Left, line2Right].filter(Boolean),
      }),
    ],
  })
}

export const summaryText = (rows) =>
  rows.length === 0
    ? EMPTY_LINE
    : rows
        .map(
          (row) =>
            `${GLYPHS[row.state] ? GLYPHS[row.state] + " " : ""}${STATE_WORDS[row.state]} ${row.repo} :${row.port} ${row.title}`,
        )
        .join("\n")

export const register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: "List headless opencode jobs and copy an attach command",
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
      $.ui.toast("No headless opencode jobs")
      return {}
    }
    const opened = await $.ui.open({
      id: PANE,
      title: "opencode jobs",
      focus: true,
      closeOnEscape: true,
      columns: 48,
      rows: Math.min(3 + 3 * rows.length, 14),
    })
    if (opened.isPlaced) return {}
    return { text: summaryText(rows) }
  })

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const { rows, updatedAt } = await read($, jobs)
    if (rows.length === 0) {
      return Box({
        flexDirection: "column",
        children: [
          headerView(elements, rows),
          Text({ dimColor: true, children: ["nothing running"] }),
        ],
      })
    }
    return Box({
      flexDirection: "column",
      rowGap: 1,
      children: [
        headerView(elements, rows),
        ...rows.map((row, index) =>
          rowView(elements, $, row, index, updatedAt),
        ),
      ],
    })
  })
}
