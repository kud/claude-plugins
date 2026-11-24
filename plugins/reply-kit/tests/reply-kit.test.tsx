import { expect, mock, test } from "claude-code/testing"

const ASK = "mcp__reply-kit__ask"

const row = (input: unknown) =>
  ({
    plugin: "reply-kit",
    component: "ToolUse",
    requestId: "tu1",
    props: {
      tool_use_id: "tu1",
      tool: ASK,
      input,
      isErrored: false,
      isInProgress: false,
    },
  }) as const

const boot = async ($: any, on: any) => {
  const sent = { submit: [] as string[], fill: [] as string[] }
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  on("tool.register", (_: unknown, e: any) => ({
    value: { tool: `mcp__reply-kit__${e.name}` },
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

const ask = {
  question: "Publiez-vous la 2.4.1 ?",
  options: ["Oui", "Non"],
  french: true,
}

test("a call with its arguments at the top of the input is answered", async ($, on) => {
  await boot($, on)
  const ran: any = await $.tool.call({ tool: ASK, ...ask })
  expect(ran.deny).toBeUndefined()
  expect(String(ran.result)).toContain("1. Oui")
})

test("a call without two options is refused, not thrown", async ($, on) => {
  await boot($, on)
  const ran: any = await $.tool.call({
    tool: ASK,
    question: "Go?",
    options: ["Yes"],
  })
  expect(String(ran.deny ?? ran.text)).toContain("two options")
})

test("a half-streamed input draws the row alone, on every surface", async ($, on) => {
  await boot($, on)
  for (const surface of ["terminal", "desktop", "mobile"] as const) {
    for (const input of [undefined, {}, { question: "Go?" }]) {
      const ui = await $.ui.mount({ ...row(input), surface } as any)
      expect(await ui.find({ type: "Button" })).toBeFalsy()
      await ui.unmount()
    }
  }
})

test("options are real buttons, and a press on a plain ask submits the reply", async ($, on) => {
  const sent = await boot($, on)
  const ui = await $.ui.mount({ ...row(ask), surface: "terminal" } as any)
  expect(await ui.find({ type: "Button", key: "option-0" })).toBeTruthy()
  await ui.press({ key: "option-0" })
  expect(sent.submit).toEqual(["1. Oui"])
  expect(sent.fill).toEqual([])
  expect((await ui.find({ type: "Button", key: "option-0" }))?.text).toContain(
    "👉",
  )
  await step($, on, "t2", 0)
  expect(await ui.find({ type: "Button" })).toBeFalsy()
  expect((await ui.find({ type: "Text", text: /👉 1\. Oui/ }))?.text).toContain(
    "Oui",
  )
  await ui.unmount()
})

test("until the next reply starts, a new pick replaces the old one", async ($, on) => {
  const sent = await boot($, on)
  const ui = await $.ui.mount({
    ...row({ ...ask, isGated: true }),
    surface: "terminal",
  } as any)
  await ui.press({ key: "option-0" })
  await ui.press({ key: "option-1" })
  expect(sent.fill).toEqual(["1. Oui", "2. Non"])
  expect((await ui.find({ type: "Button", key: "option-1" }))?.text).toContain("👉")
  expect((await ui.find({ type: "Button", key: "option-0" }))?.text).not.toContain("👉")
  await step($, on, "t2", 0)
  expect(await ui.find({ type: "Button" })).toBeFalsy()
  expect((await ui.find({ type: "Text", text: /👉 2\. Non/ }))?.text).toContain("Non")
  await ui.press({ key: "option-0" }).catch(() => undefined)
  expect(sent.fill).toEqual(["1. Oui", "2. Non"])
  await ui.unmount()
})

test("after a step that only asked, the turn ends with no further request", async ($, on) => {
  await boot($, on)
  const asked = await step($, on, "t1", 0, [[ASK, "ta1"]])
  expect(asked.isSent).toBe(true)
  await $.tool.call({ tool: ASK, tool_use_id: "ta1", ...ask } as any)
  const after = await step($, on, "t1", 1)
  expect(after.isSent).toBe(false)
  expect(after.result).toMatchObject({ answer: "", toolUses: [], stopReason: "end_turn" })
})

test("a refused ask, or an ask beside another tool, lets the turn go on", async ($, on) => {
  await boot($, on)
  await step($, on, "t1", 0, [[ASK, "ta1"]])
  await $.tool.call({ tool: ASK, tool_use_id: "ta1", question: "Go?", options: ["Yes"] } as any)
  expect((await step($, on, "t1", 1)).isSent).toBe(true)

  await step($, on, "t3", 0, [[ASK, "ta3"], ["Bash", "tb3"]])
  await $.tool.call({ tool: ASK, tool_use_id: "ta3", ...ask } as any)
  expect((await step($, on, "t3", 1)).isSent).toBe(true)
})

test("a wide card is held to the viewport so its right border shows", async ($, on) => {
  await boot($, on)
  const long = { ...ask, question: "x".repeat(150) }
  const width = async (columns?: number) => {
    const ui = await $.ui.mount({
      ...row(long),
      surface: "terminal",
      ...(columns ? { viewport: { columns, rows: 40 } } : {}),
    } as any)
    const drawn: any = await ui.drawn()
    const found: number[] = []
    const walk = (n: any) => {
      if (!n || typeof n !== "object") return
      if (Array.isArray(n)) return n.forEach(walk)
      if (n.props?.borderStyle && n.props?.width !== undefined) found.push(n.props.width)
      for (const c of n.children ?? n.props?.children ?? []) walk(c)
    }
    walk(drawn)
    await ui.unmount()
    return found
  }
  expect(await width(60)).toEqual([58])
  expect(await width()).toEqual([])
})

test("a gated ask only drafts the answer for the user to send", async ($, on) => {
  const sent = await boot($, on)
  const ui = await $.ui.mount({
    ...row({ ...ask, isGated: true }),
    surface: "desktop",
  } as any)
  await ui.press({ key: "option-1" })
  expect(sent.submit).toEqual([])
  expect(sent.fill).toEqual(["2. Non"])
  await ui.unmount()
})

test("the text result row draws nothing under the card", async ($, on) => {
  await boot($, on)
  for (const surface of ["terminal", "desktop", "mobile"] as const) {
    const ui = await $.ui.mount({
      plugin: "reply-kit",
      component: "ToolResult",
      requestId: "tu1",
      surface,
      props: {
        tool_use_id: "tu1",
        tool: ASK,
        output: "── 👋 À vous ──\nGo?\n1. Oui\n2. Non",
      },
    } as any)
    expect(await ui.find({ type: "Text" })).toBeFalsy()
    await ui.unmount()
  }
})

test("the card draws its heading and buttons on every surface", async ($, on) => {
  await boot($, on)
  for (const surface of ["terminal", "desktop", "mobile"] as const) {
    const ui = await $.ui.mount({ ...row(ask), surface } as any)
    expect(await ui.find({ type: "Button", key: "option-1" })).toBeTruthy()
    expect((await ui.find({ type: "Text", text: /À vous/ }))?.text).toContain(
      "👋",
    )
    await ui.unmount()
  }
})

test("a new pick on a plain ask sends the new answer, and the same pick sends nothing", async ($, on) => {
  const sent = await boot($, on)
  const ui = await $.ui.mount({ ...row(ask), surface: "desktop" } as any)
  await ui.press({ key: "option-0" })
  await ui.press({ key: "option-0" })
  await ui.press({ key: "option-1" })
  expect(sent.submit).toEqual(["1. Oui", "2. Non"])
  await ui.unmount()
})
