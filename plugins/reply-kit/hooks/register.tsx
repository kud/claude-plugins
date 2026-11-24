import { atom, read, update } from "claude-code"
import type { EngineInterface, Register } from "claude-code"

import type { AskInput, ChooseState, LiveInput } from "../types"
import {
  chosenText,
  isOver,
  liveArgv,
  parseRun,
  readLive,
  runMarkdown,
  stateWord,
} from "./inputs"
import { SHAPES, hasCard, parseReply } from "./markdown"
import type { Block } from "./markdown"
import { answerText, askMarkdown, readAsk } from "./shapes"
import { CALLOUTS, REF_MAX, STATUS, cut, glyphs, progressCells } from "./visual"

// Two tools only: the ones that do something. Everything else is drawn from
// the reply's own Markdown, which costs no tokens.
const ASK = "mcp__reply-kit__ask"
const LIVE = "mcp__reply-kit__live"
const TOOLS = [ASK, LIVE]

// Read by the model after the result, never shown: the card already carries the content.
const LAST =
  "The user sees this ask as a card with buttons. End your reply here: write nothing after it."
const SHOWN =
  "The user sees this as a card. Do not restate it; go on with anything new, or stop."

// Wide enough for the longest state, `⏳ en attente`, and a gap.
const STATE_WIDTH = 14

const POLL_MS = 15_000
const MAX_POLLS = 120

const answers = atom(
  { plugin: "reply-kit", key: "answers" } as const,
  {},
  { shape: "answers-1" },
)
const copies = atom(
  { plugin: "reply-kit", key: "copies" } as const,
  {},
  { shape: "copies-1" },
)
const choices = atom(
  { plugin: "reply-kit", key: "choices" } as const,
  {},
  { shape: "choices-1" },
)
const runs = atom(
  { plugin: "reply-kit", key: "runs" } as const,
  {},
  { shape: "runs-1" },
)
const folds = atom(
  { plugin: "reply-kit", key: "folds" } as const,
  {},
  { shape: "folds-1" },
)

const NO_CHOICE: ChooseState = { picked: [], isSent: false }

// A gated answer only drafts: the user's own Enter sends it, so the turn
// arrives as their message, not as one a plugin submitted.
async function reply($: EngineInterface, text: string, isGated: boolean) {
  if (isGated) {
    await $.prompt.fill({ text })
  } else {
    await $.prompt.submit({ text })
  }
}

async function choose(
  $: EngineInterface,
  id: string,
  input: AskInput,
  index: number,
) {
  await update($, answers, (all) => ({ ...all, [id]: index }))
  await reply($, answerText(input, index), input.isGated === true)
}

async function toggle($: EngineInterface, id: string, index: number) {
  await update($, choices, (all) => {
    const state = all[id] ?? NO_CHOICE
    if (state.isSent) return all
    const picked = state.picked.includes(index)
      ? state.picked.filter((one) => one !== index)
      : [...state.picked, index]
    return { ...all, [id]: { picked, isSent: false } }
  })
}

async function sendChoice($: EngineInterface, id: string, isGated: boolean) {
  const state = (await read($, choices))[id] ?? NO_CHOICE
  if (state.isSent || state.picked.length === 0) return
  await update($, choices, (all) => ({
    ...all,
    [id]: { ...state, isSent: true },
  }))
  await reply($, chosenText(state.picked), isGated)
}

async function copyOne(
  $: EngineInterface,
  id: string,
  value: string,
  index: number,
  surface: string,
) {
  const copied = await $.ui.copy({ text: value, surface: surface as never })
  await update($, copies, (all) => ({
    ...all,
    [id]: copied.isCopied
      ? { index, isCopied: true }
      : { index, isCopied: false, reason: String(copied.reason ?? "unknown") },
  }))
}

async function fetchRun($: EngineInterface, id: string, input: LiveInput) {
  const ran = await $.process.run(liveArgv(input), { timeoutMs: 20_000 })
  const run =
    ran.exitCode === 0
      ? parseRun(ran.stdout)
      : {
          title: "",
          url: "",
          status: "",
          conclusion: "",
          jobs: [],
          error:
            ran.stderr.trim().split("\n")[0] || `gh exited ${ran.exitCode}`,
        }
  await update($, runs, (all) => ({ ...all, [id]: run }))
  return run
}

// Polls until the run ends, or for half an hour at most. A module reload
// stops the timer; the card then keeps its last state.
async function watchRun($: EngineInterface, id: string, input: LiveInput) {
  let polls = 0
  const timer = $.clock.every(POLL_MS, () => {
    polls += 1
    void fetchRun($, id, input).then((run) => {
      if (isOver(run) || polls >= MAX_POLLS) timer.cancel()
    })
  })
}

