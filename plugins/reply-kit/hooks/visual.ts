// The four visual cards: readers for their inputs, their text shapes (the
// design system's, exactly), and the layout values the cards draw from.
// No `$` here, so tests and fixtures run against it directly.

export type CalloutKind =
  "warning" | "tip" | "info" | "insight" | "urgent" | "concern"
export type CalloutInput = { kind: CalloutKind; body: string; label?: string }

export type GridRow = { subject: string; runs: boolean[] }
export type GridInput = { title?: string; rows: GridRow[] }

export type BarItem = {
  label: string
  value: number
  max?: number
  display?: string
}
export type BarInput =
  | { kind: "progress"; label: string; value: number; max: number }
  | { kind: "list"; title?: string; unit?: string; items: BarItem[] }
  | {
      kind: "spark"
      title?: string
      figure: string
      note?: string
      values: number[]
    }

export type StatusState =
  "done" | "pending" | "yours" | "risk" | "urgent" | "open"
export type StatusRow = { state: StatusState; ref: string; what: string }
export type StatusInput = { title: string; items: StatusRow[] }

const record = (value: unknown) =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

// ── callout ─────────────────────────────────────────────────────────────

export const CALLOUTS: Record<
  CalloutKind,
  { emoji: string; label: string; french: string; border: string }
> = {
  warning: {
    emoji: "⚠️",
    label: "Warning",
    french: "Attention",
    border: "warning",
  },
  tip: { emoji: "💡", label: "Tip", french: "Conseil", border: "suggestion" },
  info: { emoji: "ℹ️", label: "Info", french: "Info", border: "subtle" },
  insight: {
    emoji: "⭐",
    label: "Insight",
    french: "À retenir",
    border: "claude",
  },
  urgent: { emoji: "🚨", label: "Urgent", french: "Urgent", border: "error" },
  concern: {
    emoji: "🌶️",
    label: "Concern",
    french: "Réserve",
    border: "error",
  },
}

export const readCallout = (value: unknown): CalloutInput | undefined => {
  const input = record(value)
  const kind = input?.kind
  if (typeof kind !== "string" || !(kind in CALLOUTS) || !isText(input?.body))
    return undefined
  const french = input?.french === true
  const fixed = CALLOUTS[kind as CalloutKind]
  const label = isText(input?.label)
    ? input.label
    : french
      ? fixed.french
      : fixed.label
  return { kind: kind as CalloutKind, body: input.body, label }
}

export const calloutHead = (input: CalloutInput) =>
  `${CALLOUTS[input.kind].emoji} ${input.label}`

export const calloutMarkdown = (input: CalloutInput) =>
  [
    `> ${CALLOUTS[input.kind].emoji} **${input.label}**`,
    ">",
    ...input.body.split("\n").map((line) => (line ? `> ${line}` : ">")),
  ].join("\n")

// ── run grid ────────────────────────────────────────────────────────────

const readRuns = (value: unknown): boolean[] | undefined => {
  if (typeof value === "string") {
    const glyphs = [...value].filter((glyph) => glyph === "✓" || glyph === "✗")
    return glyphs.length > 0 ? glyphs.map((glyph) => glyph === "✓") : undefined
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((run) => typeof run === "boolean")
  )
    return value as boolean[]
  return undefined
}

export const readGrid = (value: unknown): GridInput | undefined => {
  const input = record(value)
  if (!Array.isArray(input?.rows)) return undefined
  const rows = input.rows
    .map(record)
    .map((row) => ({ subject: row?.subject, runs: readRuns(row?.runs) }))
    .filter(
      (row): row is GridRow => isText(row.subject) && row.runs !== undefined,
    )
  if (rows.length === 0) return undefined
  return { title: isText(input.title) ? input.title : undefined, rows }
}

export const glyphs = (runs: boolean[]) =>
  runs.map((pass) => (pass ? "✓" : "✗")).join("")

export const gridMarkdown = (input: GridInput) => {
  const width = Math.max(...input.rows.map((row) => row.subject.length))
  return [
    ...(input.title ? [input.title] : []),
    ...input.rows.map(
      (row) => `${row.subject.padEnd(width)}   ${glyphs(row.runs)}`,
    ),
  ].join("\n")
}

// ── bar, bar list, sparkline ────────────────────────────────────────────

const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]
const SPARKS = "▁▂▃▄▅▆▇█"

export const readBar = (value: unknown): BarInput | undefined => {
  const input = record(value)
  if (input?.kind === "progress") {
    if (
      !isText(input.label) ||
      !isNumber(input.value) ||
      !isNumber(input.max) ||
      input.max <= 0
    )
      return undefined
    return {
      kind: "progress",
      label: input.label,
      value: input.value,
      max: input.max,
    }
  }
  if (input?.kind === "list") {
    if (!Array.isArray(input.items)) return undefined
    const items = input.items
      .map(record)
      .filter(
        (item) =>
          isText(item?.label) && isNumber(item?.value) && item!.value >= 0,
      )
      .map((item) => ({
        label: item!.label as string,
        value: item!.value as number,
        display: isText(item!.display) ? item!.display : undefined,
      }))
    if (items.length === 0) return undefined
    return {
      kind: "list",
      title: isText(input.title) ? input.title : undefined,
      unit: isText(input.unit) ? input.unit : undefined,
      items,
    }
  }
  if (input?.kind === "spark") {
    if (!isText(input.figure) || !Array.isArray(input.values)) return undefined
    const values = input.values.filter(isNumber)
    if (values.length < 2) return undefined
    return {
      kind: "spark",
      title: isText(input.title) ? input.title : undefined,
      figure: input.figure,
      note: isText(input.note) ? input.note : undefined,
      values,
    }
  }
  return undefined
}

