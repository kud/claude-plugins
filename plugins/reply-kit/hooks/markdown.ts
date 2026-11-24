// Reads a finished reply's Markdown and finds the design system's exact text
// shapes, so they can be drawn as cards with no tool call. Anything that is not
// exactly a shape stays Markdown: a near miss never becomes a broken card.
// No `$` here, so tests run it directly.
import { CALLOUTS } from "./visual"
import type { CalloutKind, StatusState } from "./visual"

export type Block =
  | { kind: "markdown"; text: string }
  | { kind: "callout"; callout: CalloutKind; label: string; body: string }
  | {
      kind: "grid"
      title?: string
      columns?: string[]
      rows: { subject: string; runs: boolean[] }[]
    }
  | { kind: "progress"; label: string; value: number; max: number }
  | {
      kind: "bars"
      title?: string
      items: { label: string; bar: string; figure: string }[]
    }
  | {
      kind: "fold"
      summary: string
      lines: number
      head: string[]
      rest: number
    }
  | { kind: "copy"; values: string[] }
  | {
      kind: "status"
      title: string
      counts: string
      rows: LedgerRow[]
    }

export type LedgerRow = {
  state: StatusState
  word: string
  ref: string
  url: string
  what: string
}

const EMOJI = new Map<string, CalloutKind>(
  (Object.keys(CALLOUTS) as CalloutKind[]).map((kind) => [
    CALLOUTS[kind].emoji,
    kind,
  ]),
)

const CALLOUT_HEAD = /^> (\S+) \*\*([^*]+)\*\*$/
const FENCE = /^```([\w-]*)$/
const GRID_ROW = /^(\S(?:.*\S)?) {2,}([✓✗]+)$/
// Column labels sit over the glyphs: indented, one word per column.
const GRID_HEAD = /^ {2,}(\S+(?: \S+)*)$/
const ASK_RULE = /^── 👋 (Over to you|À vous) ──$/
const PROGRESS =
  /^(\S(?:.*\S)?) {2}(█*)(░*) {2}(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/
const BAR_ROW = /^(\S(?:.*\S)?) {2,}(█*[▏▎▍▌▋▊▉]?) {2,}(\S+)$/
const FOLD_HEAD = /^▸ (.+) \((\d+) lines\)$/
const FOLD_TAIL = /^… (\d+) more lines$/
// The six states, by emoji, with their English and French words.
const STATES = new Map<string, { state: StatusState; words: string[] }>([
  ["🚨", { state: "urgent", words: ["urgent"] }],
  ["👉", { state: "yours", words: ["yours", "à vous"] }],
  ["⚠️", { state: "risk", words: ["risk", "risque"] }],
  ["⏳", { state: "pending", words: ["pending", "en attente"] }],
  ["💤", { state: "open", words: ["open", "ouvert"] }],
  ["✅", { state: "done", words: ["done", "fait"] }],
])
// French typography may put a non-breaking space before the colon.
const LEDGER_HEAD = /^\*\*([^*]+)\*\*[\u00a0\u202f ]?: (.+)$/
const LEDGER_COUNT = /^(\S+) (\d+) (.+)$/
const LEDGER_ROW = /^- (\S+) (.+?) \[([^\]]+)\]\((https?:\/\/[^)\s]+)\) (\S.*)$/
const SHELL = new Set(["sh", "bash", "zsh", "shell", "console"])
const COPY_MAX = 4

const fenceEnd = (lines: string[], from: number) => {
  for (let at = from; at < lines.length; at += 1)
    if (lines[at] === "```") return at
  return -1
}

const readCallout = (lines: string[], at: number) => {
  const head = (lines[at] ?? "").match(CALLOUT_HEAD)
  const callout = head && EMOJI.get(head[1] ?? "")
  if (!head || !callout) return undefined
  // The design system keeps a bare `>` line under the head; a reply without it is still a call-out.
  const start = lines[at + 1] === ">" ? at + 2 : at + 1
  let end = start
  while (end < lines.length && /^>( |$)/.test(lines[end] ?? "")) end += 1
  const body = lines
    .slice(start, end)
    .map((line) => line.replace(/^> ?/, ""))
    .join("\n")
    .trim()
  if (!body) return undefined
  return {
    block: { kind: "callout", callout, label: head[2] ?? "", body } as const,
    end,
  }
}