// Mobile apps draw a card under the row only when the Box holding the row and
// the content carries the border; elsewhere the row stays plain above the card.
const outer = (surface: string) =>
  surface === "mobile"
    ? {
        flexDirection: "column" as const,
        borderStyle: "round",
        borderColor: "subtle",
        paddingX: 1,
      }
    : { flexDirection: "column" as const }

const card = (Box: any, surface: string, children: unknown) =>
  surface === "mobile" ? (
    <Box flexDirection="column">{children}</Box>
  ) : (
    <Box flexDirection="column" marginTop={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="subtle"
        paddingX={2}
      >
        {children}
      </Box>
    </Box>
  )

// A card inside a reply: the border carries the meaning as a second signal
// (the emoji and the word carry the first).
const frame = (
  Box: any,
  surface: string,
  border: string,
  children: unknown,
) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor={border}
    paddingX={surface === "mobile" ? 1 : 2}
  >
    {children}
  </Box>
)

// One block of a reply, drawn. `id` is stable per message and block, so a
// fold or a copy keeps its state across redraws.
async function drawBlock($: EngineInterface, e: any, block: Block, id: string) {
  const { Box, Button, Markdown, Text } = $.ui.resolve(e)

  if (block.kind === "markdown") return <Markdown text={block.text} />

  if (block.kind === "callout")
    return frame(
      Box,
      e.surface,
      CALLOUTS[block.callout].border,
      <Box flexDirection="column">
        <Text bold>
          {CALLOUTS[block.callout].emoji} {block.label}
        </Text>
        <Text> </Text>
        <Markdown text={block.body} />
      </Box>,
    )

  if (block.kind === "grid") {
    const width =
      Math.min(
        REF_MAX,
        Math.max(...block.rows.map((one) => one.subject.length)),
      ) + 2
    return frame(
      Box,
      e.surface,
      "subtle",
      <Box flexDirection="column">
        {block.title ? <Text color="inactive">{block.title}</Text> : null}
        {block.title ? <Text> </Text> : null}
        {block.rows.map((one) => (
          <Box flexDirection="row">
            <Box width={width}>
              <Text>{cut(one.subject, REF_MAX)}</Text>
            </Box>
            <Text>
              {one.runs.map((pass) => (
                <Text color={pass ? "success" : "error"}>{glyphs([pass])}</Text>
              ))}
            </Text>
          </Box>
        ))}
      </Box>,
    )
  }

  if (block.kind === "progress") {
    const { fill, track } = progressCells(block.value, block.max)
    return frame(
      Box,
      e.surface,
      "subtle",
      <Text>
        {block.label}
        {"  "}
        <Text color="suggestion">{fill}</Text>
        <Text color="subtle">{track}</Text>
        {"  "}
        {block.value}/{block.max}
      </Text>,
    )
  }

  if (block.kind === "bars") {
    const labelWidth =
      Math.min(
        REF_MAX,
        Math.max(...block.items.map((item) => item.label.length)),
      ) + 2
    const figureWidth = Math.max(
      ...block.items.map((item) => item.figure.length),
    )
    return frame(
      Box,
      e.surface,
      "subtle",
      <Box flexDirection="column">
        {block.title ? <Text color="inactive">{block.title}</Text> : null}
        {block.items.map((item, index) => (
          <Box flexDirection="row" marginTop={index === 0 && !block.title ? 0 : 1}>
            <Box width={labelWidth}>
              <Text>{cut(item.label, REF_MAX)}</Text>
            </Box>
            <Box width={22}>
              <Text color="suggestion">{item.bar}</Text>
            </Box>
            <Box width={figureWidth} justifyContent="flex-end">
              <Text>{item.figure}</Text>
            </Box>
          </Box>
        ))}
      </Box>,
    )
  }

  // The ledger's own lines, re-drawn: the state word coloured beside its
  // emoji, in a fixed column, the ref a link, never re-sorted.
  if (block.kind === "status") {
    const { Link } = $.ui.resolve(e)
    const refWidth =
      Math.min(REF_MAX, Math.max(...block.rows.map((row) => row.ref.length))) + 2
    return frame(
      Box,
      e.surface,
      "subtle",
      <Box flexDirection="column">
        <Text>
          <Text bold>{block.title}</Text>: {block.counts}
        </Text>
        <Text> </Text>
        {block.rows.map((row) => (
          <Box flexDirection="row">
            <Box width={STATE_WIDTH}>
              <Text color={STATUS[row.state].colour}>{row.word}</Text>
            </Box>
            <Box width={refWidth}>
              <Link href={row.url} label={cut(row.ref, REF_MAX)} />
            </Box>
            <Text>{row.what}</Text>
          </Box>
        ))}
      </Box>,
    )
  }

  if (block.kind === "fold") {
    const isOpen = (await read($, folds))[id] === true
    return frame(
      Box,
      e.surface,
      "subtle",
      <Box flexDirection="column">
        <Button
          key={`fold-${id}`}
          plain
          label={`${isOpen ? "▾" : "▸"} ${block.summary} (${block.lines} lines)`}
          onPress={() => update($, folds, (all) => ({ ...all, [id]: !isOpen }))}
        />
        {isOpen ? <Text> </Text> : null}
        {isOpen ? <Text>{block.head.join("\n")}</Text> : null}
        {isOpen && block.rest > 0 ? (
          <Text color="inactive">… {block.rest} more lines</Text>
        ) : null}
      </Box>,
    )
  }

  const last = (await read($, copies))[id]
  return frame(
    Box,
    e.surface,
    "subtle",
    <Box flexDirection="column">
      {block.values.map((value, index) => (
        <Box flexDirection="column" marginTop={index === 0 ? 0 : 1}>
          <Text bold>{value}</Text>
          {/* A remote surface has no clipboard path yet: the phone shows the value alone, to select. */}
          <Box
            flexDirection="row"
            gap={1}
            display={e.surface === "mobile" ? "none" : "flex"}
          >
            <Button
              key={`copy-${id}-${index}`}
              label="Copy"
              onPress={() => copyOne($, id, value, index, e.surface)}
            />
            {last?.index === index && (
              <Text>
                {last.isCopied ? "✅ copied" : `🔥 not copied: ${last.reason}`}
              </Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>,
  )
}

export const register: Register = (on) => {
  // Each card already shows its content; the model still reads the full result.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (!TOOLS.includes(String(e.props.tool))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  // The design system's exact shapes in a reply become cards; the rest of the
  // reply, and any near miss, stays Markdown as the engine draws it.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    if (e.props.isSummary) return next(e)
    const blocks = parseReply(e.props.text)
    if (!hasCard(blocks)) return next(e)
    const { Box } = $.ui.resolve(e)

    // The first Markdown block keeps the engine's own drawing, bullet included.
    const drawn = await Promise.all(
      blocks.map((block, index) =>
        index === 0 && block.kind === "markdown"
          ? next({ ...e, props: { ...e.props, text: block.text } })
          : drawBlock($, e, block, `${e.requestId}:${index}`),
      ),
    )

    return (
      <Box flexDirection="column" gap={1}>
        {drawn}
      </Box>
    )
  })

  // The shapes the model writes, so the cards above have something to draw.
  on("prompt.compose", async (_, e, next) => {
    const composed = await next(e)
    return {
      sections: [
        ...composed.sections,
        { id: "reply-kit:shapes", text: SHAPES, scope: "session" as const },
      ],
    }
  })

  on("session.start", async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: "ask",
      description:
        "Closing ask: a card of numbered options the user presses; the press is their reply. Call it last, once per reply, and write nothing after it. multi: options toggle and Done sends the chosen numbers. isGated: for a delete, send, spend or merge; the press only drafts the reply.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 9,
          },
          multi: { type: "boolean" },
          french: { type: "boolean" },
          isGated: { type: "boolean" },
        },
        required: ["question", "options"],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: "live",
      description:
        "Follows a GitHub Actions run in place (repo as owner/repo, runId) until it ends. Use for a run the user is waiting on.",
      inputSchema: {
        type: "object",
        properties: { repo: { type: "string" }, runId: { type: "string" } },
        required: ["repo", "runId"],
      },
      isDeferred: true,
    })

    return started
  })

  // The tool's arguments sit at the top of `e`, beside `tool` and `tool_use_id`.
  on("tool.run", { tool: ASK }, (_, e) => {
    const input = readAsk(e)
    if (!input) return { deny: "ask needs a question and at least two options" }

    return { result: askMarkdown(input), context: [LAST] }
  })

  on("tool.run", { tool: LIVE }, async ($, e) => {
    const input = readLive(e)
    if (!input)
      return { deny: "live needs repo as owner/repo and a numeric runId" }
    const id = String(e.tool_use_id)
    const run = await fetchRun($, id, input)
    if (run.error) return { deny: `gh could not read the run: ${run.error}` }
    if (!isOver(run)) void watchRun($, id, input)

    return { result: runMarkdown(input, run), context: [SHOWN] }
  })

  on(
    "ui.render",
    { component: "ToolUse", props: { tool: ASK } },
    async ($, e, next) => {
      // The input streams in: until it holds a question and two options, draw the row alone.
      const input = readAsk(e.props.input)
      if (!input) return next(e)
      // The card carries the content: the row above it shows the tool name alone.
      const row = await next({ ...e, props: { ...e.props, input: {} } })

      const { Box, Button, Text } = $.ui.resolve(e)
      const id = e.props.tool_use_id
      const heading = (
        <Text bold>── 👋 {input.french ? "À vous" : "Over to you"} ──</Text>
      )
      const picked = (index: number, option: string, isPicked: boolean) =>
        isPicked ? (
          <Text bold>
            👉 {index + 1}. {option}
          </Text>
        ) : (
          <Text color="inactive">
            {"   "}
            {index + 1}. {option}
          </Text>
        )

      if (input.multi) {
        const state = (await read($, choices))[id] ?? NO_CHOICE
        const isGated = input.isGated === true
        return (
          <Box {...outer(e.surface)}>
            {row}
            {card(
              Box,
              e.surface,
              <Box flexDirection="column">
                {heading}
                <Text>{input.question}</Text>
                <Text> </Text>
                {state.isSent ? (
                  input.options.map((option, index) =>
                    picked(index, option, state.picked.includes(index)),
                  )
                ) : (
                  <Box flexDirection="column">
                    {input.options.map((option, index) => (
                      <Button
                        key={`option-${index}`}
                        plain
                        label={`${state.picked.includes(index) ? "[x]" : "[ ]"} ${option}`}
                        hotkey={String(index + 1)}
                        onPress={() => toggle($, id, index)}
                      />
                    ))}
                    <Text> </Text>
                    {state.picked.length > 0 ? (
                      <Button
                        key="done"
                        label={`${input.french ? "Valider" : "Done"}: ${chosenText(state.picked)}`}
                        hotkey="d"
                        variant="primary"
                        onPress={() => sendChoice($, id, isGated)}
                      />
                    ) : (
                      <Text color="inactive">
                        {input.french
                          ? "Cochez au moins une option."
                          : "Tick at least one option."}
                      </Text>
                    )}
                  </Box>
                )}
              </Box>,
            )}
          </Box>
        )
      }

      const chosen = (await read($, answers))[id]
      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            <Box flexDirection="column">
              {heading}
              <Text>{input.question}</Text>
              <Text> </Text>
              {chosen === undefined ? (
                <Box flexDirection="column">
                  {input.options.map((option, index) => (
                    <Button
                      key={`option-${index}`}
                      plain
                      label={option}
                      hotkey={String(index + 1)}
                      variant={index === 0 ? "primary" : "secondary"}
                      onPress={() => choose($, id, input, index)}
                    />
                  ))}
                </Box>
              ) : (
                input.options.map((option, index) =>
                  picked(index, option, chosen === index),
                )
              )}
            </Box>,
          )}
        </Box>
      )
    },
  )

  on(
    "ui.render",
    { component: "ToolUse", props: { tool: LIVE } },
    async ($, e, next) => {
      const input = readLive(e.props.input)
      if (!input) return next(e)
      // The card carries the content: the row above it shows the tool name alone.
      const row = await next({ ...e, props: { ...e.props, input: {} } })

      const { Box, Text } = $.ui.resolve(e)
      const run = (await read($, runs))[e.props.tool_use_id]

      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            run === undefined ? (
              <Text>
                ⏳ loading {input.repo} run {input.runId}
              </Text>
            ) : run.error ? (
              <Text>🔥 failed: {run.error}</Text>
            ) : (
              <Box flexDirection="column">
                <Text bold>
                  {stateWord(run.status, run.conclusion)} {run.title}
                </Text>
                <Text color="inactive">
                  {input.repo} · run {input.runId}
                </Text>
                <Text> </Text>
                {run.jobs.map((job) => (
                  <Box flexDirection="row">
                    <Box width={11}>
                      <Text>{stateWord(job.status, job.conclusion)}</Text>
                    </Box>
                    <Text>{job.name}</Text>
                  </Box>
                ))}
                {isOver(run) && run.url ? <Text> </Text> : null}
                {isOver(run) && run.url ? <Text>{run.url}</Text> : null}
              </Box>
            ),
          )}
        </Box>
      )
    },
  )
}
