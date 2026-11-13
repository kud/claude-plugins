# Changelog

All notable changes to this project are documented here.

---

## 2.10.1 — 2026-11-13

This entry covers everything since 2.1.6, the last tagged release; later releases were untagged version bumps.

### New plugins

- **image-view** shows thumbnails of pasted images above the prompt and in conversation history, with a full-size viewer in an iTerm2 split. ([120fcdd](https://github.com/kud/claude-plugins/commit/120fcddf9144ffb1cdb601594f158497524860e7), [3cf20ce](https://github.com/kud/claude-plugins/commit/3cf20ce766911e146267415a79000f1a83e432ae), [85e4154](https://github.com/kud/claude-plugins/commit/85e4154ae01849dcaee1c5c4739592da58dad7ac))
- **incidents** checks vendor status pages before you debug your own code, and bundles a fallback CLI so it works out of the box. ([76ab93b](https://github.com/kud/claude-plugins/commit/76ab93b81a7eaaef17584b6d27538d3162f469eb), [6566552](https://github.com/kud/claude-plugins/commit/656655250bdd07e80858e2021f28240b88339ade))
- **sonarqube** gives read-only access to quality gates, issues, measures, flagged source, branches and projects. ([3d995ef](https://github.com/kud/claude-plugins/commit/3d995efe7ee6d56faab14c9fc25e87bff2d20c94))
- **youtube** manages playlists and cleans up duplicate or deleted-video entries with a dry-run-safe tool. ([2183ece](https://github.com/kud/claude-plugins/commit/2183ece4ad47bca9df7132d9a64d03e1e445f663))
- **lastfm** covers discovery, recent scrobbles and personalised recommendations. ([f99a50d](https://github.com/kud/claude-plugins/commit/f99a50d738a09f3a88c29d0dc8da3d6f071c7bc6), [a215b73](https://github.com/kud/claude-plugins/commit/a215b735d90dc6de4921b1d58c212ce1963db697))
- **qobuz** searches your music, favourites and playlists, and recommends what to listen to next. ([4832ac9](https://github.com/kud/claude-plugins/commit/4832ac9c69d8ba79bc39fd5aa9825c8639b26f02))
- **bsky**, **bugzilla** and **gtv** join the marketplace for Bluesky, Firefox/Mozilla bug triage and Google TV control. ([626cc0b](https://github.com/kud/claude-plugins/commit/626cc0b5020d65b3f7332f4b6510cd6130267794))
- **getstream-feeds** inspects feed subscriptions and activity fan-out. ([1003f51](https://github.com/kud/claude-plugins/commit/1003f5167808e010566ec2a3e1e413086625dda6))
- **unsplash** searches and fetches freely-licensed photos. ([06096af](https://github.com/kud/claude-plugins/commit/06096af597e4fe23d115adf6bbeeb5abb4d9b306), [e3633e5](https://github.com/kud/claude-plugins/commit/e3633e5b942880626acb22ca42b9c9e0cd02d06a))
- **gandi** manages domains, DNS records and redirects. ([126be60](https://github.com/kud/claude-plugins/commit/126be6069c6df344a34ccf6d7379b04170014732))
- **revu** turns captured code-review annotations into action. ([da4daa3](https://github.com/kud/claude-plugins/commit/da4daa34942770b270a4834b71bcf7aab46efcd7))

### Changes to existing plugins

- **opencode** can now talk to a running opencode session, delegate tasks to a runner agent, and supports opencode v2 sessions. ([e4d7de7](https://github.com/kud/claude-plugins/commit/e4d7de76f59ebf94457a99413e008d623a345c01), [9bcc859](https://github.com/kud/claude-plugins/commit/9bcc859cadb332ab6cc8a2a10c86f1511636f6dc), [6b7781e](https://github.com/kud/claude-plugins/commit/6b7781ed1d2b8cd6162e92b134853003c7ba3f02))
- **revu** can apply review comments directly with a new implement skill. ([31885ff](https://github.com/kud/claude-plugins/commit/31885ffb14b9182223be019425efe4464a0f42f6))
- **raindrop-io** now uses the official Raindrop.io MCP server. ([6488e45](https://github.com/kud/claude-plugins/commit/6488e45a5bafd3c97543c0a3c932142bd957a806))
- **keep**, **harness-fme**, **jenkins**, **raindrop-io** and **trakt** gain companion skills. ([9f41f8d](https://github.com/kud/claude-plugins/commit/9f41f8de8ea77521247a5a6dc9f48ee1e85bbe58))
- **gandi** documents interactive mode and richer redirect handling. ([2a45585](https://github.com/kud/claude-plugins/commit/2a45585ac23f42759aa7032b25fec32f6e684f5a))

### Fixes

- **opencode** no longer defaults the send agent to `plan`. ([f25d384](https://github.com/kud/claude-plugins/commit/f25d3841f4e58c0793cc4b98dd2ce9de22aeb81d))

### Removed

- The **pcloud** plugin was removed, and the bugzilla skills were renamed. ([acfd13c](https://github.com/kud/claude-plugins/commit/acfd13c64273f048881b767785bdba6fee295aea))

### Documentation

- Docs now live on kud.io, with a slimmed README front page and one page per plugin. ([d2ec058](https://github.com/kud/claude-plugins/commit/d2ec05854ea1bc292f5c4526da5a2d2d89b039ed), [a3b2d15](https://github.com/kud/claude-plugins/commit/a3b2d150f352d7d920a9b99666bf2f6f8c73fdcf))

<details>
<summary>Internal (33 commits)</summary>

- Marketplace and plugin version bumps from 2.2.0 to 2.10.1, including opencode jobs pane work that was later shelved.
- Manifest test suite and CI workflow added; old GitHub Pages workflow and site removed; VERSION file added.
- Repo icon added, and image-view refactors, tests and docs tweaks.

</details>

---