const stateOf = (emoji: string, word: string) => {
  const known = STATES.get(emoji)
  return known && known.words.includes(word) ? known.state : undefined
}

// A ledger: a bold title with its counts, then two or more linked rows right
// under it. The counts must agree with the rows, or it stays Markdown.
const readLedger = (lines: string[], at: number) => {
  const head = (lines[at] ?? "").match(LEDGER_HEAD)
  if (!head) return undefined
  const counts = new Map<StatusState, number>()
  for (const part of (head[2] ?? "").split(" · ")) {
    const count = part.match(LEDGER_COUNT)
    const state = count && stateOf(count[1] ?? "", count[3] ?? "")
    if (!count || !state || counts.has(state)) return undefined
    counts.set(state, Number(count[2]))
  }
  const rows: LedgerRow[] = []
  let end = at + 1
  for (; end < lines.length; end += 1) {
    const row = (lines[end] ?? "").match(LEDGER_ROW)
    const state = row && stateOf(row[1] ?? "", row[2] ?? "")
    if (!row || !state) break
    rows.push({
      state,
      word: `${row[1]} ${row[2]}`,
      ref: row[3] ?? "",
      url: row[4] ?? "",
      what: row[5] ?? "",
    })
  }
  if (rows.length < 2) return undefined
  for (const [state, count] of counts)
    if (rows.filter((row) => row.state === state).length !== count)
      return undefined
  if (rows.some((row) => !counts.has(row.state))) return undefined
  return {
    block: {
      kind: "status",
      title: head[1] ?? "",
      counts: head[2] ?? "",
      rows,
    } as const,
    end,
  }
}

// One fence: a run grid, a progress bar, a bar list, or shell lines to copy.
const readFence = (lang: string, body: string[]): Block | undefined => {
  const filled = body.filter((line) => line.trim() !== "")
  if (filled.length === 0) return undefined

  if (!lang) {
    // A grid may open on a title line, then a line of column labels; every
    // other line is a row, as many glyphs as there are labels.
    let from = 0
    const isHead = (line: string) => GRID_HEAD.test(line)
    const titled =
      filled.length > 1 &&
      !GRID_ROW.test(filled[0] ?? "") &&
      !isHead(filled[0] ?? "")
    if (titled) from += 1
    const head = (filled[from] ?? "").match(GRID_HEAD)
    if (head) from += 1
    const columns = head ? (head[1] ?? "").split(" ") : undefined
    const grid = filled.slice(from).map((line) => line.match(GRID_ROW))
    const fits = (row: RegExpMatchArray | null) =>
      !columns || [...(row?.[2] ?? "")].length === columns.length
    if (grid.length > 0 && grid.every(Boolean) && grid.every(fits))
      return {
        kind: "grid",
        ...(titled ? { title: filled[0] ?? "" } : {}),
        ...(columns ? { columns } : {}),
        rows: grid.map((row) => ({
          subject: row![1] ?? "",
          runs: [...(row![2] ?? "")].map((glyph) => glyph === "✓"),
        })),
      }

    const progress = filled.length === 1 && (filled[0] ?? "").match(PROGRESS)
    if (progress && (progress[2] ?? "").length + (progress[3] ?? "").length > 0) {
      const value = Number(progress[4])
      const max = Number(progress[5])
      if (max > 0) return { kind: "progress", label: progress[1] ?? "", value, max }
    }

    // A bar list keeps a blank line between bars, so blocks never fuse; it
    // may open on a title line and a blank line.
    const hasTitle = body.length > 2 && !BAR_ROW.test(body[0] ?? "") && (body[1] ?? "").trim() === ""
    const rows = body.slice(hasTitle ? 2 : 0)
    const bars = rows.filter((line) => line.trim() !== "").map((line) => line.match(BAR_ROW))
    const spaced = rows.every((line, index) =>
      index % 2 === 1 ? line.trim() === "" : line.trim() !== "",
    )
    if (bars.length > 1 && spaced && bars.every((bar) => bar && bar[2]))
      return {
        kind: "bars",
        ...(hasTitle ? { title: body[0] ?? "" } : {}),
        items: bars.map((bar) => ({
          label: bar![1] ?? "",
          bar: bar![2] ?? "",
          figure: bar![3] ?? "",
        })),
      }
    return undefined
  }

  if (SHELL.has(lang) && filled.length <= COPY_MAX)
    return { kind: "copy", values: filled }
  return undefined
}

