---
name: incidents-check
description: "Check vendor status pages when an external API or SaaS call is failing: timeouts, 5xx or odd errors from a third-party service, 'is X down?', 'is GitHub/AWS/Slack having issues?', or before debugging your own code for what may be a vendor-side failure."
---

Read-only. This skill runs the `incidents` CLI (`@kud/incidents-cli`) to see what the vendors you depend on are **declaring** on their own status pages. Use it early, before spending time on your own code, when the symptom looks like it could be the other side.

## Step 1 — Run it

```sh
incidents list --json
```

If `incidents` is not on PATH, use the same arguments through npx:

```sh
npx -y @kud/incidents-cli@latest list --json
```

Always use `list` with `--json`: it prints once and exits, never opens the interactive view. Exit codes:

| Code | Meaning                                                                          |
| ---- | -------------------------------------------------------------------------------- |
| 0    | All clear (maintenance and manual-link rows count as clear)                      |
| 1    | Something is degraded, or a page could not be read. Normal, not a tool failure   |
| 2    | Usage or configuration error: read stderr, it names the file and the id at fault |

## Step 2 — Check one service

When the symptom points at a single vendor, ask for it by id or alias (GitHub is `github` or `gh`, Cloudflare is `cf`):

```sh
incidents list <service> --json
```

This returns one record with history loaded: open incidents, affected components, and earlier ones. A name it does not know exits 2 and lists the known ids.

## Step 3 — Which services exist

The list comes from the user's own configuration (`${XDG_CONFIG_HOME:-~/.config}/incidents/config.yml`, then every `config.d/*.yml`; `INCIDENTS_CONFIG` replaces both), not from a fixed set. Run `incidents services` (tab-separated: id, name, aliases) and name what is actually configured. If the vendor in question is not there, say so rather than assuming it is fine. With no config file only `github`, `npm`, `cloudflare` and `claude` are watched.

## Step 4 — Read the result

Records come worst first. For each one:

- `indicator`: `critical`, `major`, `unknown`, `minor`, `maintenance`, `none` or `link`, worst first. Report anything above `none` that matches the symptom, with its `active[]` titles and links and the non-`operational` entries in `components[]`.
- `fetched: "failed"` or `indicator: "unknown"` means the page could not be read. That is **not green**: report it as unknown, never as fine.
- `indicator: "link"` is a manual row: the vendor has no machine-readable page and the tool claims nothing. Give the user the `url` to open themselves.
- `none` is only what the vendor has declared. Pages lag, and an outage can be partial or regional. A green row does not prove your calls work, so keep debugging, but say the vendor is not declaring anything.
- An empty `recent` with `historyFailed: true` is not a claim that nothing happened.
- `description` on `rss`-kind services (for example "Posted 2h ago: ...") reflects how recent the last post is, not a live health check.

Keep the report short: the vendor, what is declared, the link, and whether it plausibly explains the symptom (match the affected component or region to what the user is calling).

## Boundaries

- Never edit the user's config files unless they ask. To watch a new vendor, show the `services:` entry they would add and let them decide.
- Do not retry in a loop. One run, then report; re-run only when the user asks or after a fix.
