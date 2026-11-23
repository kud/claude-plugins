# reply-kit

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that turns the question at the end of a reply into something you can press. Claude calls `mcp__reply-kit__ask` with a question and two to six options; the call's row grows a card with one button per option, and pressing one answers.

```
── 👋 Over to you ──
Publish 2.4.1 now?
1: Yes
2: Not yet
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

## Develop

```sh
claude plugin validate plugins/reply-kit
claude plugin test plugins/reply-kit
```
