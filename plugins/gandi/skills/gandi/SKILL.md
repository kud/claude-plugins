---
name: gandi
description: "Manage Gandi domains, DNS records, and web redirects via the gandi CLI. Use when the user wants to view or edit DNS records, check domain info or availability, renew a domain, toggle auto-renew, or set up web redirects on a Gandi-managed domain."
---

## Prerequisites

The `gandi` CLI must be installed (`npm install -g @kud/gandi-cli`) and a Gandi
Personal Access Token must be available as `GANDI_API_KEY` (or in
`~/.config/gandi/config.toml`). If any command returns an authentication error,
run `gandi doctor --json` and surface its guidance — do not retry blindly.

## Always pass `--json`

Append `--json` to every command. Reads print the data; writes print a result
object (`{ "ok": true, ... }`); errors print `{ "error": "..." }` to **stderr**
with a non-zero exit code. Parse the JSON — never scrape the human-formatted
tables.

## Commands

**DNS**

- `gandi dns list <domain> --json`
- `gandi dns get <domain> <type> <name> --json`
- `gandi dns set <domain> <type> <name> <value> [--ttl <s>] --json` — replaces the whole record
- `gandi dns add <domain> <type> <name> <value> [--ttl <s>] --json` — appends one value
- `gandi dns export <domain> --json` — returns `{ "zone": "<BIND zone file>" }`
- `gandi dns delete <domain> <type> <name> --yes --json`

**Domains**

- `gandi domain list --json`
- `gandi domain info <domain> --json`
- `gandi domain available <name> --json`
- `gandi domain renew <domain> [--duration <years>] --json`
- `gandi domain autorenew <domain> on|off --json`
- `gandi domain nameservers <domain> --json`

**Redirects (web forwarding)**

- `gandi redirect list <domain> --json`
- `gandi redirect add <domain> <source> <target> [--type http301|http302|cloak] --json`
- `gandi redirect delete <domain> <source> --yes --json`

## Safety

Destructive commands (`dns delete`, `redirect delete`) require `--yes`. **Always
confirm with the user before passing `--yes`**, and show them exactly what will
be removed first (run `gandi dns get …` or `gandi redirect list …`). Never add
`--yes` on your own initiative.

## Tips

- `set` **replaces** a record's full value set; `add` **appends** a single value.
  Use `add` for a second A address or an extra TXT string so existing values are
  not clobbered.
- CNAME targets should be fully-qualified, with a trailing dot
  (e.g. `target.example.com.`).
- The `domain:tech` scope ("Manage technical configuration") covers both DNS and
  web redirects.
