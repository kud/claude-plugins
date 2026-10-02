import type { On, RenderInput } from "claude-code"
import { describe, expect, mock, test } from "claude-code/testing"

import {
  attachCommandOf,
  ageOf,
  parseRegistry,
  registryPathOf,
  rowsOf,
  summaryText,
} from "../hooks/mods/jobs.mjs"

const HOME = "/home/acme"
const REGISTRY = `${HOME}/.local/state/mcp-opencode/instances.json`
const NOW = Date.parse("2026-10-02T12:00:00.000Z")

const INSTANCES = [
  {
    runtime: "opencode",
    port: 53817,
    pid: 4101,
    mcpPid: 4100,
    directory: "/work/acme/api-gateway",
    startedAt: "2026-10-02T11:00:00.000Z",
    sessions: [
      {
        id: "ses_old",
        title: "fix flaky retry test",
        model: "m",
        startedAt: "2026-10-02T11:00:00.000Z",
      },
      {
        id: "ses_new",
        title: "add rate limit header",
        model: "m",
        startedAt: "2026-10-02T11:50:00.000Z",
      },
    ],
  },
  {
    runtime: "opencode",
    port: 53900,
    pid: 4201,
    mcpPid: 4200,
    directory: "/work/acme/web-shop/",
    startedAt: "2026-10-02T11:30:00.000Z",
    sessions: [
      {
        id: "ses_web",
        title: "tidy checkout copy",
        model: "m",
        startedAt: "2026-10-02T11:30:00.000Z",
      },
    ],
  },
  {
    runtime: "opencode",
    port: 54000,
    pid: 4301,
    mcpPid: 4300,
    directory: "/work/acme/docs",
    startedAt: "2026-10-02T10:00:00.000Z",
    sessions: [
      {
        id: "ses_dead",
        title: "rewrite the intro",
        model: "m",
        startedAt: "2026-10-02T10:00:00.000Z",
      },
    ],
  },
]

const STATUSES: Record<number, string> = {
  53817: JSON.stringify({ ses_new: { type: "busy" } }),
  53900: JSON.stringify({
    ses_web: { type: "retry", attempt: 2, message: "rate limited", next: 0 },
  }),
}

