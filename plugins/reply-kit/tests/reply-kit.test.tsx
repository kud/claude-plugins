import { expect, test } from "claude-code/testing";

const ASK = "mcp__reply-kit__ask";

const row = (input: unknown) =>
  ({
    plugin: "reply-kit",
    component: "ToolUse",
    requestId: "tu1",
    props: { tool_use_id: "tu1", tool: ASK, input, isErrored: false, isInProgress: false },
  }) as const;

const boot = async ($: any, on: any) => {
  const sent = { submit: [] as string[], fill: [] as string[] };
  on("session.start", (_: unknown, e: any) => ({ cwd: e.cwd }));
  on("tool.register", (_: unknown, e: any) => ({ value: { tool: `mcp__reply-kit__${e.name}` } }));
  on("prompt.submit", (_: unknown, e: any) => (sent.submit.push(e.text), { text: e.text }));
  on("prompt.fill", (_: unknown, e: any) => (sent.fill.push(e.text), { isFilled: true }));
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true });
  return sent;
};

const ask = { question: "Publiez-vous la 2.4.1 ?", options: ["Oui", "Non"], french: true };

test("a call with its arguments at the top of the input is answered", async ($, on) => {
  await boot($, on);
  const ran: any = await $.tool.call({ tool: ASK, ...ask });
  expect(ran.deny).toBeUndefined();
  expect(String(ran.result)).toContain("1. Oui");
});

test("a call without two options is refused, not thrown", async ($, on) => {
  await boot($, on);
  const ran: any = await $.tool.call({ tool: ASK, question: "Go?", options: ["Yes"] });
  expect(String(ran.deny ?? ran.text)).toContain("two options");
});

test("a half-streamed input draws the row alone, on every surface", async ($, on) => {
  await boot($, on);
  for (const surface of ["terminal", "desktop", "mobile"] as const) {
    for (const input of [undefined, {}, { question: "Go?" }]) {
      const ui = await $.ui.mount({ ...row(input), surface } as any);
      expect(await ui.find({ type: "Button" })).toBeFalsy();
      await ui.unmount();
    }
  }
});

test("options are real buttons, and a press on a plain ask submits the reply", async ($, on) => {
  const sent = await boot($, on);
  const ui = await $.ui.mount({ ...row(ask), surface: "terminal" } as any);
  expect((await ui.find({ type: "Button", key: "option-0" }))).toBeTruthy();
  await ui.press({ key: "option-0" });
  expect(sent.submit).toEqual(["1. Oui"]);
  expect(sent.fill).toEqual([]);
  expect((await ui.find({ type: "Text", text: /👉 1\. Oui/ }))?.text).toContain("Oui");
  await ui.unmount();
});

test("a gated ask only drafts the answer for the user to send", async ($, on) => {
  const sent = await boot($, on);
  const ui = await $.ui.mount({ ...row({ ...ask, isGated: true }), surface: "desktop" } as any);
  await ui.press({ key: "option-1" });
  expect(sent.submit).toEqual([]);
  expect(sent.fill).toEqual(["2. Non"]);
  await ui.unmount();
});

test("the text result row draws nothing under the card", async ($, on) => {
  await boot($, on);
  for (const surface of ["terminal", "desktop", "mobile"] as const) {
    const ui = await $.ui.mount({
      plugin: "reply-kit",
      component: "ToolResult",
      requestId: "tu1",
      surface,
      props: { tool_use_id: "tu1", tool: ASK, output: "── 👋 À vous ──\nGo?\n1. Oui\n2. Non" },
    } as any);
    expect(await ui.find({ type: "Text" })).toBeFalsy();
    await ui.unmount();
  }
});
