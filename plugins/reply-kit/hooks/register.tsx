import { atom, read, update } from "claude-code"
import type { EngineInterface, Register } from "claude-code"

import type { AskInput, ChooseState, CopyItem, LiveInput } from "../types"
import {
  chosenText,
  isOver,
  liveArgv,
  parseRun,
  copyMarkdown,
  readCopy,
  readFold,
  readLive,
  runMarkdown,
  stateWord,
} from "./inputs"
import { answerText, askMarkdown, readAsk } from "./shapes"

const ASK = "mcp__reply-kit__ask"
const COPY = "mcp__reply-kit__copy"
const CHOOSE = "mcp__reply-kit__choose"
const LIVE = "mcp__reply-kit__live"
const FOLD = "mcp__reply-kit__fold"
const TOOLS = [ASK, COPY, CHOOSE, LIVE, FOLD]

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
  item: CopyItem,
  index: number,
  surface: string,
) {
  const copied = await $.ui.copy({
    text: item.value,
    surface: surface as never,
  })
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

export const register: Register = (on) => {
  // Each card already shows its content; the model still reads the full result.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (!TOOLS.includes(String(e.props.tool))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on("session.start", async ($, e, next) => {
    const started = await next(e)
    const strings = { type: "array", items: { type: "string" } }
    await $.tool.register({
      name: "ask",
      description:
        "The closing ask as a card with numbered options the user can press; the press becomes their reply. Call it last: nothing after it in the reply, no sentence announcing or explaining the card. One per reply. isGated: true for a delete, a send, a spend, a merge or anything hard to undo: the press then only drafts the answer and the user sends it themselves.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { ...strings, minItems: 2, maxItems: 6 },
          french: { type: "boolean" },
          isGated: { type: "boolean" },
        },
        required: ["question", "options"],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: "choose",
      description:
        'A multi-select ask: each option toggles, and a Done button sends the chosen numbers as the user\'s reply ("1, 3"). Call it last: nothing after it in the reply, no sentence announcing or explaining the card. One per reply. isGated: true only drafts the reply.',
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { ...strings, minItems: 2, maxItems: 9 },
          french: { type: "boolean" },
          isGated: { type: "boolean" },
        },
        required: ["question", "options"],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: "copy",
      description:
        "Values the user will copy (a command, a path, a URL), each with a copy-to-clipboard button. Use in place of a bare line to copy; at most four values. Never follow the card with a sentence that restates or announces what it shows.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
              },
              required: ["value"],
            },
          },
        },
        required: ["items"],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: "live",
      description:
        "A card that follows a GitHub Actions run in place, by repository (owner/repo) and run id: each job's state word updates until the run ends. Use for a CI run the user is waiting on. Never follow the card with a sentence that restates or announces what it shows.",
      inputSchema: {
        type: "object",
        properties: { repo: { type: "string" }, runId: { type: "string" } },
        required: ["repo", "runId"],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: "fold",
      description:
        "A long block (a log, a diff, a long output) folded under one summary line the user opens or closes. Use when the detail is worth having but not worth reading by default. Never follow the card with a sentence that restates or announces what it shows.",
      inputSchema: {
        type: "object",
        properties: { summary: { type: "string" }, body: { type: "string" } },
        required: ["summary", "body"],
      },
      isDeferred: false,
    })

    return started
  })

  // The tool's arguments sit at the top of `e`, beside `tool` and `tool_use_id`.
  on("tool.run", { tool: ASK }, (_, e) => {
    const input = readAsk(e)
    if (!input) return { deny: "ask needs a question and at least two options" }

    return {
      result: askMarkdown(input),
    }
  })

  on("tool.run", { tool: CHOOSE }, (_, e) => {
    const input = readAsk(e)
    if (!input)
      return { deny: "choose needs a question and at least two options" }

    return {
      result: askMarkdown(input),
    }
  })

  on("tool.run", { tool: COPY }, (_, e) => {
    const input = readCopy(e)
    if (!input) return { deny: "copy needs at least one value" }

    return { result: copyMarkdown(input) }
  })

  on("tool.run", { tool: FOLD }, (_, e) => {
    const input = readFold(e)
    if (!input) return { deny: "fold needs a summary and a body" }
    const lines = input.body.split("\n").length

    return { result: `Folded under "${input.summary}" (${lines} lines).` }
  })

  on("tool.run", { tool: LIVE }, async ($, e) => {
    const input = readLive(e)
    if (!input)
      return { deny: "live needs repo as owner/repo and a numeric runId" }
    const id = String(e.tool_use_id)
    const run = await fetchRun($, id, input)
    if (run.error) return { deny: `gh could not read the run: ${run.error}` }
    if (!isOver(run)) void watchRun($, id, input)

    return {
      result: runMarkdown(input, run),
    }
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
      const chosen = (await read($, answers))[id]

      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            <Box flexDirection="column">
              <Text bold>
                ── 👋 {input.french ? "À vous" : "Over to you"} ──
              </Text>
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
                  chosen === index ? (
                    <Text bold>
                      👉 {index + 1}. {option}
                    </Text>
                  ) : (
                    <Text color="inactive">
                      {"   "}
                      {index + 1}. {option}
                    </Text>
                  ),
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
    { component: "ToolUse", props: { tool: CHOOSE } },
    async ($, e, next) => {
      const input = readAsk(e.props.input)
      if (!input) return next(e)
      // The card carries the content: the row above it shows the tool name alone.
      const row = await next({ ...e, props: { ...e.props, input: {} } })

      const { Box, Button, Text } = $.ui.resolve(e)
      const id = e.props.tool_use_id
      const state = (await read($, choices))[id] ?? NO_CHOICE
      const isGated = input.isGated === true

      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            <Box flexDirection="column">
              <Text bold>
                ── 👋 {input.french ? "À vous" : "Over to you"} ──
              </Text>
              <Text>{input.question}</Text>
              <Text> </Text>
              {state.isSent ? (
                input.options.map((option, index) =>
                  state.picked.includes(index) ? (
                    <Text bold>
                      👉 {index + 1}. {option}
                    </Text>
                  ) : (
                    <Text color="inactive">
                      {"   "}
                      {index + 1}. {option}
                    </Text>
                  ),
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
    },
  )

  on(
    "ui.render",
    { component: "ToolUse", props: { tool: COPY } },
    async ($, e, next) => {
      const input = readCopy(e.props.input)
      if (!input) return next(e)
      // The card carries the content: the row above it shows the tool name alone.
      const row = await next({ ...e, props: { ...e.props, input: {} } })

      const { Box, Button, Text } = $.ui.resolve(e)
      const id = e.props.tool_use_id
      const last = (await read($, copies))[id]

      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            input.items.map((item, index) => (
              <Box flexDirection="column" marginTop={index === 0 ? 0 : 1}>
                {item.label && <Text color="inactive">{item.label}</Text>}
                <Text bold>{item.value}</Text>
                {/* A remote surface has no clipboard path yet: the phone shows the value alone, to select. */}
                <Box
                  flexDirection="row"
                  gap={1}
                  display={e.surface === "mobile" ? "none" : "flex"}
                >
                  <Button
                    key={`copy-${index}`}
                    label="Copy"
                    hotkey={String(index + 1)}
                    onPress={() => copyOne($, id, item, index, e.surface)}
                  />
                  {last?.index === index && (
                    <Text>
                      {last.isCopied
                        ? "✅ copied"
                        : `🔥 not copied: ${last.reason}`}
                    </Text>
                  )}
                </Box>
              </Box>
            )),
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

  on(
    "ui.render",
    { component: "ToolUse", props: { tool: FOLD } },
    async ($, e, next) => {
      const input = readFold(e.props.input)
      if (!input) return next(e)
      // The card carries the content: the row above it shows the tool name alone.
      const row = await next({ ...e, props: { ...e.props, input: {} } })

      const { Box, Button, Text } = $.ui.resolve(e)
      const id = e.props.tool_use_id
      const isOpen = (await read($, folds))[id] === true
      const lines = input.body.split("\n").length

      return (
        <Box {...outer(e.surface)}>
          {row}
          {card(
            Box,
            e.surface,
            <Box flexDirection="column">
              <Button
                key="fold"
                plain
                label={`${isOpen ? "▾" : "▸"} ${input.summary} (${lines} lines)`}
                onPress={() =>
                  update($, folds, (all) => ({ ...all, [id]: !isOpen }))
                }
              />
              {isOpen ? <Text> </Text> : null}
              {isOpen ? <Text>{input.body}</Text> : null}
            </Box>,
          )}
        </Box>
      )
    },
  )
}
