// The reply's own Markdown drawn as cards: each design-system shape becomes a
// card, and every near miss stays the engine's Markdown.
import { expect, test } from "claude-code/testing"

import { SHAPES, parseReply } from "../hooks/markdown"
import { FIXTURES } from "./fixtures"

const FENCED = new Set(["grid", "bar"])

// What the model writes in its reply: a call-out as is, a widget in a fence.
const replyOf = (fixture: (typeof FIXTURES)[number]) =>
  FENCED.has(fixture.tool) ? "```\n" + fixture.text + "\n```" : fixture.text

const CARD: Record<string, string | undefined> = {
  "callout: warning": "callout",
  "callout: tip, in French": "callout",
  "callout: urgent": "callout",
  "callout: insight with bullets": "callout",
  "grid: a failure in the history": "grid",
  "grid: a subject past 40 columns is not cut in text": "grid",
  "bar: progress with its figure": "progress",
  "bar: a list keeps a blank line between bars": "bars",
  // Left out of the re-render for now: these stay Markdown.
  "bar: sparkline with its window": undefined,
  "status: four rows keep their order": undefined,
  "status: five rows group by state, a long what is cut": undefined,
}

const boot = async ($: any, on: any) => {
  const copied: string[] = []
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }))
  on("tool.register", (_: unknown, e: any) => ({
    value: { tool: `mcp__reply-kit__${e.name}` },
  }))
  on(
    "ui.copy",
    (_: unknown, e: any) => (copied.push(e.text), { value: { isCopied: true } }),
  )
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true })
  return copied
}

const message = (text: string, surface = "terminal", requestId = "m1") =>
  ({
    plugin: "reply-kit",
    component: "AssistantMessage",
    requestId,
    surface,
    viewport: { columns: 100, rows: 40 },
    props: { text, isFirstOfReply: true },
  }) as const

type Node = { type?: string; props?: Record<string, any>; children?: unknown[] }

const walk = (node: unknown, seen: Node[] = []): Node[] => {
  if (typeof node !== "object" || node === null) return seen
  if (Array.isArray(node)) {
    for (const one of node) walk(one, seen)
    return seen
  }
  const element = node as Node
  seen.push(element)
  for (const child of element.children ?? element.props?.children ?? [])
    walk(child, seen)
  return seen
}

const textOf = (nodes: Node[]) =>
  nodes
    .map((n) =>
      [
        n.props?.text ?? "",
        ...(n.children ?? []).filter(
          (c) => typeof c === "string" || typeof c === "number",
        ),
      ].join(""),
    )
    .join(" ")

const framed = (nodes: Node[]) =>
  nodes.filter((n) => n.type === "Box" && n.props?.borderStyle)

test("every fixture shape parses to its card, and the rest stays Markdown", () => {
  for (const fixture of FIXTURES) {
    const kinds = parseReply(replyOf(fixture)).map((block) => block.kind)
    const want = CARD[fixture.name]
    expect({ name: fixture.name, kinds }).toEqual({
      name: fixture.name,
      kinds: [want ?? "markdown"],
    })
  }
})

test("a near miss or a half-streamed shape stays Markdown, never a broken card", () => {
  const misses = [
    "> ⚠️ Warning\n>\n> no bold label",
    "> 🔥 **Blocking**\n>\n> not a call-out emoji",
    "> ⚠️ **Warning**\n>",
    "```\nacme/api   ✓✓✗",
    "```\nacme/api   ✓✓x\n```",
    "```\nrelease 2.4  ████████░░  8 of 10\n```",
    "▸ e2e log (34 lines)\nno fence",
    "```sh\none\ntwo\nthree\nfour\nfive\n```",
    "```ts\nconst a = 1\n```",
  ]
  for (const text of misses)
    expect({ text, kinds: parseReply(text).map((b) => b.kind) }).toEqual({
      text,
      kinds: ["markdown"],
    })
})

test("prose around a card keeps its order and its words", () => {
  const text =
    "Release 2.4 is close.\n\n```\nrelease 2.4  ████████░░  8/10\n```\n\nTwo items left."
  expect(parseReply(text)).toEqual([
    { kind: "markdown", text: "Release 2.4 is close." },
    { kind: "progress", label: "release 2.4", value: 8, max: 10 },
    { kind: "markdown", text: "Two items left." },
  ])
})