export const parseReply = (text: string): Block[] => {
  const lines = text.split("\n")
  const blocks: Block[] = []
  let plain: string[] = []
  const flush = () => {
    if (plain.some((line) => line.trim() !== ""))
      blocks.push({ kind: "markdown", text: plain.join("\n").trim() })
    plain = []
  }

  let at = 0
  while (at < lines.length) {
    const line = lines[at] ?? ""

    const ledger = readLedger(lines, at)
    if (ledger) {
      flush()
      blocks.push(ledger.block)
      at = ledger.end
      continue
    }

    const callout = readCallout(lines, at)
    if (callout) {
      flush()
      blocks.push(callout.block)
      at = callout.end
      continue
    }

    const fold = line.match(FOLD_HEAD)
    const foldFence = fold && lines[at + 1]?.match(FENCE)
    if (fold && foldFence) {
      const end = fenceEnd(lines, at + 2)
      if (end > 0) {
        const body = lines.slice(at + 2, end)
        const tail = body.at(-1)?.match(FOLD_TAIL)
        const head = tail ? body.slice(0, -1) : body
        flush()
        blocks.push({
          kind: "fold",
          summary: fold[1] ?? "",
          lines: Number(fold[2]),
          head,
          rest: tail ? Number(tail[1]) : 0,
        })
        at = end + 1
        continue
      }
    }

    const fence = line.match(FENCE)
    if (fence) {
      const end = fenceEnd(lines, at + 1)
      // An unclosed fence is still streaming, or malformed: it stays Markdown.
      if (end < 0) {
        plain.push(...lines.slice(at))
        break
      }
      const block = readFence(fence[1] ?? "", lines.slice(at + 1, end))
      if (block) {
        flush()
        blocks.push(block)
      } else {
        plain.push(...lines.slice(at, end + 1))
      }
      at = end + 1
      continue
    }

    plain.push(line)
    at += 1
  }
  flush()
  return blocks
}

// The ask card draws its own `── 👋 Over to you ──` heading, so the same rule
// closing the reply's text is dropped rather than shown twice.
export const dropAskRule = (text: string) => {
  const lines = text.trimEnd().split("\n")
  if (!ASK_RULE.test(lines.at(-1) ?? "")) return text
  return lines.slice(0, -1).join("\n").trimEnd()
}

export const hasCard = (blocks: Block[]) =>
  blocks.some((block) => block.kind !== "markdown")

// The one thing the model reads: the shapes, so a reply can carry them. Sent
// with the system prompt, behind the cache boundary.
export const SHAPES = [
  "Reply shapes drawn as cards. Write them exactly, only when they fit; anything else stays plain Markdown.",
  "- Call-out: `> ⚠️ **Warning**`, a `>` line, then `> ` body lines. ⚠️ warning or cost, 💡 tip, ℹ️ info, ⭐ insight, 🚨 urgent, 🌶️ concern; the label follows the reply's language.",
  "- Run grid, in a fence: an optional title line, an optional label line indented under the glyphs (`           lint test build e2e`, one word per column), then `acme/api   ✓✓✗✓` per subject, oldest run first.",
  "- Progress, in a fence: `release 2.4  ████████░░  8/10`, ten cells.",
  "- Bar list, in a fence: `label  ██████▌  6.1` per item, a blank line between bars.",
  "- Fold: `▸ summary (N lines)`, then a fence holding the first 20 lines and `… M more lines`.",
  "- Commands to copy: a ```sh fence, at most four lines.",
  "- Status ledger, plain Markdown: `**Wave 2**: 👉 1 yours · ✅ 2 done` (counts in state order), then one row per item directly under it: `- ✅ done [acme/api#41](https://github.com/acme/api/pull/41) docs fixed`. States in order: 🚨 urgent, 👉 yours, ⚠️ risk, ⏳ pending, 💤 open, ✅ done; from five rows, grouped in that order.",
  "- Closing ask: call mcp__reply-kit__ask instead of writing the `── 👋 Over to you ──` block. The call ends the turn: write nothing after it.",
].join("\n")
