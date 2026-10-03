import type { On, RenderInput } from "claude-code"
import { describe, expect, mock, test } from "claude-code/testing"

import {
  ageOf,
  attachCommandOf,
  openScriptOf,
  parseRegistry,
  registryPathOf,
  rowsOf,
} from "../hooks/mods/jobs.mjs"

const HOME = "/home/acme"
const REGISTRY = `${HOME}/.local/state/mcp-opencode/instances.json`
const NOW = Date.parse("2026-10-02T12:00:00.000Z")

const session = (id: string, title: string, startedAt: string) => ({
  id,
  title,
  model: "m",
  startedAt: `2026-10-02T${startedAt}:00.000Z`,
})

const INSTANCES = [
  {
    runtime: "opencode",
    port: 53817,
    pid: 4101,
    mcpPid: 4100,
    directory: "/work/acme/api-gateway",
    startedAt: "2026-10-02T11:00:00.000Z",
    sessions: [
      session("ses_old", "fix flaky retry test", "11:00"),
      session("ses_new", "add rate limit header", "11:50"),
    ],
  },
  {
    runtime: "opencode",
    port: 53900,
    pid: 4201,
    mcpPid: 4200,
    directory: "/work/acme/acme-web/",
    startedAt: "2026-10-02T11:00:00.000Z",
    sessions: [
      session("ses_web", "tidy checkout copy", "11:30"),
      session("ses_nav", "fix nav focus ring", "11:20"),
      session("ses_img", "lazy-load hero image", "11:10"),
    ],
  },
  {
    runtime: "opencode",
    port: 54000,
    pid: 4301,
    mcpPid: 4300,
    directory: "/work/acme/docs",
    startedAt: "2026-10-02T10:00:00.000Z",
    sessions: [session("ses_dead", "rewrite the intro", "10:00")],
  },
]

const STARTING_INSTANCE = {
  runtime: "opencode",
  port: 54100,
  pid: 4401,
  mcpPid: 4400,
  directory: "/work/acme/docs",
  startedAt: "2026-10-02T11:59:00.000Z",
  sessions: [],
}

type Statuses = Record<number, Record<string, { type: string }>>

const STATUSES: Statuses = {
  53817: { ses_new: { type: "busy" } },
  53900: {
    ses_web: { type: "retry" },
    ses_nav: { type: "busy" },
    ses_img: { type: "busy" },
  },
  54100: {},
}

const bandOf = (
  props: Partial<RenderInput<"AbovePrompt">["props"]> = {},
  surface: "terminal" | "desktop" = "terminal",
) =>
  ({
    component: "AbovePrompt",
    surface,
    requestId: "band",
    viewport: { columns: 48, rows: 40 },
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 8,
      bodyColumns: 48,
      scroll: { offset: 0, bodyRows: 8 },
      view: {},
      ...props,
    },
  }) as RenderInput<"AbovePrompt">

type Node = { type?: string; props?: Record<string, any>; children?: unknown[] }

// An empty Box takes no rows: it is what the engine draws beneath a band with
// nothing of its own.
const isEmptyBox = (tree: unknown) => {
  const node = tree as Node
  const children = node?.children ?? node?.props?.children ?? []
  return node?.type === "Box" && (children as unknown[]).length === 0
}

function textOf(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree)
  if (Array.isArray(tree)) return tree.map(textOf).join("")
  if (typeof tree !== "object" || !tree) return ""
  const node = tree as Node
  if (node.type === "Button") {
    const { label, hotkey, plain } = node.props ?? {}
    if (plain) return hotkey ? `${hotkey}: ${label}` : label
    return `[ ${label} ]`
  }
  const children = (node.children ?? node.props?.children ?? []) as unknown[]
  if (node.props?.flexDirection !== "column") return children.map(textOf).join("")
  return children.filter((child) => !isEmptyBox(child)).map(textOf).join("\n")
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

const linesOf = (tree: unknown) => textOf(tree).split("\n")

