```
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝

██████╗ ██╗     ██╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
██╔══██╗██║     ██║   ██║██╔════╝ ██║████╗  ██║██╔════╝
██████╔╝██║     ██║   ██║██║  ███╗██║██╔██╗ ██║███████╗
██╔═══╝ ██║     ██║   ██║██║   ██║██║██║╚██╗██║╚════██║
██║     ███████╗╚██████╔╝╚██████╔╝██║██║ ╚████║███████║
╚═╝     ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
```

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin%20Marketplace-D97757?style=flat-square)](https://claude.ai/code)
[![MCP](https://img.shields.io/badge/MCP-1.0-8B5CF6?style=flat-square)](https://modelcontextprotocol.io)
[![MIT](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](./LICENSE)

**A curated collection of Claude Code plugins for kud's MCP servers.**

[Plugins](#plugins) • [Quick Start](#quick-start) • [Skills](#skills) • [Structure](#structure)

</div>

---

## What is this?

Claude Code plugins bundle an **MCP server** + **companion skills** into a single installable unit. Each plugin here wraps one of kud's published MCP servers and ships ready-to-use slash commands for the most common workflows.

Install a plugin → get the MCP tools _and_ the skills in one shot.

---

## Quick Start

### 1. Register the marketplace

Add this marketplace to your Claude Code config so Claude can discover available plugins:

```
/plugin marketplace add kud/claude-plugins  # registers as @kud
```

### 2. Set env vars for the plugin you want

Each plugin reads its credentials from your shell environment — tokens never live in config files. See the env vars block in each plugin's section below, then add what you need to your `~/.zshrc` and reload:

```bash
source ~/.zshrc
```

All env vars are prefixed with `MCP_`. If you already have a token under a different name (e.g. `JENKINS_TOKEN`), alias it:

```bash
export MCP_JENKINS_TOKEN="$JENKINS_TOKEN"
```

### 3. Install a plugin

Installing a plugin registers the MCP server from `plugin.json` and makes its skills available as slash commands.

**Personal plugins** (trakt, raindrop, opencode, google-keep) — install globally for your user:

```
/plugin install opencode@kud --scope user
/plugin install trakt@kud --scope user
/plugin install raindrop-io@kud --scope user
/plugin install google-keep@kud --scope user
```

**Team plugins** (jenkins, harness-fme) — install at project scope to share with your team via `.claude/settings.json`:

```
/plugin install jenkins@kud --scope project
/plugin install harness-fme@kud --scope project
```

### 4. Use a skill

Once installed, skills are available immediately as slash commands:

```
/ask-opencode explain this function
/ci-diagnose my-service
/feature-flag-status my-flag
/trakt-whats-on
/bookmark-search react hooks
/keep-capture remember to buy oat milk
/keep-todo Shopping
```

---

## Plugins

### 🤖 [mcp-opencode](https://github.com/kud/mcp-opencode)

Query any opencode-supported model from inside Claude — get a second opinion without leaving your session. Defaults to GitHub Copilot models; configurable via `OPENCODE_MODEL_ALLOW`.

| Skill           | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `/ask-opencode` | Send a prompt to any opencode model and see the response inline |

**Env vars** (optional):

```bash
export MCP_OPENCODE_MODEL_ALLOW="github-copilot/*"  # defaults to github-copilot/*
```

**npm**: [`@kud/mcp-opencode`](https://www.npmjs.com/package/@kud/mcp-opencode)

---

### 🏗️ [mcp-jenkins](https://github.com/kud/mcp-jenkins)

Full Jenkins control from Claude — inspect builds, stream console logs, trigger pipelines, manage queues, and diagnose CI failures.

| Skill          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `/ci-diagnose` | Fetch a failing build's console log and explain the root cause |
| `/build-watch` | Trigger a build and watch it to completion with live status    |

**Env vars**:

```bash
export MCP_JENKINS_URL="https://jenkins.example.com"
export MCP_JENKINS_USER="your-username"
export MCP_JENKINS_TOKEN="your-api-token"
```

**npm**: [`@kud/mcp-jenkins`](https://www.npmjs.com/package/@kud/mcp-jenkins)

---

### 🚩 [mcp-harness-fme](https://github.com/kud/mcp-harness-fme)

Inspect and control Harness FME feature flags — list environments, audit targeting rules, and kill or restore flags in a single conversation.

| Skill                  | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `/feature-flag-status` | Full status report for a flag across all environments |

**Env vars**:

```bash
export MCP_HARNESS_FME_TOKEN="your-harness-api-key"
```

**npm**: [`@kud/mcp-harness-fme`](https://www.npmjs.com/package/@kud/mcp-harness-fme)

---

### 🎬 [mcp-trakt](https://github.com/kud/mcp-trakt)

Track what you're watching — search movies and shows, check in, browse your history, manage your watchlist, and get recommendations.

| Skill             | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `/trakt-whats-on` | See your watchlist, recently watched, and what's up next |
| `/trakt-checkin`  | Check in to a movie or episode you're about to watch     |

**Env vars**:

```bash
export MCP_TRAKT_CLIENT_ID="your-client-id"
export MCP_TRAKT_ACCESS_TOKEN="your-access-token"
```

**npm**: [`@kud/mcp-trakt`](https://www.npmjs.com/package/@kud/mcp-trakt)

---

### 🔖 [mcp-raindrop-io](https://github.com/kud/mcp-raindrop-io)

Manage your Raindrop.io bookmarks from Claude — search your library, save new links, organise into collections, and tag.

| Skill              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `/bookmark-search` | Search your bookmarks by keyword, tag, or collection |
| `/bookmark-save`   | Save a URL to Raindrop.io with tags and collection   |

**Env vars**:

```bash
export MCP_RAINDROP_TOKEN="your-token"
```

**npm**: [`@kud/mcp-raindrop-io`](https://www.npmjs.com/package/@kud/mcp-raindrop-io)

---

### 📝 [mcp-google-keep](https://github.com/kud/mcp-google-keep)

Read and write your Google Keep notes from Claude — capture thoughts, manage checklists, and search your notes by label, colour, or text.

| Skill           | Description                             |
| --------------- | --------------------------------------- |
| `/keep-capture` | Quickly save a thought or note to Keep  |
| `/keep-todo`    | View and manage a Google Keep checklist |

**GitHub (Python)**: [kud/mcp-google-keep](https://github.com/kud/mcp-google-keep) — installed via `uvx`

---

## Structure

The marketplace is a thin index — each plugin lives in its own repo.

```
claude-plugins/               ← this repo (index only)
└── .claude-plugin/
    └── marketplace.json      # Lists plugin repos by id + GitHub URL
```

Each MCP server repo carries its own plugin manifest and skills:

```
mcp-opencode/                 ← github.com/kud/mcp-opencode
├── .claude-plugin/
│   └── plugin.json           # MCP config + skill list
├── skills/
│   └── ask-opencode/
│       └── SKILL.md
└── src/                      # MCP server source

mcp-jenkins/                  ← github.com/kud/mcp-jenkins
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── ci-diagnose/
│   │   └── SKILL.md
│   └── build-watch/
│       └── SKILL.md
└── src/

mcp-harness-fme/              ← github.com/kud/mcp-harness-fme
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── feature-flag-status/
│       └── SKILL.md
└── src/

mcp-trakt/                    ← github.com/kud/mcp-trakt
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── trakt-whats-on/
│   │   └── SKILL.md
│   └── trakt-checkin/
│       └── SKILL.md
└── src/

mcp-raindrop-io/              ← github.com/kud/mcp-raindrop-io
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── bookmark-search/
│   │   └── SKILL.md
│   └── bookmark-save/
│       └── SKILL.md
└── src/

mcp-google-keep/              ← github.com/kud/mcp-google-keep
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── keep-capture/
│   │   └── SKILL.md
│   └── keep-todo/
│       └── SKILL.md
└── server.py                 # Python MCP server
```

---

## Skills

**Total: 10 Skills across 6 plugins**

| Plugin      | Skill               | Trigger                       | What it does                           |
| ----------- | ------------------- | ----------------------------- | -------------------------------------- |
| opencode    | ask-opencode        | `/ask-opencode <prompt>`      | Second opinion from a Copilot model    |
| jenkins     | ci-diagnose         | `/ci-diagnose <job> [build]`  | Root cause analysis of a failing build |
| jenkins     | build-watch         | `/build-watch <job>`          | Trigger + watch a build live           |
| harness-fme | feature-flag-status | `/feature-flag-status <flag>` | Flag state across all environments     |
| trakt       | trakt-whats-on      | `/trakt-whats-on`             | Watchlist + recently watched recap     |
| trakt       | trakt-checkin       | `/trakt-checkin <title>`      | Check in to what you're watching       |
| raindrop-io | bookmark-search     | `/bookmark-search <query>`    | Search your bookmarks                  |
| raindrop-io | bookmark-save       | `/bookmark-save <url>`        | Save a URL to Raindrop.io              |
| google-keep | keep-capture        | `/keep-capture <text>`        | Capture a thought to Google Keep       |
| google-keep | keep-todo           | `/keep-todo <list>`           | Manage a Google Keep checklist         |

---

## MCP Servers

Each plugin points to a published package. All source code is on GitHub:

| Plugin      | Package                                                                    | GitHub                                                        |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| opencode    | [@kud/mcp-opencode](https://www.npmjs.com/package/@kud/mcp-opencode)       | [kud/mcp-opencode](https://github.com/kud/mcp-opencode)       |
| jenkins     | [@kud/mcp-jenkins](https://www.npmjs.com/package/@kud/mcp-jenkins)         | [kud/mcp-jenkins](https://github.com/kud/mcp-jenkins)         |
| harness-fme | [@kud/mcp-harness-fme](https://www.npmjs.com/package/@kud/mcp-harness-fme) | [kud/mcp-harness-fme](https://github.com/kud/mcp-harness-fme) |
| trakt       | [@kud/mcp-trakt](https://www.npmjs.com/package/@kud/mcp-trakt)             | [kud/mcp-trakt](https://github.com/kud/mcp-trakt)             |
| raindrop-io | [@kud/mcp-raindrop-io](https://www.npmjs.com/package/@kud/mcp-raindrop-io) | [kud/mcp-raindrop-io](https://github.com/kud/mcp-raindrop-io) |
| google-keep | GitHub (Python / uvx)                                                      | [kud/mcp-google-keep](https://github.com/kud/mcp-google-keep) |

---

## License

MIT © [kud](https://github.com/kud)

---

<div align="center">

Made with ❤️ for Claude Code power users

⭐ Star this repo if it saves you time

[↑ Back to top](#)

</div>
