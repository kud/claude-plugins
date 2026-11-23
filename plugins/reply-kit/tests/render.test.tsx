// Render checks on the tree each card's hook returns, as the test kit hands it
// back. The kit exercises the tree, never a surface's paint: these pin colour
// tokens, dimming and structure, not pixels or ANSI.
import { expect, test } from "claude-code/testing"

import { FIXTURES } from "./fixtures"

const tool = (name: string) => `mcp__reply-kit__${name}`

const boot = async ($: any, on: any) => {
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  on("tool.register", (_: unknown, e: any) => ({
    value: { tool: tool(e.name) },
  }))
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
}

const mount = ($: any, name: string, input: unknown, columns: number) =>
  $.ui.mount({
    plugin: "reply-kit",
    component: "ToolUse",
    requestId: "tu1",
    surface: "terminal",
    viewport: { columns, rows: 40 },
    props: {
      tool_use_id: "tu1",
      tool: tool(name),
      input,
      isErrored: false,
      isInProgress: false,
    },
  })

type Node = {
  type?: string
  props?: Record<string, unknown>
  children?: unknown[]
}

const walk = (node: unknown, seen: Node[] = []): Node[] => {
  if (typeof node !== "object" || node === null) return seen
  const element = node as Node
  seen.push(element)
  for (const child of element.children ??
    (element.props?.children as unknown[]) ??
    [])
    walk(child, seen)
  return seen
}

const textOf = (node: unknown): string => {
  if (typeof node === "string") return node
  if (typeof node !== "object" || node === null) return ""
  const element = node as Node
  return (element.children ?? (element.props?.children as unknown[]) ?? [])
    .map(textOf)
    .join("")
}

const borders = (nodes: Node[]) =>
  nodes
    .filter((n) => n.type === "Box" && n.props?.borderStyle)
    .map((n) => n.props?.borderColor)

const colourOf = (nodes: Node[], words: string) =>
  nodes.find((n) => n.type === "Text" && textOf(n) === words)?.props?.color

const BORDER: Record<string, string> = {
  warning: "warning",
  tip: "suggestion",
  info: "subtle",
  insight: "claude",
  urgent: "error",
  concern: "error",
}

test("no card dims anything, at 80 and 120 columns, and the tree does not depend on width", async ($, on) => {
  await boot($, on)
  for (const fixture of FIXTURES) {
    const trees: string[] = []
    for (const columns of [80, 120]) {
      const ui = await mount($, fixture.tool, fixture.input, columns)
      const tree = await ui.drawn()
      const dimmed = walk(tree).filter((n) => n.props?.dimColor === true)
      expect({ name: fixture.name, columns, dimmed: dimmed.length }).toEqual({
        name: fixture.name,
        columns,
        dimmed: 0,
      })
      trees.push(JSON.stringify(tree))
      await ui.unmount()
    }
    expect({ name: fixture.name, isSame: trees[0] === trees[1] }).toEqual({
      name: fixture.name,
      isSame: true,
    })
  }
})

test("callout borders follow the kind's token, beside the emoji and label", async ($, on) => {
  await boot($, on)
  for (const kind of Object.keys(BORDER)) {
    const ui = await mount($, "callout", { kind, body: "body" }, 80)
    const nodes = walk(await ui.drawn())
    expect({ kind, borders: borders(nodes) }).toEqual({
      kind,
      borders: [BORDER[kind]],
    })
    await ui.unmount()
  }
})

test("status cells carry their state token and keep the word; refs are bold", async ($, on) => {
  await boot($, on)
  const input = {
    title: "Tokens",
    items: [
      { state: "done", ref: "acme/a#1", what: "x" },
      { state: "pending", ref: "acme/b#2", what: "x" },
      { state: "yours", ref: "acme/c#3", what: "x" },
      { state: "risk", ref: "acme/d#4", what: "x" },
      { state: "urgent", ref: "acme/e#5", what: "x" },
      { state: "open", ref: "acme/f#6", what: "x" },
    ],
  }
  const ui = await mount($, "status", input, 80)
  const nodes = walk(await ui.drawn())
  expect({
    done: colourOf(nodes, "✅ done"),
    pending: colourOf(nodes, "⏳ pending"),
    yours: colourOf(nodes, "👉 yours"),
    risk: colourOf(nodes, "⚠️ risk"),
    urgent: colourOf(nodes, "🚨 urgent"),
    open: colourOf(nodes, "💤 open"),
  }).toEqual({
    done: "success",
    pending: "warning",
    yours: "permission",
    risk: "warning",
    urgent: "error",
    open: "text",
  })
  expect(borders(nodes)).toEqual(["subtle"])
  const ref = nodes.find((n) => n.type === "Text" && textOf(n) === "acme/a#1")
  expect(ref?.props?.bold).toBe(true)
  const fixed = nodes.filter((n) => n.type === "Box" && n.props?.width === 11)
  expect(fixed.length).toBe(6)
  await ui.unmount()
})

test("grid glyphs repeat their shape in colour; bars fill and track in their tokens", async ($, on) => {
  await boot($, on)
  const grid = await mount(
    $,
    "grid",
    { rows: [{ subject: "acme/api", runs: "✓✗" }] },
    80,
  )
  const gridNodes = walk(await grid.drawn())
  expect(colourOf(gridNodes, "✓")).toBe("success")
  expect(colourOf(gridNodes, "✗")).toBe("error")
  await grid.unmount()

  const bar = await mount(
    $,
    "bar",
    { kind: "progress", label: "release", value: 8, max: 10 },
    80,
  )
  const barNodes = walk(await bar.drawn())
  expect(colourOf(barNodes, "████████")).toBe("suggestion")
  expect(colourOf(barNodes, "░░")).toBe("subtle")
  await bar.unmount()
})

test("interactive cards keep the quiet frame and never dim the question or options", async ($, on) => {
  await boot($, on)
  const ask = await mount(
    $,
    "ask",
    { question: "Publish?", options: ["Yes", "No"] },
    80,
  )
  const nodes = walk(await ask.drawn())
  expect(borders(nodes)).toEqual(["subtle"])
  const question = nodes.find(
    (n) => n.type === "Text" && textOf(n) === "Publish?",
  )
  expect(question?.props?.color).toBeUndefined()
  await ask.unmount()
})
