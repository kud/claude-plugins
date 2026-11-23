// Pure shaping for the ask card: no `$`, so tests can run it.
import type { AskInput } from "../types";

// Accepts anything (a tool.run `e`, a half-streamed props.input) and answers
// an ask only once it holds a question and at least two options.
export const readAsk = (value: unknown): AskInput | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const { question, options, french, isGated } = value as Record<string, unknown>;
  if (typeof question !== "string" || !Array.isArray(options)) return undefined;
  const labels = options.filter((o): o is string => typeof o === "string" && o.length > 0);
  if (labels.length < 2) return undefined;
  return { question, options: labels, french: french === true, isGated: isGated === true };
};

export const askMarkdown = (input: AskInput) =>
  [
    `── 👋 ${input.french ? "À vous" : "Over to you"} ──`,
    input.question,
    ...input.options.map((o, i) => `${i + 1}. ${o}`),
  ].join("\n");

// What the press puts in the conversation: the digit closes it like the word.
export const answerText = (input: AskInput, index: number) =>
  `${index + 1}. ${input.options[index]}`;
