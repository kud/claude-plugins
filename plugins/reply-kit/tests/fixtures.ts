// Golden fixtures: each tool input and the exact text shape its result must be.
// The text shapes are the response design system's; drift fails the tests.

export type Fixture = {
  name: string
  tool: string
  input: Record<string, unknown>
  text: string
}

const long = "acme/a-very-long-repository-name-for-grids"

export const FIXTURES: Fixture[] = [
  {
    name: "callout: warning",
    tool: "callout",
    input: {
      kind: "warning",
      body: "The release tag already exists on origin; a push will be refused.",
    },
    text: "> ⚠️ **Warning**\n>\n> The release tag already exists on origin; a push will be refused.",
  },
  {
    name: "callout: tip, in French",
    tool: "callout",
    input: {
      kind: "tip",
      french: true,
      body: "Lancez les tests avant la release.",
    },
    text: "> 💡 **Conseil**\n>\n> Lancez les tests avant la release.",
  },
  {
    name: "callout: urgent",
    tool: "callout",
    input: {
      kind: "urgent",
      body: "main is red since 14:02: every merge is blocked.",
    },
    text: "> 🚨 **Urgent**\n>\n> main is red since 14:02: every merge is blocked.",
  },
  {
    name: "callout: insight with bullets",
    tool: "callout",
    input: {
      kind: "insight",
      body: "- padEnd counts code units\n- Ink counts columns",
    },
    text: "> ⭐ **Insight**\n>\n> - padEnd counts code units\n> - Ink counts columns",
  },
  {
    name: "grid: a failure in the history",
    tool: "grid",
    input: {
      title: "CI, last 7 runs",
      rows: [
        { subject: "kud/ambre", runs: "✓✓✓✗✓✓✓" },
        { subject: "kud/tutti", runs: "✓✓✓✓✓✓✓" },
      ],
    },
    text: "CI, last 7 runs\nkud/ambre   ✓✓✓✗✓✓✓\nkud/tutti   ✓✓✓✓✓✓✓",
  },
  {
    name: "grid: a subject past 40 columns is not cut in text",
    tool: "grid",
    input: {
      rows: [
        { subject: long, runs: "✓✗" },
        { subject: "acme/api", runs: "✓✓" },
      ],
    },
    text: `${long}   ✓✗\n${"acme/api".padEnd(long.length)}   ✓✓`,
  },
  {
    name: "bar: progress with its figure",
    tool: "bar",
    input: { kind: "progress", label: "release 2.4", value: 8, max: 10 },
    text: "release 2.4  ████████░░  8/10",
  },
  {
    name: "bar: sparkline with its window",
    tool: "bar",
    input: {
      kind: "spark",
      title: "kud.io build, median",
      figure: "41 s",
      note: "▼ 7 s over 7 days (better)",
      values: [3, 5, 4, 3, 6, 8, 7, 4, 3, 2, 2, 2, 1, 1],
    },
    text: "kud.io build, median\n41 s  ▼ 7 s over 7 days (better)\n▃▅▄▃▆█▇▄▃▂▂▂▁▁",
  },
  {
    name: "bar: a list keeps a blank line between bars",
    tool: "bar",
    input: {
      kind: "list",
      title: "CI time per repo",
      unit: "min",
      items: [
        { label: "ambre", value: 14.2 },
        { label: "kud.io", value: 6.1 },
        { label: "gh", value: 3.4 },
      ],
    },
    text: "CI time per repo (min)\n\nambre   ████████████████████  14.2\n\nkud.io  ████████▋  6.1\n\ngh      ████▊  3.4",
  },
  {
    name: "status: four rows keep their order",
    tool: "status",
    input: {
      title: "Wave 2",
      items: [
        { state: "done", ref: "kud/ambre#41", what: "docs fixed" },
        { state: "done", ref: "kud/tutti#12", what: "bump merged" },
        { state: "pending", ref: "kud/foxhop#9", what: "CI running" },
        { state: "yours", ref: "kud/pastille#7", what: "needs a go" },
      ],
    },
    text: [
      "**Wave 2**: ✅ 2 done · ⏳ 1 pending · 👉 1 yours",
      "",
      "| **State** | **Ref** | **What** |",
      "| --- | --- | --- |",
      "| ✅ done | kud/ambre#41 | docs fixed |",
      "| ✅ done | kud/tutti#12 | bump merged |",
      "| ⏳ pending | kud/foxhop#9 | CI running |",
      "| 👉 yours | kud/pastille#7 | needs a go |",
    ].join("\n"),
  },
  {
    name: "status: five rows group by state, a long what is cut",
    tool: "status",
    input: {
      title: "Sweep",
      items: [
        { state: "open", ref: "acme/a#1", what: "not started" },
        { state: "done", ref: "acme/b#2", what: "merged" },
        {
          state: "urgent",
          ref: "acme/c#3",
          what: "main is red and every merge is blocked now",
        },
        { state: "pending", ref: "acme/d#4", what: "CI running" },
        { state: "done", ref: "acme/e#5", what: "released" },
      ],
    },
    text: [
      "**Sweep**: ✅ 2 done · ⏳ 1 pending · 🚨 1 urgent · 💤 1 open",
      "",
      "| **State** | **Ref** | **What** |",
      "| --- | --- | --- |",
      "| ✅ done | acme/b#2 | merged |",
      "| ✅ done | acme/e#5 | released |",
      "| ⏳ pending | acme/d#4 | CI running |",
      "| 🚨 urgent | acme/c#3 | main is red and every merge is blocked… |",
      "| 💤 open | acme/a#1 | not started |",
    ].join("\n"),
  },
]
