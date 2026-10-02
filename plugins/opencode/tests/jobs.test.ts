import type { On, RenderInput } from "claude-code"
import { describe, expect, mock, test } from "claude-code/testing"

import {
  attachCommandOf,
  ageOf,
  parseRegistry,
  registryPathOf,
  rowsOf,
  summaryOf,
  STORE_KEY,
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

function world(
  on: On,
  registry: unknown[] | null,
  { isHanging = false }: { isHanging?: boolean } = {},
) {
  const clock = mock.clock(on, { now: NOW })
  const stored: Record<string, unknown> = {}
  on("store.set", ($, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  mock.env(on, { HOME })
  const fetched: string[] = []
  const releases: (() => void)[] = []
  const counts = { reads: 0 }
  const toasts: string[] = []
  const copied: string[] = []

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
    const text = STATUSES[port]
    if (text === undefined) return { deny: "ECONNREFUSED" }
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  on("ui.open", ($, e) => ({ value: { isPlaced: true } }))
  on("ui.copy", ($, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on("ui.toast", ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return { clock, fetched, toasts, copied, stored, releases, counts }
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

  test("rows sort busiest first, then newest, with a dead port gone", async () => {
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
      ["ses_new", "busy", "api-gateway"],
      ["ses_web", "retry", "web-shop"],
      ["ses_old", "idle", "api-gateway"],
      ["ses_dead", "gone", "docs"],
    ])
    expect(ageOf("2026-10-02T11:50:00.000Z", NOW)).toBe("10m")
    expect(ageOf("2026-10-02T10:00:00.000Z", NOW)).toBe("2h")
  })

  test("the summary splits ready from running and leaves gone out", async () => {
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), {
      53817: { isReachable: true, statuses: { ses_new: { type: "busy" } } },
    })
    expect(summaryOf(rows, NOW)).toEqual({
      updatedAt: NOW,
      ready: [
        {
          port: 53817,
          sessionId: "ses_old",
          title: "fix flaky retry test",
          repo: "api-gateway",
        },
      ],
      running: [
        {
          port: 53817,
          sessionId: "ses_new",
          title: "add rate limit header",
          repo: "api-gateway",
        },
      ],
    })
  })

  test("an empty registry draws one dim line and makes no request", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()
    await w.clock.advance(15000)

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).toContain("no headless opencode jobs")
    expect(w.fetched).toEqual([])
  })

  test("a missing registry is the empty state too", async ($, on) => {
    const w = world(on, null)
    await $.session.start(START)
    await w.clock.settle()

    expect(textOf(await $.ui.render(PANE))).toContain(
      "no headless opencode jobs",
    )
    expect(w.fetched).toEqual([])
  })

  test("the pane lists every job, the dead port as gone, and publishes the summary", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).toContain("◌ busy")
    expect(drawn).toContain("⚠ retry")
    expect(drawn).toContain("✓ idle")
    expect(drawn).toContain("· gone")
    expect(drawn).toContain("add rate limit header")
    expect(drawn.indexOf("◌ busy")).toBeLessThan(drawn.indexOf("✓ idle"))
    expect(w.fetched).toContain(
      "http://127.0.0.1:53817/session/status?directory=%2Fwork%2Facme%2Fapi-gateway",
    )

    expect(w.stored[STORE_KEY]).toEqual({
      updatedAt: NOW,
      ready: [
        {
          port: 53817,
          sessionId: "ses_old",
          title: "fix flaky retry test",
          repo: "api-gateway",
        },
      ],
      running: [
        {
          port: 53817,
          sessionId: "ses_new",
          title: "add rate limit header",
          repo: "api-gateway",
        },
        {
          port: 53900,
          sessionId: "ses_web",
          title: "tidy checkout copy",
          repo: "web-shop",
        },
      ],
    })
  })

  test("copy puts the attach command on the clipboard and toasts", async ($, on) => {
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
    expect(w.toasts).toEqual(["copied"])
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
    expect(drawn).not.toContain("◌ busy")
    expect(drawn).toContain("· gone")
    expect(w.stored[STORE_KEY]).toEqual({ updatedAt: NOW + 1000, ready: [], running: [] })
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
})