function world(
  on: On,
  registry: unknown[] | null,
  {
    termProgram = "iTerm.app",
    osascriptExit = 0,
    statuses = STATUSES,
    below = null,
  }: {
    termProgram?: string
    osascriptExit?: number
    statuses?: Statuses
    below?: string | null
  } = {},
) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME, TERM_PROGRAM: termProgram })
  const live = { statuses: structuredClone(statuses) as Statuses }
  const fetched: string[] = []
  const counts = { reads: 0, mtime: 1 }
  const toasts: string[] = []
  const copied: string[] = []
  const ran: (readonly string[])[] = []

  on("session.start", ($, e) => ({ cwd: e.cwd }))
  on("fs.stat", ($, e) =>
    registry && e.path === REGISTRY
      ? {
          value: {
            kind: "file",
            size: 100,
            mtimeMs: counts.mtime,
            isLink: false,
          },
        }
      : { deny: "ENOENT" },
  )
  on("fs.read", ($, e) => {
    counts.reads += 1
    return registry && e.path === REGISTRY
      ? { value: JSON.stringify(registry) }
      : { deny: "ENOENT" }
  })
  on("http.fetch", ($, e) => {
    fetched.push(e.url)
    const statuses = live.statuses[Number(new URL(e.url).port)]
    if (statuses === undefined) return { deny: "ECONNREFUSED" }
    return {
      value: {
        status: 200,
        ok: true,
        headers: {},
        text: JSON.stringify(statuses),
      },
    }
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
  on("ui.render", { component: "AbovePrompt" }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (below === null) return Box({})
    return Text({ children: [below] })
  })
  on("ui.focus", () => ({}))
  on("ui.copy", ($, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on("ui.toast", ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on("prompt.edit", ($, e) => ({ text: e.text, cursor: e.cursor }))

  return { clock, live, fetched, toasts, copied, ran, counts }
}

const START = {
  surface: "terminal",
  isInteractive: true,
  cwd: "/work",
} as const

const started = async ($: any, w: ReturnType<typeof world>) => {
  await $.session.start(START)
  await w.clock.advance(1000)
  await w.clock.settle()
}

const tick = async (w: ReturnType<typeof world>) => {
  await w.clock.advance(5000)
  await w.clock.settle()
}

const focusRow = ($: any, element: string) =>
  $.ui.focus({
    component: "AbovePrompt",
    requestId: "band",
    plugin: "opencode",
    element,
    origin: { kind: "person" },
  })

const EDIT = {
  origin: { kind: "composer" },
  text: "",
  cursor: 0,
  start: 0,
  end: 0,
  inputText: "h",
} as const

describe("jobs band", () => {
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

  test("the iTerm script carries the attach command and refuses unsafe input", async () => {
    expect(attachCommandOf(53817, "ses_new")).toBe(
      "opencode attach http://127.0.0.1:53817 --session ses_new",
    )
    const script = openScriptOf(53817, "ses_new")
    expect(script).toContain('tell application "iTerm2"')
    expect(script).toContain(
      'tell current session to write text "opencode attach http://127.0.0.1:53817 --session ses_new"',
    )
    expect(openScriptOf(53817, 'ses"; do shell script "rm')).toBeNull()
    expect(openScriptOf(53817, "ses-new")).toBeNull()
    expect(openScriptOf(53817, null)).toBeNull()
    expect(openScriptOf(538.17, "ses_new")).toBeNull()
  })

  test("rows sort ready, retrying, running, newest first, and gone jobs are dropped", async () => {
    const live = Object.fromEntries(
      Object.entries(STATUSES).map(([port, statuses]) => [
        port,
        { isReachable: true, statuses },
      ]),
    )
    const rows = rowsOf(parseRegistry(JSON.stringify(INSTANCES)), live)
    expect(
      rows.map((row: { sessionId: string; state: string }) => [
        row.sessionId,
        row.state,
      ]),
    ).toEqual([
      ["ses_old", "idle"],
      ["ses_web", "retry"],
      ["ses_new", "busy"],
      ["ses_nav", "busy"],
      ["ses_img", "busy"],
    ])
    expect(ageOf("2026-10-02T11:50:00.000Z", NOW)).toBe("10m")
  })

  test("idle: three rows, glyph and colour by state, overflow line, never a port", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    const tree = await $.ui.render(bandOf())
    expect(linesOf(tree)).toEqual([
      "✓  fix flaky retry test · api-gateway         1h",
      "⚠  tidy checkout copy · acme-web             30m",
      "◌  add rate limit header · api-gateway       10m",
      "   +2 more · ctrl+x tab",
    ])
    const colourOf = (glyph: string) =>
      findAll(
        tree,
        (node) => node.type === "Text" && textOf(node) === glyph,
      ).map((node) => node.props ?? {})
    expect(colourOf("✓")).toEqual([{ color: "ansi256(12)" }])
    expect(colourOf("⚠")).toEqual([{ color: "ansi256(11)" }])
    expect(colourOf("◌")).toEqual([{}])
    const shown = textOf(tree)
    expect(shown).not.toMatch(/53817|53900|54000/)
    expect(shown).not.toMatch(/ready|retrying|running/)
    expect(shown).not.toContain("rewrite the intro")
  })

  test("overflow counts toward maxRows", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    const at = async (maxRows: number) =>
      linesOf(await $.ui.render(bandOf({ maxRows })))
    expect(await at(8)).toHaveLength(4)
    expect(await at(4)).toHaveLength(4)
    expect(await at(3)).toEqual([
      "✓  fix flaky retry test · api-gateway         1h",
      "⚠  tidy checkout copy · acme-web             30m",
      "   +3 more · ctrl+x tab",
    ])
    expect(await at(2)).toEqual([
      "✓  fix flaky retry test · api-gateway         1h",
      "   +4 more · ctrl+x tab",
    ])
    expect(await at(1)).toEqual(["   +5 more · ctrl+x tab"])
  })

  test("three jobs fit without an overflow line", async ($, on) => {
    const w = world(on, [INSTANCES[0], INSTANCES[2]])
    await started($, w)

    expect(linesOf(await $.ui.render(bandOf()))).toHaveLength(2)
  })

  test("a starting job reads starting…", async ($, on) => {
    const w = world(on, [STARTING_INSTANCE])
    await started($, w)

    expect(linesOf(await $.ui.render(bandOf()))[0]).toMatch(
      /^◌  starting… · docs +1m$/,
    )
  })

  test("narrow: the repo goes first, then the title is cut", async ($, on) => {
    const w = world(on, [INSTANCES[0]], { statuses: { 53817: {} } })
    await started($, w)

    const at = async (bodyColumns: number) =>
      linesOf(await $.ui.render(bandOf({ bodyColumns })))[0]
    expect(await at(42)).toBe("✓  add rate limit header · api-gateway 10m")
    expect(await at(40)).toBe("✓  add rate limit header             10m")
    expect(await at(20)).toBe("✓  add rate lim… 10m")
  })

  test("no jobs: the band passes through", async ($, on) => {
    const w = world(on, [], { below: "another band" })
    await started($, w)

    expect(textOf(await $.ui.render(bandOf()))).toBe("another band")
    expect(w.fetched).toEqual([])
  })

  test("a missing registry passes through too", async ($, on) => {
    const w = world(on, null, { below: "another band" })
    await started($, w)

    expect(textOf(await $.ui.render(bandOf()))).toBe("another band")
  })

  test("chaining: the next mod's lines stay below the jobs", async ($, on) => {
    const w = world(on, INSTANCES, { below: "another band" })
    await started($, w)

    const lines = linesOf(await $.ui.render(bandOf()))
    expect(lines).toHaveLength(5)
    expect(lines[0]).toStartWith("✓  fix flaky retry test")
    expect(lines[4]).toBe("another band")
  })

  test("a survey holds the band", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    expect(
      textOf(await $.ui.render(bandOf({ hasSurvey: true }))),
    ).not.toContain("fix flaky")
  })

  test("rows are plain buttons with no digit hotkeys, the first auto-focused", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    const buttons = findAll(
      await $.ui.render(bandOf()),
      (node) => node.type === "Button",
    )
    expect(
      buttons.map((node) => [
        node.props?.key,
        node.props?.plain,
        node.props?.hotkey,
      ]),
    ).toEqual([
      ["job:53817:ses_old", true, undefined],
      ["job:53900:ses_web", true, undefined],
      ["job:53817:ses_new", true, undefined],
    ])
    expect(buttons[0]?.props?.autoFocus).toBe(true)
  })

  test("focused: › marks the row, the list grows to maxRows, the footer names the keys", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    await focusRow($, "job:53900:ses_web")
    expect(linesOf(await $.ui.render(bandOf()))).toEqual([
      "  ✓  fix flaky retry test · api-gateway       1h",
      "› ⚠  tidy checkout copy · acme-web           30m",
      "  ◌  add rate limit header · api-gateway     10m",
      "  ◌  fix nav focus ring · acme-web           40m",
      "  ◌  lazy-load hero image · acme-web         50m",
      "  enter open · c: copy · esc back",
    ])
    expect(linesOf(await $.ui.render(bandOf({ maxRows: 4 })))).toEqual([
      "  ✓  fix flaky retry test · api-gateway       1h",
      "› ⚠  tidy checkout copy · acme-web           30m",
      "     +3 more",
      "  enter open · c: copy · esc back",
    ])
  })

  test("focused Enter opens the job in iTerm", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    await focusRow($, "job:53817:ses_new")
    await $.ui.render(bandOf())
    await $.ui.press({ plugin: "opencode", key: "job:53817:ses_new" })

    expect(w.ran).toEqual([["osascript", "-e", openScriptOf(53817, "ses_new")]])
    expect(w.toasts).toContain("Opened api-gateway in a new iTerm tab")
    expect(w.copied).toEqual([])
  })

  test("a failed open copies the attach command instead", async ($, on) => {
    const w = world(on, INSTANCES, { osascriptExit: 1 })
    await started($, w)

    await focusRow($, "job:53900:ses_web")
    await $.ui.render(bandOf())
    await $.ui.press({ plugin: "opencode", key: "job:53900:ses_web" })

    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53900 --session ses_web",
    ])
    expect(w.toasts).toContain("Couldn't open iTerm, attach command copied")
  })

  test("focused c copies the focused row and briefly shows copied", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    await focusRow($, "job:53817:ses_old")
    await focusRow($, "job:53900:ses_web")
    await $.ui.render(bandOf())
    const copy = findAll(
      await $.ui.render(bandOf()),
      (node) => node.props?.key === "copy",
    )[0]
    expect(copy?.props?.hotkey).toBe("c")
    await $.ui.press({ plugin: "opencode", key: "copy" })

    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53900 --session ses_web",
    ])
    expect(w.ran).toEqual([])
    expect(linesOf(await $.ui.render(bandOf()))[1]).toBe(
      "› ⚠  tidy checkout copy · acme-web        copied",
    )
    await w.clock.advance(1500)
    await w.clock.settle()
    expect(linesOf(await $.ui.render(bandOf()))[1]).toEndWith("30m")
  })

  test("outside iTerm Enter copies and the footer says so", async ($, on) => {
    const w = world(on, INSTANCES, { termProgram: "WezTerm" })
    await started($, w)

    await focusRow($, "job:53817:ses_old")
    const tree = await $.ui.render(bandOf())
    expect(linesOf(tree).at(-1)).toBe("  enter copy · esc back")
    expect(findAll(tree, (node) => node.props?.key === "copy")).toEqual([])
    await $.ui.press({ plugin: "opencode", key: "job:53817:ses_old" })

    expect(w.ran).toEqual([])
    expect(w.copied).toEqual([
      "opencode attach http://127.0.0.1:53817 --session ses_old",
    ])
    expect(linesOf(await $.ui.render(bandOf()))[0]).toEndWith("copied")
  })

  test("the order freezes while focused, states still update, and unfreezes on leaving", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)

    await focusRow($, "job:53817:ses_old")
    w.live.statuses[53817] = {}
    await tick(w)

    const frozen = linesOf(await $.ui.render(bandOf()))
    expect(frozen.slice(0, 3)).toEqual([
      "› ✓  fix flaky retry test · api-gateway       1h",
      "  ⚠  tidy checkout copy · acme-web           30m",
      "  ✓  add rate limit header · api-gateway     10m",
    ])

    await $.prompt.edit(EDIT)
    expect(linesOf(await $.ui.render(bandOf())).slice(0, 3)).toEqual([
      "✓  add rate limit header · api-gateway       10m",
      "✓  fix flaky retry test · api-gateway         1h",
      "⚠  tidy checkout copy · acme-web             30m",
    ])
  })

  test("idle and focused trees validate on the terminal and the desktop", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)
    await focusRow($, "job:53817:ses_old")

    for (const surface of ["terminal", "desktop"] as const) {
      const band = bandOf({}, surface)
      const ui = await $.ui.mount({ plugin: "opencode", surface, component: "AbovePrompt", props: band.props })
      expect(await ui.find({ type: "Button", key: "job:53817:ses_old" })).toBeDefined()
      await ui.unmount()
    }
  })

  test("the ready toast fires once, on the transition only", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)
    expect(w.toasts).toEqual([])

    w.live.statuses[53817] = {}
    await tick(w)
    await tick(w)
    expect(w.toasts).toEqual(["opencode · add rate limit header is ready"])

    w.live.statuses[53817] = { ses_new: { type: "busy" } }
    await tick(w)
    w.live.statuses[53817] = {}
    await tick(w)
    expect(w.toasts).toEqual(["opencode · add rate limit header is ready"])
  })

  test("the registry is re-read only when it changes, ports polled every 5s", async ($, on) => {
    const w = world(on, INSTANCES)
    await started($, w)
    const firstFetches = w.fetched.length
    await tick(w)
    await tick(w)
    expect(w.counts.reads).toBe(1)
    expect(w.fetched.length).toBe(firstFetches * 3)

    w.counts.mtime = 2
    await tick(w)
    expect(w.counts.reads).toBe(2)
  })
})
