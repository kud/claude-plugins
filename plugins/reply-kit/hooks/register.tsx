import { atom, read, update } from "claude-code"
import type { EngineInterface, Register } from "claude-code"

import type { AskInput } from "../types"
import { answerText, askMarkdown, readAsk } from "./shapes"

const ASK = "mcp__reply-kit__ask"

const answers = atom(
  { plugin: "reply-kit", key: "answers" } as const,
  {},
  { shape: "answers-1" },
)

async function choose(
  $: EngineInterface,
  id: string,
  input: AskInput,
  index: number,
) {
  await update($, answers, (all) => ({ ...all, [id]: index }))
  const text = answerText(input, index)
  // A gated ask only drafts the answer: the user's own Enter sends it, so the
  // turn arrives as their message, not as one a plugin submitted.
  if (input.isGated) {
    await $.prompt.fill({ text })
  } else {
    await $.prompt.submit({ text })
  }
}

export const register: Register = (on) => {
  // The card already shows the ask; the model still reads the full Markdown result.
  on(
    "ui.render",
    { component: "ToolResult", props: { tool: ASK } },
    async ($, e) => {
      const { Box } = $.ui.resolve(e)

      return <Box />
    },
  )

  on("session.start", async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: "ask",
      description:
        "The closing ask as a card with numbered options the user can press; the press becomes their reply. Call it last: nothing after it in the reply, no sentence announcing or explaining the card. One per reply. isGated: true for a delete, a send, a spend, a merge or anything hard to undo: the press then only drafts the answer and the user sends it themselves.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
          },
          french: { type: "boolean" },
          isGated: { type: "boolean" },
        },
        required: ["question", "options"],
      },
      isDeferred: false,
    })

    return started
  })

  // The tool's arguments sit at the top of `e`, beside `tool` and `tool_use_id`.
  // The result is the Markdown closer, so a surface without the mod reads the same ask.
  on("tool.run", { tool: ASK }, (_, e) => {
    const input = readAsk(e)
    if (!input) return { deny: "ask needs a question and at least two options" }

    return {
      result: `${askMarkdown(input)}\n(Drawn as a card with buttons; wait for the user's choice.)`,
    }
  })

  on(
    "ui.render",
    { component: "ToolUse", props: { tool: ASK } },
    async ($, e, next) => {
      const row = await next(e)
      // The input streams in: until it holds a question and two options, draw the row alone.
      const input = readAsk(e.props.input)
      if (!input) return row

      const { Box, Button, Text } = $.ui.resolve(e)
      const id = e.props.tool_use_id
      const chosen = (await read($, answers))[id]

      return (
        <Box flexDirection="column">
          {row}
          <Box flexDirection="column" marginTop={1}>
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor="subtle"
              paddingX={2}
            >
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
            </Box>
          </Box>
        </Box>
      )
    },
  )
}