test("a reply with no shape is the engine's own drawing, untouched", async ($, on) => {
  await boot($, on)
  const plain = "Just prose, a list:\n\n- one\n- two"
  const ui = await $.ui.mount(message(plain) as any)
  expect(framed(walk(await ui.drawn())).length).toBe(0)
  await ui.unmount()
})

test("each card keeps its words, draws on every surface and dims nothing", async ($, on) => {
  await boot($, on)
  for (const fixture of FIXTURES.filter((one) => CARD[one.name])) {
    for (const surface of ["terminal", "desktop", "mobile"]) {
      const ui = await $.ui.mount(message(replyOf(fixture), surface) as any)
      const nodes = walk(await ui.drawn())
      expect({
        name: fixture.name,
        surface,
        cards: framed(nodes).length,
      }).toEqual({
        name: fixture.name,
        surface,
        cards: 1,
      })
      expect(nodes.some((n) => n.props?.dimColor === true)).toBe(false)
      await ui.unmount()
    }
  }
})

test("a call-out's border follows its kind, beside the emoji and label", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(
    message(
      "> 🚨 **Urgent**\n>\n> main is red: every merge is blocked.",
    ) as any,
  )
  const nodes = walk(await ui.drawn())
  expect(framed(nodes).map((n) => n.props?.borderColor)).toEqual(["error"])
  expect(textOf(nodes)).toContain("🚨 Urgent")
  await ui.unmount()
})

test("a fold opens and closes on press, and says what the reply left out", async ($, on) => {
  await boot($, on)
  const head = Array.from({ length: 20 }, (_, i) => `  ✓ step ${i + 1}`)
  const text = [
    "▸ e2e log, SSO submit timed out (34 lines)",
    "```",
    ...head,
    "… 14 more lines",
    "```",
  ].join("\n")
  const ui = await $.ui.mount(message(text) as any)
  const shows = async (words: string) =>
    textOf(walk(await ui.drawn())).includes(words)
  expect(await shows("step 20")).toBe(false)
  await ui.press({ key: "fold-m1:0" })
  expect(await shows("step 20")).toBe(true)
  expect(await shows("14 more lines")).toBe(true)
  await ui.press({ key: "fold-m1:0" })
  expect(await shows("step 20")).toBe(false)
  await ui.unmount()
})

test("a short shell fence gets a copy button per line", async ($, on) => {
  const copied = await boot($, on)
  const ui = await $.ui.mount(
    message("Run this:\n\n```sh\nnpm test\nnpm run build\n```") as any,
  )
  await ui.press({ key: "copy-m1:1-1" })
  expect(copied).toEqual(["npm run build"])
  expect(textOf(walk(await ui.drawn()))).toContain("✅ copied")
  await ui.unmount()
})

test("a call-out without the bare quote line is still a call-out", () => {
  expect(parseReply("> ⚠️ **Warning**\n> the tag exists")).toEqual([
    { kind: "callout", callout: "warning", label: "Warning", body: "the tag exists" },
  ])
})

test("a summary block is left alone", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({
    ...message("> ⚠️ **Warning**\n>\n> risk"),
    props: {
      text: "> ⚠️ **Warning**\n>\n> risk",
      isFirstOfReply: false,
      isSummary: true,
    },
  } as any)
  expect(framed(walk(await ui.drawn())).length).toBe(0)
  await ui.unmount()
})

test("the shapes the model is told to write are the ones the parser draws", () => {
  const examples: [string, string][] = [
    ["> ⚠️ **Warning**", "> ⚠️ **Warning**\n>\n> body"],
    ["acme/api   ✓✓✗✓", "```\nacme/api   ✓✓✗✓\n```"],
    ["release 2.4  ████████░░  8/10", "```\nrelease 2.4  ████████░░  8/10\n```"],
    ["label  ██████▌  6.1", "```\nlabel  ██████▌  6.1\n\nother  ██  2\n```"],
    ["▸ summary (", "▸ summary (2 lines)\n```\na\nb\n```"],
    ["```sh fence", "```sh\nnpm test\n```"],
  ]
  for (const [needle, text] of examples) {
    expect(SHAPES).toContain(needle)
    expect({ text, kind: parseReply(text)[0]?.kind }).not.toEqual({ text, kind: "markdown" })
  }
})
