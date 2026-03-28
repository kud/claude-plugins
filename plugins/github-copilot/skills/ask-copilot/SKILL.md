---
name: ask-copilot
description: "Sends a prompt to a GitHub Copilot model and presents the response inline, clearly attributed. Use this to get a second opinion or alternative perspective without leaving the Claude session."
---

## Available models

Call the `list_models` tool from the `mcp-github-copilot` MCP server to get the current list of allowed models at runtime.

## Step 1 — Resolve the prompt and model

If the user invoked the skill with an argument (e.g. `/ask-copilot <question>`), use that argument verbatim as the prompt.

If no argument was given, ask the user what they would like to send to GitHub Copilot before proceeding.

If the user specifies a model (e.g. `/ask-copilot --model gpt-4o <question>`), use that model. Otherwise use the MCP server's default (call `list_models` if unsure what's available).

## Step 1.5 — Inject repo context if relevant

If the prompt references "this repo", "this project", "here", "audit", or similar context-dependent language, gather the following before sending and prepend it to the prompt:

- Current working directory (absolute path)
- Git repo root name and current branch (`git rev-parse --show-toplevel`, `git branch --show-current`)
- Top-level file/directory listing
- Contents of key config files if present (e.g. `package.json`, `CLAUDE.md`, `README.md` — truncated to ~50 lines each)

Prepend this as a fenced block labelled `## Repo Context` before the user's prompt so GitHub Copilot has accurate grounding.

If the prompt is a general question with no repo reference, skip this step entirely.

## Step 2 — Send the prompt

Call the `query` tool from the `mcp-github-copilot` MCP server with the resolved prompt (including any injected context) and model.

## Step 3 — Present the response

Display the response under a clearly labelled heading:

```
### GitHub Copilot (<model>)

<output>
```

Do not paraphrase, edit, or interpret the output — show it exactly as returned.

## Step 4 — Offer your own perspective (optional)

After presenting the GitHub Copilot response, offer to share your own take or highlight any meaningful differences. Only if it adds value — if the user did not ask for a comparison, keep this to a single brief sentence.
