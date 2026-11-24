# reply-kit

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that turns the question at the end of a reply into something you can press. Claude calls `mcp__reply-kit__ask` with a question and two to nine options; the call's row grows a card with one button per option, and pressing one answers.

```
── 👋 Over to you ──
Publish 2.4.1 now?
1. Yes
2. Not yet
```

## Install

```
/plugin install reply-kit@kud --scope user
```

## What a press does

| Ask             | Press                                            |
| --------------- | ------------------------------------------------ |
| plain           | sends `1. Yes` as your next message              |
| `isGated: true` | puts `1. Yes` in the prompt box; you press Enter |

Use `isGated` for anything hard to undo: a delete, a send, a spend, a merge. A press on a plain ask reaches the model as a message from the plugin, so it should never stand in for your approval of such an action; the gated form makes the message yours.

Digits work too: `1` to `9` press the matching option while the card holds the keyboard. Once answered, the card marks the choice with `👉` and the others go dim.

## The fallback

The tool's result is the same ask as text, so the model reads the whole question and a surface without the mod still shows it. Where the card draws, that text row draws nothing, so the ask shows once.

## Input

| Field      | Type     | Notes                                           |
| ---------- | -------- | ----------------------------------------------- |
| `question` | string   | required                                        |
| `options`  | string[] | required, two to nine                           |
| `multi`    | boolean  | options toggle; **Done** sends `1, 3`           |
| `french`   | boolean  | heading reads `À vous` instead of `Over to you` |
| `isGated`  | boolean  | a press drafts the answer instead of sending    |

A call missing the question or two options is refused with a short error rather than drawn half-filled.

## Cards from the reply itself

Most cards cost nothing: reply-kit reads the finished reply and draws the design system's shapes as cards. There is no tool call, so nothing is written twice and no extra model turn follows. Anything that is not exactly a shape stays Markdown, as Claude Code draws it; a half-written or malformed shape never becomes a broken card.

| Write in the reply                                 | Card                                               |
| -------------------------------------------------- | -------------------------------------------------- |
| `> ⚠️ **Warning**`, a `>` line, then `> ` body lines | border in the kind's colour, beside emoji and label |
| a fence of `acme/api   ✓✓✗✓` rows                  | run grid, `✓` / `✗` in colour                      |
| a fence holding `release 2.4  ████████░░  8/10`    | progress bar                                       |
| a fence of `label  ██████▌  6.1` rows, blank-spaced | bar list                                           |
| `▸ summary (N lines)` over a fence                  | a fold that opens and closes                       |
| a ```sh fence of up to four lines                   | a **Copy** button per line                         |
| `**Wave 2**: 👉 1 yours · ✅ 2 done`, then `- ✅ done [acme/api#41](url) docs fixed` rows | status ledger: state words in colour, refs as links |

Call-out kinds: ⚠️ warning or cost, 💡 tip, ℹ️ info, ⭐ insight, 🚨 urgent, 🌶️ concern. Every colour is a theme key, so it follows light, dark and colour-blind themes. A ledger's counts must match its rows, and its rows stay in the order written. The mobile app has no clipboard path yet, so a copy card there shows the value alone, to select.

The shapes reach the model as one short system-prompt section (about 230 tokens), so they work without any other setup.

## Live

`mcp__reply-kit__live` follows a GitHub Actions run in place. It takes only `repo` (`owner/repo`) and a numeric `runId`, runs `gh run view` every 15 seconds, and stops when the run ends or after half an hour. A reload of the plugin stops it; the card keeps its last state. The tool is deferred: it costs its name until Claude first needs it.

## Develop

```sh
claude plugin validate plugins/reply-kit
claude plugin test plugins/reply-kit
```

`evals/` holds model-in-the-loop cases: the ask and live cases check the tool is called and nothing follows the card; the other cases check the reply carries the exact shape the parser draws. The tools need a grant there, as the eval runs in a non-interactive mode:

```sh
claude plugin eval plugins/reply-kit --allow-tools 'mcp__reply-kit__*'
```
