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
    ["- ✅ done [acme/api#41]", "**W**: ✅ 2 done\n- ✅ done [acme/api#41](https://github.com/acme/api/pull/41) docs fixed\n- ✅ done [acme/web#12](https://github.com/acme/web/pull/12) bump merged"],
  ]
  for (const [needle, text] of examples) {
    expect(SHAPES).toContain(needle)
    expect({ text, kind: parseReply(text)[0]?.kind }).not.toEqual({ text, kind: "markdown" })
  }
})

const LEDGER = [
  "**Wave 2**: 🚨 1 urgent · 👉 1 yours · ⏳ 1 pending · ✅ 2 done",
  "- 🚨 urgent [acme/api#44](https://github.com/acme/api/pull/44) prod deploy blocked",
  "- 👉 yours [acme/site#7](https://github.com/acme/site/pull/7) needs your go",
  "- ⏳ pending [acme/cli#9](https://github.com/acme/cli/pull/9) CI running",
  "- ✅ done [acme/api#41](https://github.com/acme/api/pull/41) docs fixed",
  "- ✅ done [acme/web#12](https://github.com/acme/web/pull/12) bump merged",
].join("\n")

test("a ledger parses to a status card, rows in the order written", () => {
  const [block, ...rest] = parseReply(`${LEDGER}\n\nThe deploy waits on the quota fix.`)
  expect(block?.kind).toBe("status")
  if (block?.kind !== "status") return
  expect(block.title).toBe("Wave 2")
  expect(block.rows.map((row) => [row.state, row.ref])).toEqual([
    ["urgent", "acme/api#44"],
    ["yours", "acme/site#7"],
    ["pending", "acme/cli#9"],
    ["done", "acme/api#41"],
    ["done", "acme/web#12"],
  ])
  expect(rest).toEqual([{ kind: "markdown", text: "The deploy waits on the quota fix." }])
})

test("a French ledger parses with its French state words", () => {
  const text = [
    "**Vague 2**\u00a0: ⏳ 1 en attente · 👉 1 à vous",
    "- ⏳ en attente [acme/cli#9](https://github.com/acme/cli/pull/9) CI en cours",
    "- 👉 à vous [acme/site#7](https://github.com/acme/site/pull/7) attend votre feu vert",
  ].join("\n")
  expect(parseReply(text).map((b) => b.kind)).toEqual(["status"])
})

test("a ledger that is not exact stays Markdown", () => {
  const misses = [
    LEDGER.replace("✅ 2 done", "✅ 3 done"),
    LEDGER.replace("[acme/cli#9](https://github.com/acme/cli/pull/9)", "acme/cli#9"),
    LEDGER.replace("- 👉 yours", "- 👉 mine"),
    LEDGER.replace("\n- 🚨", "\n\n- 🚨"),
    "**Wave 2**: ✅ 1 done\n- ✅ done [acme/api#41](https://github.com/acme/api/pull/41) docs fixed",
    "| **State** | **Ref** | **What** |\n| --- | --- | --- |\n| ✅ done | acme/api#41 | docs fixed |",
  ]
  for (const text of misses)
    expect({ text, card: parseReply(text).some((b) => b.kind === "status") }).toEqual({
      text,
      card: false,
    })
})

test("a status card colours each state word beside its emoji and links each ref", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(LEDGER) as any)
  const nodes = walk(await ui.drawn())
  expect(framed(nodes).length).toBe(1)
  const word = (w: string) => nodes.find((n) => n.type === "Text" && (n.children ?? []).join("") === w)
  expect(word("🚨 urgent")?.props?.color).toBe("error")
  expect(word("✅ done")?.props?.color).toBe("success")
  expect(
    nodes.filter((n) => n.type === "Link").map((n) => n.props?.href),
  ).toContain("https://github.com/acme/site/pull/7")
  await ui.unmount()
})

test("the reply's own closing rule is dropped, as the ask card draws it", async ($, on) => {
  const engine: string[] = []
  on("ui.render", { component: "AssistantMessage" }, (_: unknown, e: any) => {
    engine.push(e.props.text)
    return { type: "Text", props: {}, children: [e.props.text] }
  })
  await boot($, on)
  const drawnText = async (text: string) => {
    engine.length = 0
    const ui = await $.ui.mount(message(text) as any)
    const all = [textOf(walk(await ui.drawn())), ...engine].join(" ")
    await ui.unmount()
    return all
  }
  expect(await drawnText("Both are ready.\n\n── 👋 Over to you ──\n")).not.toContain("Over to you")
  expect(await drawnText("Prêt.\n\n── 👋 À vous ──")).not.toContain("À vous")
  expect(
    await drawnText("> ⚠️ **Warning**\n>\n> risk\n\n── 👋 Over to you ──"),
  ).not.toContain("Over to you")
  expect(await drawnText("── 👋 Over to you ──\nthen more prose")).toContain("Over to you")
})

test("a card wider than the viewport is held to it, so its right border is drawn", async ($, on) => {
  await boot($, on)
  const widths = async (text: string, columns?: number) => {
    const ui = await $.ui.mount({
      ...message(text),
      ...(columns ? { viewport: { columns, rows: 40 } } : { viewport: undefined }),
    } as any)
    const found = framed(walk(await ui.drawn())).map((n) => n.props?.width)
    await ui.unmount()
    return found
  }
  const long = `> ⚠️ **Warning**\n>\n> ${"word ".repeat(30).trim()}`
  expect(await widths(long, 40)).toEqual([38])
  expect(await widths("> 💡 **Tip**\n>\n> short", 100)).toEqual([undefined])
  expect(await widths(long)).toEqual([undefined])
  const grid = "```\n" + `${"x".repeat(30)}   ${"✓".repeat(40)}` + "\n```"
  expect(await widths(grid, 50)).toEqual([48])
})

const LABELLED = [
  "```",
  "CI, last runs",
  "            lint test build",
  "acme/api    ✓✓✗",
  "acme/web    ✓✓✓",
  "```",
].join("\n")

test("a grid may name its columns on a label line", () => {
  expect(parseReply(LABELLED)).toEqual([
    {
      kind: "grid",
      title: "CI, last runs",
      columns: ["lint", "test", "build"],
      rows: [
        { subject: "acme/api", runs: [true, true, false] },
        { subject: "acme/web", runs: [true, true, true] },
      ],
    },
  ])
  expect(parseReply(LABELLED.replace("✓✓✗", "✓✗")).map((b) => b.kind)).toEqual(["markdown"])
  expect(
    parseReply("```\n      lint test\nacme/api  ✓✗\n```")[0],
  ).toMatchObject({ kind: "grid", columns: ["lint", "test"] })
})

test("a labelled grid draws its labels over the glyph columns", async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(LABELLED) as any)
  const nodes = walk(await ui.drawn())
  const labels = nodes.filter(
    (n) => n.type === "Text" && n.props?.color === "inactive",
  )
  expect(textOf(labels)).toContain("lint")
  expect(textOf(labels)).toContain("build")
  const marks = nodes.filter((n) => n.type === "Text" && n.props?.color === "error")
  expect(marks.length).toBe(1)
  await ui.unmount()
})
