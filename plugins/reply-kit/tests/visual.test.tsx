import { expect, test } from "claude-code/testing"

import { FIXTURES } from "./fixtures"

const tool = (name: string) => `mcp__reply-kit__${name}`

const card = (name: string, input: unknown) =>
  ({
    plugin: "reply-kit",
    component: "ToolUse",
    requestId: "tu1",
    props: {
      tool_use_id: "tu1",
      tool: tool(name),
      input,
      isErrored: false,
      isInProgress: false,
    },
  }) as const

const boot = async ($: any, on: any) => {
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  on("tool.register", (_: unknown, e: any) => ({
    value: { tool: tool(e.name) },
  }))
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
}

const refusal = (ran: any) => String(ran.deny ?? ran.text)

const texts = async (ui: any) =>
  (await ui.findAll({ type: "Text" })).map((t: any) => t.text as string)

test("every visual tool answers its design-system text shape exactly", async ($, on) => {
  await boot($, on)
  for (const fixture of FIXTURES) {
    const ran: any = await ($.tool.call as any)({
      tool: tool(fixture.tool),
      ...fixture.input,
    })
    expect({ name: fixture.name, text: ran.result }).toEqual({
      name: fixture.name,
      text: fixture.text,
    })
  }
})

test("every visual card draws on every surface, keeping its words", async ($, on) => {
  await boot($, on)
  for (const fixture of FIXTURES) {
    for (const surface of ["terminal", "desktop", "mobile"] as const) {
      const ui = await $.ui.mount({
        ...card(fixture.tool, fixture.input),
        surface,
      } as any)
      const all = (await texts(ui)).join("\n")
      expect({ name: fixture.name, surface, isDrawn: all.length > 0 }).toEqual({
        name: fixture.name,
        surface,
        isDrawn: true,
      })
      await ui.unmount()
    }
  }
})

test("a status card keeps the state word beside its colour, in a fixed column", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({
    ...card("status", FIXTURES[9]!.input),
    surface: "terminal",
  } as any)
  const all = await texts(ui)
  expect(all).toContain("✅ done")
  expect(all).toContain("👉 yours")
  expect(all).toContain("✅ 2 done · ⏳ 1 pending · 👉 1 yours")
  await ui.unmount()
})

test("a callout card shows its emoji and label, not colour alone", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({
    ...card("callout", FIXTURES[0]!.input),
    surface: "terminal",
  } as any)
  expect(await texts(ui)).toContain("⚠️ Warning")
  await ui.unmount()
})

test("bad visual inputs are refused, not drawn half-filled", async ($, on) => {
  await boot($, on)
  const call = $.tool.call as any
  expect(
    refusal(
      (await call({ tool: tool("callout"), kind: "shout", body: "x" }))),
  ).toContain("kind")
  expect(
    refusal(
      (
        await call({
          tool: tool("grid"),
          rows: [{ subject: "a", runs: "abc" }],
        })
      )),
  ).toContain("rows")
  expect(
    refusal(
      (
        await call({
          tool: tool("bar"),
          kind: "progress",
          label: "x",
          value: 1,
          max: 0,
        })
      )),
  ).toContain("kind")
  expect(
    refusal(
      (
        await call({
          tool: tool("status"),
          title: "t",
          items: [{ state: "red", ref: "a" }],
        })
      )),
  ).toContain("state")
})