export const progressCells = (value: number, max: number, width = 10) => {
  const filled = Math.round((Math.min(Math.max(value, 0), max) / max) * width)
  return { fill: "█".repeat(filled), track: "░".repeat(width - filled) }
}

// The longest bar is `width` cells; the rest are cut to eighths.
export const listBar = (value: number, top: number, width = 20) => {
  if (top <= 0) return ""
  const eighths = Math.round((value / top) * width * 8)
  return "█".repeat(Math.floor(eighths / 8)) + EIGHTHS[eighths % 8]
}

export const sparkline = (values: number[]) => {
  const low = Math.min(...values)
  const span = Math.max(...values) - low
  return values
    .map(
      (value) =>
        SPARKS[span === 0 ? 3 : Math.round(((value - low) / span) * 7)],
    )
    .join("")
}

const figureOf = (item: BarItem) => item.display ?? String(item.value)

export const barMarkdown = (input: BarInput) => {
  if (input.kind === "progress") {
    const { fill, track } = progressCells(input.value, input.max)
    return `${input.label}  ${fill}${track}  ${input.value}/${input.max}`
  }
  if (input.kind === "spark") {
    return [
      ...(input.title ? [input.title] : []),
      [input.figure, input.note].filter(Boolean).join("  "),
      sparkline(input.values),
    ].join("\n")
  }
  const top = Math.max(...input.items.map((item) => item.value))
  const width = Math.max(...input.items.map((item) => item.label.length))
  const title = input.title
    ? [`${input.title}${input.unit ? ` (${input.unit})` : ""}`, ""]
    : []
  // One bar per line with a blank line between: block glyphs on adjacent lines fuse.
  return [
    ...title,
    input.items
      .map(
        (item) =>
          `${item.label.padEnd(width)}  ${listBar(item.value, top)}  ${figureOf(item)}`,
      )
      .join("\n\n"),
  ].join("\n")
}

// ── status columns ──────────────────────────────────────────────────────

export const STATUS: Record<StatusState, { word: string; colour: string }> = {
  done: { word: "✅ done", colour: "success" },
  pending: { word: "⏳ pending", colour: "warning" },
  yours: { word: "👉 yours", colour: "permission" },
  risk: { word: "⚠️ risk", colour: "warning" },
  urgent: { word: "🚨 urgent", colour: "error" },
  open: { word: "💤 open", colour: "text" },
}

// What needs the reader first, the finished last (the design system's Ledger order).
const GROUP_ORDER: StatusState[] = [
  "urgent",
  "yours",
  "risk",
  "pending",
  "open",
  "done",
]
const WHAT_MAX = 40
export const REF_MAX = 24

export const cut = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

export const readStatus = (value: unknown): StatusInput | undefined => {
  const input = record(value)
  if (!isText(input?.title) || !Array.isArray(input.items)) return undefined
  const items = input.items
    .map(record)
    .filter(
      (item) =>
        typeof item?.state === "string" &&
        item.state in STATUS &&
        isText(item.ref),
    )
    .map((item) => ({
      state: item!.state as StatusState,
      ref: item!.ref as string,
      what: cut(String(item!.what ?? ""), WHAT_MAX),
    }))
  if (items.length === 0) return undefined
  return { title: input.title, items }
}

// Grouped by state from five rows, computed once from the input: a redraw
// never moves a row.
export const statusRows = (input: StatusInput) =>
  input.items.length < 5
    ? input.items
    : [...input.items].sort(
        (a, b) => GROUP_ORDER.indexOf(a.state) - GROUP_ORDER.indexOf(b.state),
      )

export const statusCounts = (input: StatusInput) =>
  GROUP_ORDER.map((state) => ({
    state,
    count: input.items.filter((item) => item.state === state).length,
  }))
    .filter((one) => one.count > 0)
    .map((one) => {
      const [emoji, word] = STATUS[one.state].word.split(" ")
      return `${emoji} ${one.count} ${word}`
    })
    .join(" · ")

export const statusMarkdown = (input: StatusInput) =>
  [
    `**${input.title}**: ${statusCounts(input)}`,
    "",
    "| **State** | **Ref** | **What** |",
    "| --- | --- | --- |",
    ...statusRows(input).map(
      (item) => `| ${STATUS[item.state].word} | ${item.ref} | ${item.what} |`,
    ),
  ].join("\n")

// ── card width ──────────────────────────────────────────────────────────

// The transcript's bullet column, left of every reply and tool row.
const GUTTER = 2

// Cells a line takes: an emoji two, a variation selector none, the rest one.
export const cells = (text: string) => {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 0xfe0f || code === 0x200d) continue
    width += code >= 0x1f000 ? 2 : 1
  }
  return width
}

// A card wider than the room left by the gutter loses its right border, so it
// is held to that room; a card that fits keeps its own width.
export const cardWidth = (
  lines: string[],
  columns: number | undefined,
  paddingX: number,
) => {
  if (columns === undefined) return undefined
  const natural =
    Math.max(0, ...lines.flatMap((line) => line.split("\n")).map(cells)) +
    2 +
    2 * paddingX
  const room = Math.max(10, columns - GUTTER)
  return natural > room ? room : undefined
}
