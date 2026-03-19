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

### 0. Set your env vars

Tokens never live in config files — they're read from your shell environment. Add the ones you need to your `~/.zshrc`:

```bash
# opencode (optional — defaults to github-copilot/*)
export OPENCODE_MODEL_ALLOW="github-copilot/*"

# jenkins
export JENKINS_URL="https://jenkins.example.com"
export JENKINS_USER="your-username"
export JENKINS_TOKEN="your-api-token"

# harness fme
export MCP_HARNESS_FME_TOKEN="your-harness-api-key"

# trakt
export MCP_TRAKT_CLIENT_ID="your-client-id"
export MCP_TRAKT_ACCESS_TOKEN="your-access-token"

# raindrop.io
export MCP_RAINDROP_TOKEN="your-token"
```

Then reload your shell:

```bash
source ~/.zshrc
```

### 1. Register the marketplace

Add this marketplace to your Claude Code config so Claude can discover available plugins:

```
/plugin marketplace add kud/claude-plugins
```

### 2. Install a plugin

Installing a plugin registers the MCP server from `plugin.json` and makes its skills available as slash commands:

```
/plugin install mcp-opencode@kud-plugins
/plugin install mcp-jenkins@kud-plugins
/plugin install mcp-harness-fme@kud-plugins
/plugin install mcp-trakt@kud-plugins
/plugin install mcp-raindrop-io@kud-plugins
```

### 3. Use a skill

Once installed, skills are available immediately as slash commands:

```
/ask-opencode explain this function
/ci-diagnose my-service
/feature-flag-status my-flag
/trakt-whats-on
/bookmark-search react hooks
```

---

## Plugins

### 🤖 [mcp-opencode](https://github.com/kud/mcp-opencode)

Query any opencode-supported model from inside Claude — get a second opinion without leaving your session. Defaults to GitHub Copilot models; configurable via `OPENCODE_MODEL_ALLOW`.

| Skill           | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `/ask-opencode` | Send a prompt to any opencode model and see the response inline |

**npm**: [`@kud/mcp-opencode`](https://www.npmjs.com/package/@kud/mcp-opencode)

---

### 🏗️ [mcp-jenkins](https://github.com/kud/mcp-jenkins)

Full Jenkins control from Claude — inspect builds, stream console logs, trigger pipelines, manage queues, and diagnose CI failures.

| Skill          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `/ci-diagnose` | Fetch a failing build's console log and explain the root cause |
| `/build-watch` | Trigger a build and watch it to completion with live status    |

**npm**: [`@kud/mcp-jenkins`](https://www.npmjs.com/package/@kud/mcp-jenkins)

---

### 🚩 [mcp-harness-fme](https://github.com/kud/mcp-harness-fme)

Inspect and control Harness FME feature flags — list environments, audit targeting rules, and kill or restore flags in a single conversation.

| Skill                  | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `/feature-flag-status` | Full status report for a flag across all environments |

**npm**: [`@kud/mcp-harness-fme`](https://www.npmjs.com/package/@kud/mcp-harness-fme)

---

### 🎬 [mcp-trakt](https://github.com/kud/mcp-trakt)

Track what you're watching — search movies and shows, check in, browse your history, manage your watchlist, and get recommendations.

| Skill             | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `/trakt-whats-on` | See your watchlist, recently watched, and what's up next |
| `/trakt-checkin`  | Check in to a movie or episode you're about to watch     |

**npm**: [`@kud/mcp-trakt`](https://www.npmjs.com/package/@kud/mcp-trakt)

---

### 🔖 [mcp-raindrop-io](https://github.com/kud/mcp-raindrop-io)

Manage your Raindrop.io bookmarks from Claude — search your library, save new links, organise into collections, and tag.

| Skill              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `/bookmark-search` | Search your bookmarks by keyword, tag, or collection |
| `/bookmark-save`   | Save a URL to Raindrop.io with tags and collection   |

**npm**: [`@kud/mcp-raindrop-io`](https://www.npmjs.com/package/@kud/mcp-raindrop-io)

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
```

---

## Skills

**Total: 8 Skills across 5 plugins**

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

---

## MCP Servers

Each plugin points to a published npm package. All source code is on GitHub:

| Plugin          | npm                                                                        | GitHub                                                        |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| mcp-opencode    | [@kud/mcp-opencode](https://www.npmjs.com/package/@kud/mcp-opencode)       | [kud/mcp-opencode](https://github.com/kud/mcp-opencode)       |
| mcp-jenkins     | [@kud/mcp-jenkins](https://www.npmjs.com/package/@kud/mcp-jenkins)         | [kud/mcp-jenkins](https://github.com/kud/mcp-jenkins)         |
| mcp-harness-fme | [@kud/mcp-harness-fme](https://www.npmjs.com/package/@kud/mcp-harness-fme) | [kud/mcp-harness-fme](https://github.com/kud/mcp-harness-fme) |
| mcp-trakt       | [@kud/mcp-trakt](https://www.npmjs.com/package/@kud/mcp-trakt)             | [kud/mcp-trakt](https://github.com/kud/mcp-trakt)             |
| mcp-raindrop-io | [@kud/mcp-raindrop-io](https://www.npmjs.com/package/@kud/mcp-raindrop-io) | [kud/mcp-raindrop-io](https://github.com/kud/mcp-raindrop-io) |

---

## License

MIT © [kud](https://github.com/kud)

---

<div align="center">

Made with ❤️ for Claude Code power users

⭐ Star this repo if it saves you time

[↑ Back to top](#)

</div>
