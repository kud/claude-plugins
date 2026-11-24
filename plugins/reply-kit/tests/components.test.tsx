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
  beneath(on)
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
  return sent
}


// The model beneath the plugins, faked: each step answers with a piece of text,
// or with calls to the tools `model.tools` names, and notes it was reached.
const model = { tools: [] as [string, string][], isSent: false }

const beneath = (on: any) =>
  on("turn.step", async function* (_: unknown, e: any) {
    model.isSent = true
    const tools = model.tools
    if (tools.length === 0) yield { kind: "text", index: 0, text: "Merged." }
    for (const [name, id] of tools) yield { kind: "tool", index: 0, id, name }
    return {
      turnId: e.turnId,
      index: e.index,
      answer: tools.length === 0 ? "Merged." : "",
      toolUses: tools.map(([name]) => ({ name, input: {} })),
      stopReason: tools.length === 0 ? "end_turn" : "tool_use",
      usage: null,
    }
  })

// One model step of the main loop: what it answered, and whether the request
// reached the model.
const step = async ($: any, _on: unknown, turnId: string, index: number, tools: [string, string][] = []) => {
  model.tools = tools
  model.isSent = false
  const stream = $.turn.step({ turnId, index, model: "m", messageCount: 1 })
  let piece = await stream.next()
  while (!piece.done) piece = await stream.next()
  return { result: piece.value, isSent: model.isSent }
}

const texts = async (ui: any) =>
  (await ui.findAll({ type: "Text" })).map((t: any) => t.text as string)

test("a multi ask toggles options and Done submits the set once", async ($, on) => {
  const sent = await boot($, on)
  const input = { question: "Which to merge?", options: ["a", "b", "c"], multi: true }
  const ui = await $.ui.mount({
    ...card("ask", input),
    surface: "desktop",
  } as any)
  expect(await ui.find({ type: "Button", key: "done" })).toBeFalsy()
  await ui.press({ key: "option-2" })
  await ui.press({ key: "option-0" })
  await ui.press({ key: "option-1" })
  await ui.press({ key: "option-1" })
  await ui.press({ key: "done" })
  expect(sent.submit).toEqual(["1, 3"])
  // Until the next reply starts, the set can change and be sent again.
  await ui.press({ key: "option-1" })
  await ui.press({ key: "done" })
  expect(sent.submit).toEqual(["1, 3", "1, 2, 3"])
  await step($, on, "t2", 0)
  expect(await ui.find({ type: "Button", key: "done" })).toBeFalsy()
  expect(await ui.find({ type: "Button", key: "option-0" })).toBeFalsy()
  await ui.unmount()
})

test("a gated multi ask only drafts the set", async ($, on) => {
  const sent = await boot($, on)
  const input = { question: "Delete?", options: ["a", "b"], isGated: true, multi: true }
  const ui = await $.ui.mount({
    ...card("ask", input),
    surface: "terminal",
  } as any)
  await ui.press({ key: "option-1" })
  await ui.press({ key: "done" })
  expect(sent.submit).toEqual([])
  expect(sent.fill).toEqual(["2"])
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

test("the row above a whole card shows no arguments; a streaming one shows them", async ($, on) => {
  const seen: unknown[] = []
  on("ui.render", { component: "ToolUse" }, ($: any, e: any) => {
    seen.push(e.props.input)
    const { Text } = $.ui.resolve(e)
    return <Text>row</Text>
  })
  await boot($, on)
  const whole = { repo: "acme/api", runId: "42" }
  const ui = await $.ui.mount({ ...card("live", whole), surface: "terminal" } as any)
  expect(seen.at(-1)).toEqual({})
  await ui.unmount()
  const half = await $.ui.mount({ ...card("live", { repo: "acme/api" }), surface: "terminal" } as any)
  expect(seen.at(-1)).toEqual({ repo: "acme/api" })
  await half.unmount()
})

test("only ask and live are tools, and live is deferred", async ($, on) => {
  const registered: any[] = []
  on("tool.register", (_: unknown, e: any) => (registered.push(e), { value: { tool: tool(e.name) } }))
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
  expect(registered.map((one) => [one.name, one.isDeferred])).toEqual([
    ["ask", false],
    ["live", true],
  ])
})
