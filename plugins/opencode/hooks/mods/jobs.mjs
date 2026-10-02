import { atom, read, update } from "claude-code"

export const PANE = "opencode-jobs"
export const COMMAND = "opencode-jobs"
export const STORE_KEY = "opencode/jobs"
export const POLL_MS = 5000
export const FETCH_TIMEOUT_MS = 1000
export const STORE_HEARTBEAT_MS = 30000
export const EMPTY_LINE = "no headless opencode jobs"

const STATE_ORDER = { busy: 0, retry: 1, idle: 2, gone: 3 }
const GLYPHS = { idle: "✓", busy: "◌", retry: "⚠", gone: "·" }
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
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0),
    )

const jobOf = ({ port, sessionId, title, repo }) => ({
  port,
  sessionId,
  title,
  repo,
})

export const summaryOf = (rows, updatedAt) => {
  const attachable = rows.filter((row) => row.sessionId)
  return {
    updatedAt,
    ready: attachable.filter((row) => row.state === "idle").map(jobOf),
    running: attachable
      .filter((row) => row.state === "busy" || row.state === "retry")
      .map(jobOf),
  }
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
let lastPublished = null
let lastPublishedAt = 0
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

const publish = async ($, rows, now) => {
  const summary = summaryOf(rows, now)
  const signature = JSON.stringify([summary.ready, summary.running])
  const isStale = now - lastPublishedAt >= STORE_HEARTBEAT_MS
  if (signature === lastPublished && (rows.length === 0 || !isStale)) return
  await $.store.set(STORE_KEY, summary)
  lastPublished = signature
  lastPublishedAt = now
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
    await publish($, rows, now)
  } finally {
    isPolling = false
  }
}

const rowView = ({ Box, Text, Button }, $, row, index, now) => {
  const isGone = row.state === "gone"
  const hotkey = index < 9 ? String(index + 1) : undefined
  const head = [
    Text({
      bold: row.state === "idle",
      dimColor: row.state === "busy" || isGone,
      children: [`${GLYPHS[row.state]} ${row.state.padEnd(5)}`],
    }),
    Text({
      dimColor: isGone,
      bold: row.state === "idle",
      children: [row.repo],
    }),
    Text({
      dimColor: true,
      children: [`${ageOf(row.startedAt, now)} :${row.port}`],
    }),
  ]
  if (row.sessionId && !isGone) {
    const command = attachCommandOf(row.port, row.sessionId)
    head.push(
      Button({
        key: `attach:${row.port}:${row.sessionId}`,
        label: "copy",
        plain: true,
        ...(hotkey ? { hotkey } : {}),
        onPress: async (press) => {
          const copied = await $.ui.copy({
            text: command,
            surface: press.surface,
          })
          $.ui.toast(
            copied.isCopied ? "copied" : `not copied: ${copied.reason}`,
          )
        },
      }),
    )
  }
  return Box({
    flexDirection: "column",
    children: [
      Box({ flexDirection: "row", columnGap: 2, children: head }),
      Text({
        dimColor: isGone,
        wrap: "truncate",
        children: [`  ${row.title}`],
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
            `${GLYPHS[row.state]} ${row.state} ${row.repo} :${row.port} ${row.title}`,
        )
        .join("\n")

export const register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: "List headless opencode jobs and copy an attach command",
    })
    const path = registryPathOf(
      await $.env.get('MCP_OPENCODE_STATE_DIR'),
      await $.env.get('HOME'),
    )
    $.clock.every(POLL_MS, () => {
      void poll($, path)
    })
    void poll($, path)
    return next(e)
  })

  on("command.run", { command: COMMAND }, async ($) => {
    const opened = await $.ui.open({
      id: PANE,
      title: "opencode jobs",
      focus: true,
      closeOnEscape: true,
    })
    if (opened.isPlaced) return {}
    const { rows } = await read($, jobs)
    return { text: summaryText(rows) }
  })

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const { rows, updatedAt } = await read($, jobs)
    if (rows.length === 0) {
      return Text({ dimColor: true, children: [EMPTY_LINE] })
    }
    return Box({
      flexDirection: "column",
      rowGap: 1,
      children: rows.map((row, index) =>
        rowView(elements, $, row, index, updatedAt),
      ),
    })
  })
}
