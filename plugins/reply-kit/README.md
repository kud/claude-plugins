# reply-kit

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that turns the question at the end of a reply into something you can press. Claude calls `mcp__reply-kit__ask` with a question and two to six options; the call's row grows a card with one button per option, and pressing one answers.

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

Digits work too: `1` to `6` press the matching option while the card holds the keyboard. Once answered, the card marks the choice with `👉` and the others go dim.

## The fallback

The tool's result is the same ask as text, so the model reads the whole question and a surface without the mod still shows it. Where the card draws, that text row draws nothing, so the ask shows once.

## Input

| Field      | Type     | Notes                                           |
| ---------- | -------- | ----------------------------------------------- |
| `question` | string   | required                                        |
| `options`  | string[] | required, two to six                            |
| `french`   | boolean  | heading reads `À vous` instead of `Over to you` |
| `isGated`  | boolean  | a press drafts the answer instead of sending    |

A call missing the question or two options is refused with a short error rather than drawn half-filled.

## More components

Each is a tool drawn as a card under its row, in the same quiet frame.

| Tool     | Card                                                       | Result the model reads               |
| -------- | ---------------------------------------------------------- | ------------------------------------ |
| `choose` | options toggle; **Done** sends the chosen numbers (`1, 3`) | the ask as text                      |
| `copy`   | up to four values, each with a **Copy** button             | each label above its value           |
| `live`   | a GitHub Actions run, job states updating in place         | a snapshot of the run                |
| `fold`   | a long block under one summary line, opened by a click     | the summary, then the first 20 lines |

- `choose` takes `isGated` like `ask`: the press only drafts the reply.
- `copy` writes through the terminal's clipboard; the mobile app has no clipboard path yet, so there it shows the value alone, to select.
- `live` takes only `repo` (`owner/repo`) and a numeric `runId`, runs `gh run view` every 15 seconds, and stops when the run ends or after half an hour. A reload of the plugin stops it; the card keeps its last state.

## Visual cards

Nothing to press: these earn a card through colour as a second signal (on the border or a cell, always beside the emoji and the word), true column alignment, and bars that never fuse. Their result is the plain text shape.

| Tool      | Card                                                                        | Result the model reads       |
| --------- | --------------------------------------------------------------------------- | ---------------------------- |
| `callout` | warning, tip, info, insight, urgent or concern; border in the kind's colour | the blockquote call-out      |
| `grid`    | one row per subject, `✓` / `✗` per finished run                             | the same rows, aligned       |
| `bar`     | `progress`, `list` (longest bar 20 cells) or `spark`                        | the bar or sparkline as text |
| `status`  | title, counts by state, then state, ref and what in fixed columns           | a Markdown ledger table      |

Every colour is a theme key, so it follows light, dark and colour-blind themes. A status card groups its rows by state from five rows on, once: rows never move while you read.

## Develop

```sh
claude plugin validate plugins/reply-kit
claude plugin test plugins/reply-kit
```

`evals/` holds model-in-the-loop cases: each prompt checks the right card is chosen, its text shape lands in the transcript, and nothing restates the card after it. The tools need a grant there, as the eval runs in a non-interactive mode:

```sh
claude plugin eval plugins/reply-kit --allow-tools 'mcp__reply-kit__*'
```
