import { expect, mock, test } from "claude-code/testing"

const tool = (name: string) => `mcp__reply-kit__${name}`

const card = (name: string, input: unknown, requestId = "tu1") =>
  ({
    plugin: "reply-kit",
    component: "ToolUse",
    requestId,
    props: {
      tool_use_id: requestId,
      tool: tool(name),
      input,
      isErrored: false,
      isInProgress: false,
    },
  }) as const

const boot = async ($: any, on: any) => {
  const sent = { submit: [] as string[], fill: [] as string[] }
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  on("tool.register", (_: unknown, e: any) => ({
    value: { tool: tool(e.name) },
  }))
  on(
    "prompt.submit",
    (_: unknown, e: any) => (sent.submit.push(e.text), { text: e.text }),
  )
  on(
    "prompt.fill",
    (_: unknown, e: any) => (sent.fill.push(e.text), { isFilled: true }),
  )
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
  return sent
}

const texts = async (ui: any) =>
  (await ui.findAll({ type: "Text" })).map((t: any) => t.text as string)

test("copy answers the plain values and copies the pressed one", async ($, on) => {
  const copied: string[] = []
  on(
    "ui.copy",
    (_: unknown, e: any) => (
      copied.push(e.text),
      { value: { isCopied: true } }
    ),
  )
  await boot($, on)
  const input = {
    items: [{ label: "Run it", value: "npm run dev" }, { value: "~/notes.md" }],
  }
  const ran: any = await ($.tool.call as any)({ tool: tool("copy"), ...input })
  expect(ran.result).toBe("npm run dev\n~/notes.md")

  const ui = await $.ui.mount({
    ...card("copy", input),
    surface: "terminal",
  } as any)
  await ui.press({ key: "copy-1" })
  expect(copied).toEqual(["~/notes.md"])
  expect((await texts(ui)).some((t: string) => t.includes("✅ copied"))).toBe(
    true,
  )
  await ui.unmount()
})

test("a refused copy says so in words", async ($, on) => {
  on("ui.copy", () => ({ value: { isCopied: false, reason: "no-clipboard" } }))
  await boot($, on)
  const ui = await $.ui.mount({
    ...card("copy", { items: [{ value: "x" }] }),
    surface: "desktop",
  } as any)
  await ui.press({ key: "copy-0" })
  expect(
    (await texts(ui)).some((t: string) =>
      t.includes("🔥 not copied: no-clipboard"),
    ),
  ).toBe(true)
  await ui.unmount()
})

test("choose toggles options and Done submits the set once", async ($, on) => {
  const sent = await boot($, on)
  const input = { question: "Which to merge?", options: ["a", "b", "c"] }
  const ui = await $.ui.mount({
    ...card("choose", input),
    surface: "desktop",
  } as any)
  expect(await ui.find({ type: "Button", key: "done" })).toBeFalsy()
  await ui.press({ key: "option-2" })
  await ui.press({ key: "option-0" })
  await ui.press({ key: "option-1" })
  await ui.press({ key: "option-1" })
  await ui.press({ key: "done" })
  expect(sent.submit).toEqual(["1, 3"])
  expect(await ui.find({ type: "Button", key: "done" })).toBeFalsy()
  await ui.unmount()
})

test("a gated choose only drafts the set", async ($, on) => {
  const sent = await boot($, on)
  const input = { question: "Delete?", options: ["a", "b"], isGated: true }
  const ui = await $.ui.mount({
    ...card("choose", input),
    surface: "terminal",
  } as any)
  await ui.press({ key: "option-1" })
  await ui.press({ key: "done" })
  expect(sent.submit).toEqual([])
  expect(sent.fill).toEqual(["2"])
  await ui.unmount()
})

test("fold opens and closes on press", async ($, on) => {
  await boot($, on)
  const input = {
    summary: "build log",
    body: "line one\nline two\nERROR at line three",
  }
  const ran: any = await ($.tool.call as any)({ tool: tool("fold"), ...input })
  expect(ran.result).toContain("3 lines")
  const ui = await $.ui.mount({
    ...card("fold", input),
    surface: "terminal",
  } as any)
  const hasError = async () =>
    (await texts(ui)).some((t: string) => t.includes("ERROR"))
  expect(await hasError()).toBe(false)
  await ui.press({ key: "fold" })
  expect(await hasError()).toBe(true)
  await ui.press({ key: "fold" })
  expect(await hasError()).toBe(false)
  await ui.unmount()
})

test("live refuses anything but owner/repo and a numeric run id", async ($, on) => {
  await boot($, on)
  const ran: any = await ($.tool.call as any)({
    tool: tool("live"),
    repo: "acme/api;echo",
    runId: "1",
  })
  expect(String(ran.deny ?? ran.text)).toContain("owner/repo")
})

test("live updates the card in place and stops polling when the run ends", async ($, on) => {
  const clock = mock.clock(on)
  const states = [
    {
      status: "in_progress",
      conclusion: "",
      jobs: [{ name: "test", status: "in_progress", conclusion: "" }],
    },
    {
      status: "completed",
      conclusion: "success",
      jobs: [{ name: "test", status: "completed", conclusion: "success" }],
    },
  ]
  const calls: string[][] = []
  const beneath = on as any
  beneath("process.run", (_: unknown, e: any) => {
    calls.push(e.argv)
    const state = states[Math.min(calls.length - 1, states.length - 1)]
    const stdout = JSON.stringify({
      ...state,
      displayTitle: "fix: tidy",
      url: "https://github.com/acme/api/actions/runs/42",
    })
    return { value: { exitCode: 0, stdout, stderr: "" } }
  })
  await boot($, on)

  const ran: any = await ($.tool.call as any)({
    tool: tool("live"),
    tool_use_id: "tu9",
    repo: "acme/api",
    runId: "42",
  })
  expect(String(ran.result)).toContain("⏳ running")
  expect(calls[0]).toEqual([
    "gh",
    "run",
    "view",
    "42",
    "-R",
    "acme/api",
    "--json",
    "status,conclusion,displayTitle,url,jobs",
  ])

  const ui = await $.ui.mount({
    ...card("live", { repo: "acme/api", runId: "42" }, "tu9"),
    surface: "terminal",
  } as any)
  expect(
    (await texts(ui)).some((t: string) => t.startsWith("⏳ running")),
  ).toBe(true)
  await clock.advance(15_000)
  expect((await texts(ui)).some((t: string) => t.startsWith("✅ green"))).toBe(
    true,
  )
  await clock.advance(60_000)
  expect(calls.length).toBe(2)
  await ui.unmount()
})
