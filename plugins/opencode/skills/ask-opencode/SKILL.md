---
name: ask-opencode
description: "Query an opencode model for a one-off second opinion (default), or talk to a session already running in the user's opencode TUI. Session mode triggers on `--session [id]` or phrasing like 'talk to my opencode', 'ask the opencode I have open', 'tell opencode …'. Either way the reply is shown inline, clearly attributed to opencode."
---

## Available models

Call the `list_models` tool from the `opencode` MCP server to get the current list of allowed models at runtime. Only relevant to the one-off query path.

## Step 1 — Pick the path

Default to the **one-off query path** (Step 2) — a fresh, stateless question to any opencode model.

Use the **session path** (Step 5) instead when the user writes `--session [id]`, or says something like "talk to my opencode", "ask the opencode I have open", "tell opencode …" — i.e. they mean the opencode instance they already have running, not a fresh question.

## Step 2 — Resolve the prompt and model (one-off path)

If the user invoked the skill with an argument (e.g. `/ask-opencode <question>`), use that argument verbatim as the prompt.

If no argument was given, ask the user what they would like to send to opencode before proceeding.

If the user specifies a model (e.g. `/ask-opencode --model github-copilot/gpt-4o <question>`), use that model. Otherwise use the MCP server's default (call `list_models` if unsure what's available).

## Step 2.5 — Inject repo context if relevant

If the prompt references "this repo", "this project", "here", "audit", or similar context-dependent language, gather the following before sending and prepend it to the prompt:

- Current working directory (absolute path)
- Git repo root name and current branch (`git rev-parse --show-toplevel`, `git branch --show-current`)
- Top-level file/directory listing
- Contents of key config files if present (e.g. `package.json`, `CLAUDE.md`, `README.md` — truncated to ~50 lines each)

Prepend this as a fenced block labelled `## Repo Context` before the user's prompt so opencode has accurate grounding.

If the prompt is a general question with no repo reference, skip this step entirely.

## Step 3 — Send the prompt

Call the `query` tool from the `opencode` MCP server with the resolved prompt (including any injected context) and model.

## Step 4 — Present the response

Display the response under a clearly labelled heading:

```
### opencode (<model>)

<output>
```

Do not paraphrase, edit, or interpret the output — show it exactly as returned. Then optionally offer your own take (Step 8).

## Step 5 — Find the session (session path)

Call `list_sessions({directory?})` on the `opencode` MCP server. It auto-discovers every opencode window listening on a local port, so it lists sessions from all of them at once — each line includes `port <n>` (or several ports, when the same project is open in two windows).

- If the user gave an id, use that session.
- Otherwise, if sessions span multiple directories/ports and it isn't obvious which one the user means, ask — or pick the one matching the current project directory when that's unambiguous.
- If the list is empty or the call errors, tell the user opencode isn't reachable: they need to start opencode with `oc` (or `opencode --port <free port>`), then type a first message so the session exists — then stop. A plain `opencode` opens no port and is invisible to the MCP.

## Step 6 — Send the message

Call `send({session_id, prompt, agent, timeout_seconds?, port?})`.

Default `agent` to `"plan"` — the default `build` agent can edit files on disk, so only pass a different agent when the user names one explicitly.

By default `send` routes to the window that owns the session (lowest port if the same session shows on several) — only pass `port` when the user names a specific window.

The message appears live in the user's opencode TUI, same as if they'd typed it — never invent or discard a session.

If the call times out ("Still running … use read"), go to Step 7 to catch up instead of resending.

## Step 7 — Catch up

When the user asks for the latest, or after a "still running" timeout, call `read({session_id, limit?, port?})` for a condensed transcript instead of re-sending the prompt. Same `port` rule as Step 6.

## Step 8 — Present the reply

Display it under a clearly labelled heading, same as the query path:

```
### opencode (session: <title or id>)

<output>
```

Do not paraphrase, edit, or interpret the output — show it exactly as returned.

## Step 9 — Offer your own perspective (optional)

After presenting the opencode response, offer to share your own take or highlight any meaningful differences. Only if it adds value — if the user did not ask for a comparison, keep this to a single brief sentence.
