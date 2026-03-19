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

## Plugins

### 🤖 [mcp-opencode](./plugins/mcp-opencode)

Query GitHub Copilot models from inside Claude. Get a second opinion from `gpt-4.1`, `gpt-4o`, `o3`, or `o4-mini` without leaving your session.

| Skill           | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `/ask-opencode` | Send a prompt to a Copilot model and see the response inline |

**npm**: [`@kud/mcp-opencode`](https://www.npmjs.com/package/@kud/mcp-opencode)

---

### 🏗️ [mcp-jenkins](./plugins/mcp-jenkins)

Full Jenkins control from Claude — inspect builds, stream console logs, trigger pipelines, manage queues, and diagnose CI failures.

| Skill          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `/ci-diagnose` | Fetch a failing build's console log and explain the root cause |
| `/build-watch` | Trigger a build and watch it to completion with live status    |

**npm**: [`@kud/mcp-jenkins`](https://www.npmjs.com/package/@kud/mcp-jenkins)

---

### 🚩 [mcp-harness-fme](./plugins/mcp-harness-fme)

Inspect and control Harness FME feature flags — list environments, audit targeting rules, and kill or restore flags in a single conversation.

| Skill                  | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `/feature-flag-status` | Full status report for a flag across all environments |

**npm**: [`@kud/mcp-harness-fme`](https://www.npmjs.com/package/@kud/mcp-harness-fme)

---

### 🎬 [mcp-trakt](./plugins/mcp-trakt)

Track what you're watching — search movies and shows, check in, browse your history, manage your watchlist, and get recommendations.

| Skill             | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `/trakt-whats-on` | See your watchlist, recently watched, and what's up next |
| `/trakt-checkin`  | Check in to a movie or episode you're about to watch     |

**npm**: [`@kud/mcp-trakt`](https://www.npmjs.com/package/@kud/mcp-trakt)

---

### 🔖 [mcp-raindrop-io](./plugins/mcp-raindrop-io)

Manage your Raindrop.io bookmarks from Claude — search your library, save new links, organise into collections, and tag.

| Skill              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `/bookmark-search` | Search your bookmarks by keyword, tag, or collection |
| `/bookmark-save`   | Save a URL to Raindrop.io with tags and collection   |

**npm**: [`@kud/mcp-raindrop-io`](https://www.npmjs.com/package/@kud/mcp-raindrop-io)

---

## Quick Start

### Add the MCP server

Each plugin's `plugin.json` contains the MCP config. Add the relevant block to your Claude Code config (`~/.claude/config.yml` or your profile's `claude-code.yml`):

```yaml
# opencode — query GitHub Copilot models
opencode:
  transport: stdio
  command: npx
  args: [-y, "@kud/mcp-opencode@latest"]
  env:
    OPENCODE_MODEL_ALLOW: ${OPENCODE_MODEL_ALLOW:-github-copilot/*}

# jenkins
jenkins:
  transport: stdio
  command: npx
  args: [-y, "@kud/mcp-jenkins@latest"]
  env:
    JENKINS_URL: ${JENKINS_URL}
    JENKINS_USER: ${JENKINS_USER}
    JENKINS_TOKEN: ${JENKINS_TOKEN}

# harness fme
harness-fme:
  transport: stdio
  command: npx
  args: [-y, "@kud/mcp-harness-fme@latest"]
  env:
    HARNESS_API_KEY: ${MCP_HARNESS_FME_TOKEN}

# trakt
trakt:
  transport: stdio
  command: npx
  args: [-y, "@kud/mcp-trakt@latest"]
  env:
    TRAKT_CLIENT_ID: ${MCP_TRAKT_CLIENT_ID}
    TRAKT_ACCESS_TOKEN: ${MCP_TRAKT_ACCESS_TOKEN}

# raindrop.io
raindrop:
  transport: stdio
  command: npx
  args: [-y, "@kud/mcp-raindrop-io@latest"]
  env:
    RAINDROP_TOKEN: ${MCP_RAINDROP_TOKEN}
```

### Install the skills

Copy the skill directories to your Claude skills folder, or symlink them:

```bash
# example — add ask-opencode
ln -s /path/to/claude-plugins/plugins/mcp-opencode/skills/ask-opencode ~/.claude/skills/ask-opencode
```

Or, if you use the `my` environment manager:

```bash
# copy skills to your ai/skills directory and run
my ai sync
```

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