const PANE: RenderInput<"Pane"> = {
  component: "Pane",
  surface: "terminal",
  requestId: "opencode-jobs",
  viewport: { columns: 160, rows: 40 },
  props: {
    title: "opencode jobs",
    isFocused: true,
    bodyColumns: 70,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

const PANE_48: RenderInput<"Pane"> = {
  ...PANE,
  viewport: { columns: 48, rows: 40 },
  props: { ...PANE.props, bodyColumns: 48 },
}

function textOf(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree)
  if (Array.isArray(tree)) return tree.map(textOf).join("")
  if (typeof tree !== "object" || !tree) return ""
  const props: unknown = Reflect.get(tree, "props")
  const label =
    typeof props === "object" &&
    props &&
    typeof Reflect.get(props, "label") === "string"
      ? `[${Reflect.get(props, "label")}]`
      : ""
  const children =
    Reflect.get(tree, "children") ??
    (props && Reflect.get(props as object, "children")) ??
    []
  return `${label}${textOf(children)}\n`
}

function cellsOf(node: any): string {
  if (typeof node === "string") return node
  if (node?.type === "Button") return `[${node.props.label}]`
  const children: unknown[] = node?.children ?? node?.props?.children ?? []
  const separator = node?.props?.columnGap ? " ".repeat(node.props.columnGap) : ""
  return children.map(cellsOf).join(node?.type === "Text" ? "" : separator)
}

function lineAt(columns: number, spaceBetween: any): string {
  const [left, right] = spaceBetween.children
  const leftCells = cellsOf(left)
  const rightCells = right ? cellsOf(right) : ""
  return leftCells.padEnd(columns - rightCells.length) + rightCells
}

function world(
  on: On,
  registry: unknown[] | null,
  { isHanging = false, live: customLive = {} }: { isHanging?: boolean; live?: Record<string, any> } = {},
) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME })
  const fetched: string[] = []
  const releases: (() => void)[] = []
  const counts = { reads: 0 }
  const toasts: string[] = []
  const copied: string[] = []
  const opens: Array<{ id: string; columns?: number; rows?: number }> = []

  on("session.start", ($, e) => ({ cwd: e.cwd }))
  on("command.register", ($, e) => ({ value: undefined }))
  on("fs.stat", ($, e) =>
    registry && e.path === REGISTRY
      ? { value: { kind: "file", size: 100, mtimeMs: 1, isLink: false } }
      : { deny: "ENOENT" },
  )
  on("fs.read", ($, e) => {
    counts.reads += 1
    return registry && e.path === REGISTRY
      ? { value: JSON.stringify(registry) }
      : { deny: "ENOENT" }
  })
  on("http.fetch", async ($, e) => {
    fetched.push(e.url)
    if (isHanging) await new Promise<void>((resolve) => releases.push(resolve))
    const port = Number(new URL(e.url).port)
    const text = customLive[port] ? JSON.stringify(customLive[port].statuses) : STATUSES[port]
    if (text === undefined) return { deny: "ECONNREFUSED" }
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  on("ui.open", ($, e) => {
    opens.push({ id: e.id, columns: e.columns, rows: e.rows })
    return { value: { isPlaced: false } }
  })
  on("ui.copy", ($, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on("ui.toast", ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return { clock, fetched, toasts, copied, releases, counts, opens }
}

const START = {
  surface: "terminal",
  isInteractive: true,
  cwd: "/work",
} as const

describe("jobs", () => {
  test("the registry path honours MCP_OPENCODE_STATE_DIR", async () => {
    expect(registryPathOf(undefined, HOME)).toBe(REGISTRY)
    expect(registryPathOf("/tmp/oc-state", HOME)).toBe(
      "/tmp/oc-state/instances.json",
    )
  })

  test("parsing keeps well-formed entries and survives garbage", async () => {
    expect(parseRegistry(JSON.stringify(INSTANCES))).toHaveLength(3)
    expect(parseRegistry("{ not json")).toEqual([])
    expect(parseRegistry('{"port": 1}')).toEqual([])
    expect(
      parseRegistry(JSON.stringify([{ port: "x" }, INSTANCES[0]])),
    ).toHaveLength(1)
  })

  test("the attach command names the port and the session", async () => {
    expect(attachCommandOf(53817, "ses_new")).toBe(
      "opencode attach http://127.0.0.1:53817 --session ses_new",
    )
  })

  test("rows sort ready first, then retrying, running and gone, newest first within a state", async () => {
    const live = {
      53817: { isReachable: true, statuses: { ses_new: { type: "busy" } } },
      53900: { isReachable: true, statuses: { ses_web: { type: "retry" } } },
    }
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), live)
    expect(
      rows.map((row: { sessionId: string; state: string; repo: string }) => [
        row.sessionId,
        row.state,
        row.repo,
      ]),
    ).toEqual([
      ["ses_old", "idle", "api-gateway"],
      ["ses_web", "retry", "web-shop"],
      ["ses_new", "busy", "api-gateway"],
      ["ses_dead", "gone", "docs"],
    ])
    expect(ageOf("2026-10-02T11:50:00.000Z", NOW)).toBe("10m")
    expect(ageOf("2026-10-02T10:00:00.000Z", NOW)).toBe("2h")
  })

  test("summaryText uses new state words and no gone glyph", async () => {
    const live = {
      53817: { isReachable: true, statuses: { ses_new: { type: "busy" } } },
      53900: { isReachable: true, statuses: { ses_web: { type: "retry" } } },
    }
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), live)
    const text = summaryText(rows)
    expect(text).toContain("✓ ready")
    expect(text).toContain("⚠ retrying")
    expect(text).toContain("◌ running")
    expect(text).toContain("gone")
    expect(text).not.toContain("· gone")
    expect(text).not.toContain("◌ busy")
    expect(text).not.toMatch(/⚠ retry\b/)
    expect(text).not.toContain("✓ idle")
  })

  test("an empty registry draws header + nothing running and makes no request", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()
    await w.clock.advance(15000)

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).not.toContain("opencode jobs")
    expect(drawn).toContain("nothing running")
    expect(w.fetched).toEqual([])
  })

  test("a missing registry is the empty state too", async ($, on) => {
    const w = world(on, null)
    await $.session.start(START)
    await w.clock.settle()

    expect(textOf(await $.ui.render(PANE))).toContain("nothing running")
    expect(w.fetched).toEqual([])
  })

  test("command.run with 0 rows toasts and never calls ui.open", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()

    await $.command.run({
      command: "opencode-jobs",
      args: "",
      origin: { kind: "composer" },
    })

    expect(w.toasts).toContain("No headless opencode jobs")
    expect(w.opens).toHaveLength(0)
  })

  test("command.run with rows calls ui.open with columns 48 and rows min(3+3n,14)", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.command.run({
      command: "opencode-jobs",
      args: "",
      origin: { kind: "composer" },
    })

    expect(w.opens).toHaveLength(1)
    expect(w.opens[0].columns).toBe(48)
    expect(w.opens[0].rows).toBe(Math.min(3 + 3 * 4, 14))
  })

  test("the pane lists every job, the dead port as gone, in display order", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).toContain("✓ ready")
    expect(drawn).toContain("⚠ retrying")
    expect(drawn).toContain("◌\n running")
    expect(drawn).toContain("gone")
    expect(drawn).toContain("add rate limit header")
    expect(drawn.indexOf("✓ ready")).toBeLessThan(drawn.indexOf("◌\n running"))
    expect(w.fetched).toContain(
      "http://127.0.0.1:53817/session/status?directory=%2Fwork%2Facme%2Fapi-gateway",
    )
  })

  test("header shows counts omitting zero parts, left-aligned, no title", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).toContain("1 ready · 1 retrying · 1 running")
    expect(drawn).not.toContain("2 running")
    expect(drawn).not.toContain("opencode jobs")
  })

  test("button hotkeys 1..n follow on-screen order and render copy attach labels", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const rendered = await $.ui.render(PANE)
    const renderedStr = JSON.stringify(rendered)

    expect(renderedStr).toContain('"label":"copy attach"')
    expect(renderedStr).toContain('"hotkey":"1"')
    expect(renderedStr).toContain('"hotkey":"2"')
    expect(renderedStr).toContain('"hotkey":"3"')
  })

  test("button appears on line 2, not line 1", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const rendered = await $.ui.render(PANE)
    const rowBox = rendered.children?.[1]
    expect(rowBox).toBeDefined()
    expect(rowBox.type).toBe("Box")
    expect(rowBox.props?.flexDirection).toBe("column")
    const line1 = rowBox.children?.[0]
    const line2 = rowBox.children?.[1]
    expect(line1).toBeDefined()
    expect(line2).toBeDefined()
    const line1Str = JSON.stringify(line1)
    const line2Str = JSON.stringify(line2)
    expect(line1Str).toContain(":53817")
    expect(line1Str).not.toContain("copy attach")
    expect(line2Str).toContain("copy attach")
    expect(line2Str).toContain("fix flaky retry test")
  })

  test("copy puts the attach command on the clipboard and toasts with repo", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.command.run({
      command: "opencode-jobs",
      args: "",
      origin: { kind: "composer" },
    })
    await $.ui.render(PANE)
    await $.ui.press({ plugin: "opencode", key: "attach:53817:ses_new" })

    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53817 --session ses_new",
    ])
    expect(w.toasts).toContain("Copied attach for api-gateway")
  })

  test("a gone row offers nothing to copy", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = JSON.stringify(await $.ui.render(PANE))
    expect(drawn).not.toContain("attach:54000:ses_dead")
    expect(drawn).toContain("attach:53900:ses_web")
  })

  test("a port that does not answer within a second is gone", async ($, on) => {
    const w = world(on, INSTANCES, { isHanging: true })
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).not.toContain("◌\n running")
    expect(drawn).toContain("gone")
    expect(drawn).not.toMatch(/\d+ (ready|retrying|running)/)
    w.releases.forEach((release) => release())
  })

  test("the registry is re-read only when it changes", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()
    await w.clock.advance(10000)
    await w.clock.settle()

    expect(w.counts.reads).toBe(1)
    expect(w.fetched.length).toBeGreaterThan(3)
  })

  test("a ready row lays out as two exact 48-column lines with space before age", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.settle()

    const rendered = await $.ui.render(PANE_48)
    const [line1, line2] = rendered.children?.[1].children ?? []

    expect(lineAt(48, line1)).toBe(
      "✓ ready   api-gateway                  1h :53817",
    )
    expect(lineAt(48, line2)).toBe(
      "  fix flaky retry test             [copy attach]",
    )
  })

  test("rowView uses theme keys: idle=success+bold, retry=warning, busy=suggestion, gone=dimColor", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const rendered = await $.ui.render(PANE)
    const json = JSON.stringify(rendered)

    // idle row (ready) has color:success and bold
    expect(json).toContain('"color":"success"')
    expect(json).toContain('"bold":true')

    // retry row has color:warning (not yellow)
    expect(json).toContain('"color":"warning"')
    expect(json).not.toContain('"color":"yellow"')

    // busy row: only the glyph carries color:suggestion, the word is uncoloured
    expect(json).toContain('{"type":"Text","props":{"color":"suggestion"},"children":["◌"]}')
    expect(json).toContain('{"type":"Text","children":[" running"]}')

    // gone row has dimColor on the whole row (both line1 and line2 Text elements)
    expect(json).toContain('"dimColor":true')
  })

  test("long repo name truncates with space before age", async ($, on) => {
    const longRepoInstances = [
      {
        runtime: "opencode",
        port: 55555,
        pid: 9999,
        mcpPid: 9998,
        directory: "/work/acme/very-long-repository-name-that-exceeds-48-columns",
        startedAt: "2026-10-02T11:55:00.000Z",
        sessions: [{ id: "ses_long", title: "long repo test", model: "m", startedAt: "2026-10-02T11:55:00.000Z" }],
      },
    ]
    const live = { 55555: { isReachable: true, statuses: { ses_long: { type: "idle" } } } }
    const w = world(on, longRepoInstances, { live })
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const rendered = await $.ui.render(PANE_48)
    const json = JSON.stringify(rendered)

    // line1Right contains age and port with space before age
    expect(json).toContain("5m :55555")
    // repo Text has wrap: truncate-end
    expect(json).toContain('"wrap":"truncate-end"')
    // line1 structure has left and right boxes
    expect(json).toContain('"type":"Box"')
  })
})
