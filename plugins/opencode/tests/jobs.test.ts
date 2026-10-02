import type { On, RenderInput } from "claude-code"
import { describe, expect, mock, test } from "claude-code/testing"

import {
  attachCommandOf,
  ageOf,
  footerOf,
  headerCountsOf,
  inlineRowsOf,
  openScriptOf,
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
    directory: "/work/acme/acme-web/",
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

const STARTING_INSTANCE = {
  runtime: "opencode",
  port: 54100,
  pid: 4401,
  mcpPid: 4400,
  directory: "/work/acme/api-gateway",
  startedAt: "2026-10-02T11:59:00.000Z",
  sessions: [],
}

const STATUSES: Record<number, string> = {
  53817: JSON.stringify({ ses_new: { type: "busy" } }),
  53900: JSON.stringify({
    ses_web: { type: "retry", attempt: 2, message: "rate limited", next: 0 },
  }),
  54100: JSON.stringify({}),
}

const PANE: RenderInput<"Pane"> = {
  component: "Pane",
  surface: "terminal",
  requestId: "opencode-jobs",
  viewport: { columns: 160, rows: 40 },
  props: {
    title: "opencode jobs",
    isFocused: true,
    bodyColumns: 52,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

const DESKTOP_PANE = {
  ...PANE,
  surface: "desktop",
} as unknown as RenderInput<"Pane">

type Node = { type?: string; props?: Record<string, any>; children?: unknown[] }

function textOf(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree)
  if (Array.isArray(tree)) return tree.map(textOf).join("")
  if (typeof tree !== "object" || !tree) return ""
  const node = tree as Node
  const label =
    typeof node.props?.label === "string"
      ? `[${node.props.hotkey ? `${node.props.hotkey}: ` : ""}${node.props.label}]`
      : ""
  const children = (node.children ?? node.props?.children ?? []) as unknown[]
  if (label) return label
  if (node.type === "Text") return textOf(children)
  const separator = node.props?.flexDirection === "column" ? "\n" : ""
  return children.map(textOf).join(separator)
}

function findAll(tree: unknown, match: (node: Node) => boolean): Node[] {
  if (typeof tree !== "object" || !tree) return []
  if (Array.isArray(tree)) return tree.flatMap((child) => findAll(child, match))
  const node = tree as Node
  const own = match(node) ? [node] : []
  return [
    ...own,
    ...findAll(node.children ?? node.props?.children ?? [], match),
  ]
}

const buttonsOf = (tree: unknown) =>
  findAll(tree, (node) => node.type === "Button").map(
    (node) => node.props ?? {},
  )

function world(
  on: On,
  registry: unknown[] | null,
  {
    isHanging = false,
    termProgram = "iTerm.app",
    osascriptExit = 0,
  }: { isHanging?: boolean; termProgram?: string; osascriptExit?: number } = {},
) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME, TERM_PROGRAM: termProgram })
  const fetched: string[] = []
  const releases: (() => void)[] = []
  const counts = { reads: 0 }
  const toasts: string[] = []
  const copied: string[] = []
  const ran: (readonly string[])[] = []
  const commands: { name: string; description: string }[] = []
  const opens: Array<{ id: string; columns?: number; rows?: number }> = []

  on("session.start", ($, e) => ({ cwd: e.cwd }))
  on("command.register", ($, e) => {
    commands.push({ name: e.name, description: e.description ?? "" })
    return { value: { command: e.name } }
  })
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
    const text = STATUSES[Number(new URL(e.url).port)]
    if (text === undefined) return { deny: "ECONNREFUSED" }
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  on("process.run", ($, e) => {
    ran.push(e.argv)
    return {
      value: {
        exitCode: osascriptExit,
        stdout: "",
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on("ui.open", ($, e) => {
    opens.push({ id: e.id, columns: e.columns, rows: e.rows })
    return { value: { isPlaced: true } }
  })
  on("ui.copy", ($, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on("ui.toast", ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return {
    clock,
    fetched,
    toasts,
    copied,
    releases,
    counts,
    opens,
    ran,
    commands,
  }
}

const START = {
  surface: "terminal",
  isInteractive: true,
  cwd: "/work",
} as const

const RUN = {
  command: "opencode-jobs",
  args: "",
  origin: { kind: "composer" },
  presentation: { isFullscreen: true, columns: 160 },
} as const

const LIVE = {
  53817: { isReachable: true, statuses: { ses_new: { type: "busy" } } },
  53900: { isReachable: true, statuses: { ses_web: { type: "retry" } } },
}

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

  test("the iTerm script carries the attach command and refuses unsafe input", async () => {
    const script = openScriptOf(53817, "ses_new")
    expect(script).toContain('tell application "iTerm2"')
    expect(script).toContain(
      "if (count of windows) = 0 then create window with default profile",
    )
    expect(script).toContain("create tab with default profile")
    expect(script).toContain(
      'tell current session to write text "opencode attach http://127.0.0.1:53817 --session ses_new"',
    )
    expect(openScriptOf(53817, 'ses"; do shell script "rm')).toBeNull()
    expect(openScriptOf(53817, "ses-new")).toBeNull()
    expect(openScriptOf(53817, null)).toBeNull()
    expect(openScriptOf("53817", "ses_new")).toBeNull()
    expect(openScriptOf(538.17, "ses_new")).toBeNull()
  })

  test("rows sort ready, retrying, running, gone, newest first within a state", async () => {
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), LIVE)
    expect(
      rows.map((row: { sessionId: string; state: string; repo: string }) => [
        row.sessionId,
        row.state,
        row.repo,
      ]),
    ).toEqual([
      ["ses_old", "idle", "api-gateway"],
      ["ses_web", "retry", "acme-web"],
      ["ses_new", "busy", "api-gateway"],
      ["ses_dead", "gone", "docs"],
    ])
    expect(ageOf("2026-10-02T11:50:00.000Z", NOW)).toBe("10m")
    expect(ageOf("2026-10-02T10:00:00.000Z", NOW)).toBe("2h")
  })

  test("an instance with no session yet is starting while it answers, gone otherwise", async () => {
    const [starting] = rowsOf([STARTING_INSTANCE], {
      54100: { isReachable: true, statuses: {} },
    })
    expect(starting.state).toBe("busy")
    expect(starting.sessionId).toBeNull()
    expect(summaryText([starting])).toContain("◌ starting")
    const [gone] = rowsOf([STARTING_INSTANCE], {})
    expect(gone.state).toBe("gone")
  })

  test("summaryText uses the state words and never the port", async () => {
    const text = summaryText(
      rowsOf(parseRegistry(JSON.stringify(INSTANCES)), LIVE),
    )
    expect(text).toContain("✓ ready")
    expect(text).toContain("⚠ retrying")
    expect(text).toContain("◌ running")
    expect(text).toContain("? gone")
    expect(text).not.toContain("53817")
  })

  test("header counts drop from the end when the width is short", async () => {
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), LIVE)
    expect(headerCountsOf(rows, 40)).toBe("1 ready · 1 retrying · 1 running")
    expect(headerCountsOf(rows, 25)).toBe("1 ready · 1 retrying")
    expect(headerCountsOf(rows, 8)).toBe("1 ready")
    expect(headerCountsOf(rows, 3)).toBe("")
    expect(headerCountsOf(rows.slice(0, 1), 40)).toBe("")
  })

  test("the footer names the digit range for the surface", async () => {
    expect(footerOf(3, true)).toBe(
      "1–3 open in iTerm · tab to copy · esc close",
    )
    expect(footerOf(1, true)).toBe("1 open in iTerm · tab to copy · esc close")
    expect(footerOf(3, false)).toBe("1–3 copy attach · esc close")
    expect(footerOf(12, false)).toBe("1–9 copy attach · esc close")
    expect(footerOf(0, true)).toBe("esc close")
  })

  test("the inline height grows with the jobs up to 18 rows", async () => {
    expect(inlineRowsOf(1)).toBe(9)
    expect(inlineRowsOf(4)).toBe(18)
    expect(inlineRowsOf(9)).toBe(18)
  })

  test("the command describes opening in iTerm only where it can", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()
    expect(w.commands[0]).toEqual({
      name: "opencode-jobs",
      description:
        "Headless opencode jobs: open one in a new iTerm tab, or copy its attach command",
    })
  })

  test("outside iTerm the command offers copy alone", async ($, on) => {
    const w = world(on, [], { termProgram: "Apple_Terminal" })
    await $.session.start(START)
    await w.clock.settle()
    expect(w.commands[0]?.description).toBe(
      "Headless opencode jobs: copy an attach command",
    )
  })

  test("an empty pane says so in two dim lines and offers esc close", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()
    await w.clock.advance(15000)

    const tree = await $.ui.render(PANE)
    const drawn = textOf(tree)
    expect(drawn).toContain("No headless jobs")
    expect(drawn).toContain("Jobs started through mcp-opencode appear here.")
    expect(drawn).toContain("esc close")
    const dimLines = findAll(
      tree,
      (node) => node.type === "Text" && node.props?.dimColor === true,
    ).map(textOf)
    expect(dimLines).toContain("No headless jobs")
    expect(w.fetched).toEqual([])
  })

  test("a missing registry is the empty state too", async ($, on) => {
    const w = world(on, null)
    await $.session.start(START)
    await w.clock.settle()

    expect(textOf(await $.ui.render(PANE))).toContain("No headless jobs")
    expect(w.fetched).toEqual([])
  })

  test("command.run with no jobs toasts and never opens the pane", async ($, on) => {
    const w = world(on, [])
    await $.session.start(START)
    await w.clock.settle()

    await $.command.run(RUN)

    expect(w.toasts).toContain("No headless opencode jobs")
    expect(w.opens).toHaveLength(0)
  })

  test("command.run asks for 52 docked columns and min(6 + 3n, 18) inline rows", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.command.run(RUN)

    expect(w.opens).toHaveLength(1)
    expect(w.opens[0]?.columns).toBe(52)
    expect(w.opens[0]?.rows).toBe(18)
  })

  test("the pane lists every job in display order and never shows a port", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).toContain("opencode jobs")
    expect(drawn).toContain("✓")
    expect(drawn).toContain("api-gateway · ready · 1h")
    expect(drawn).toContain("acme-web · retrying · 30m")
    expect(drawn).toContain("api-gateway · running · 10m")
    expect(drawn).toContain("docs · gone · 2h")
    expect(drawn.indexOf("fix flaky retry test")).toBeLessThan(
      drawn.indexOf("tidy checkout copy"),
    )
    expect(drawn.indexOf("tidy checkout copy")).toBeLessThan(
      drawn.indexOf("add rate limit header"),
    )
    expect(drawn.indexOf("add rate limit header")).toBeLessThan(
      drawn.indexOf("rewrite the intro"),
    )
    expect(drawn).not.toMatch(/5381[0-9]|53900|54000/)
    expect(w.fetched).toContain(
      "http://127.0.0.1:53817/session/status?directory=%2Fwork%2Facme%2Fapi-gateway",
    )
  })

  test("the header counts sit right of the bold title, dim, with a rule below", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const header = findAll(tree, (node) => node.props?.marginBottom === 1)[0]!
    const [titleRow, rule] = header.children as [Node, Node]
    expect(titleRow.props?.justifyContent).toBe("space-between")
    const [title, counts] = titleRow.children as [Node, Node]
    expect(title.props).toEqual({ bold: true })
    expect(textOf(title)).toBe("opencode jobs")
    expect(counts.props).toEqual({ dimColor: true })
    expect(textOf(counts)).toBe("1 ready · 1 retrying · 1 running")
    expect(rule.props).toEqual({ dimColor: true })
    expect(textOf(rule)).toBe("─".repeat(48))
  })

  test("one job draws no header counts", async ($, on) => {
    const w = world(on, [INSTANCES[1]])
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    expect(textOf(await $.ui.render(PANE))).not.toContain("1 retrying")
  })

  test("the root is padded and the jobs are a row apart", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = (await $.ui.render(PANE)) as Node
    expect(tree.props).toEqual({
      flexDirection: "column",
      paddingX: 2,
      paddingTop: 1,
      paddingBottom: 1,
    })
    const list = findAll(tree, (node) => node.props?.rowGap === 1)[0]!
    expect(list.children).toHaveLength(4)
  })

  test("in iTerm each live row gets 1: open and a dim copy, digits for live rows only", async ($, on) => {
    const w = world(on, [...INSTANCES, STARTING_INSTANCE])
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const opens = buttonsOf(tree).filter((button) => button.label === "open")
    const copies = buttonsOf(tree).filter((button) => button.label === "copy")
    expect(
      opens.map((button) => [button.key, button.hotkey, button.plain]),
    ).toEqual([
      ["open:53817:ses_old", "1", true],
      ["open:53900:ses_web", "2", true],
      ["open:53817:ses_new", "3", true],
    ])
    expect(
      copies.every((button) => button.dimColor === true && !button.hotkey),
    ).toBe(true)
    expect(copies).toHaveLength(3)
    const drawn = textOf(tree)
    expect(drawn).toContain("starting")
    expect(drawn).toContain("1–3 open in iTerm · tab to copy · esc close")
  })

  test("outside iTerm the digit goes on copy and open is never drawn", async ($, on) => {
    const w = world(on, INSTANCES, { termProgram: "WezTerm" })
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const buttons = buttonsOf(tree)
    expect(buttons.some((button) => button.label === "open")).toBe(false)
    expect(buttons.map((button) => [button.label, button.hotkey])).toEqual([
      ["copy", "1"],
      ["copy", "2"],
      ["copy", "3"],
    ])
    expect(textOf(tree)).toContain("1–3 copy attach · esc close")
  })

  test("on the desktop surface open is never drawn, even under iTerm", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(DESKTOP_PANE)
    expect(buttonsOf(tree).some((button) => button.label === "open")).toBe(
      false,
    )
    expect(textOf(tree)).toContain("copy attach")
  })

  test("open runs osascript with the iTerm script and toasts", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.ui.render(PANE)
    await $.ui.press({ plugin: "opencode", key: "open:53817:ses_new" })

    expect(w.ran).toEqual([["osascript", "-e", openScriptOf(53817, "ses_new")]])
    expect(w.toasts).toContain("Opened api-gateway in a new iTerm tab")
    expect(w.copied).toEqual([])
  })

  test("a failed open copies the attach command instead", async ($, on) => {
    const w = world(on, INSTANCES, { osascriptExit: 1 })
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.ui.render(PANE)
    await $.ui.press({ plugin: "opencode", key: "open:53900:ses_web" })

    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53900 --session ses_web",
    ])
    expect(w.toasts).toContain("Couldn't open iTerm, attach command copied")
  })

  test("copy puts the attach command on the clipboard and toasts with repo", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    await $.command.run(RUN)
    await $.ui.render(PANE)
    await $.ui.press({ plugin: "opencode", key: "copy:53817:ses_new" })

    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53817 --session ses_new",
    ])
    expect(w.toasts).toContain("Copied attach command for api-gateway")
    expect(w.ran).toEqual([])
  })

  test("a gone row is dim throughout and offers no action", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const keys = buttonsOf(tree).map((button) => button.key)
    expect(keys.some((key) => key.includes("ses_dead"))).toBe(false)
    const goneTexts = findAll(
      tree,
      (node) =>
        node.type === "Text" &&
        ["?", "rewrite the intro", "docs", "gone"].includes(textOf(node)),
    )
    expect(goneTexts).toHaveLength(4)
    expect(goneTexts.every((node) => node.props?.dimColor === true)).toBe(true)
  })

  test("Harbour palette: ANSI blue and yellow, default running, no background", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const colourOf = (text: string) =>
      findAll(
        tree,
        (node) => node.type === "Text" && textOf(node) === text,
      ).map((node) => node.props ?? {})
    expect(colourOf("✓")).toEqual([{ color: "ansi256(12)" }])
    expect(colourOf("ready")).toEqual([{ color: "ansi256(12)" }])
    expect(colourOf("⚠")).toEqual([{ color: "ansi256(11)" }])
    expect(colourOf("retrying")).toEqual([{ color: "ansi256(11)" }])
    expect(colourOf("◌")).toEqual([{}])
    expect(colourOf("running")).toEqual([{}])
    const json = JSON.stringify(tree)
    expect(json).not.toContain("backgroundColor")
    expect(json.match(/"bold":true/g)).toHaveLength(1)
  })

  test("a long title truncates at the end", async ($, on) => {
    const w = world(on, INSTANCES)
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const tree = await $.ui.render(PANE)
    const [title] = findAll(
      tree,
      (node) => node.type === "Text" && textOf(node) === "fix flaky retry test",
    )
    expect(title?.props?.wrap).toBe("truncate-end")
  })

  test("a port that does not answer within a second is gone", async ($, on) => {
    const w = world(on, INSTANCES, { isHanging: true })
    await $.session.start(START)
    await w.clock.advance(1000)
    await w.clock.settle()

    const drawn = textOf(await $.ui.render(PANE))
    expect(drawn).not.toContain("running")
    expect(drawn).toContain("gone")
    expect(drawn).toContain("esc close")
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
})
