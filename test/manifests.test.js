import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const readJson = (p) => JSON.parse(read(p))

const marketplace = readJson(".claude-plugin/marketplace.json")

test("VERSION file matches marketplace metadata.version", () => {
  assert.equal(read("VERSION").trim(), marketplace.metadata.version)
})

test("every plugin entry is well-formed and its source resolves", () => {
  for (const p of marketplace.plugins) {
    for (const field of [
      "name",
      "version",
      "description",
      "source",
      "category",
    ]) {
      assert.ok(p[field], `plugin "${p.name ?? "?"}" is missing "${field}"`)
    }
    const manifestPath = join(p.source, ".claude-plugin", "plugin.json")
    assert.ok(existsSync(join(root, manifestPath)), `missing ${manifestPath}`)

    const manifest = readJson(manifestPath)
    assert.equal(manifest.name, p.name, `name mismatch for "${p.name}"`)
  }
})

test("plugin names are unique", () => {
  const names = marketplace.plugins.map((p) => p.name)
  assert.equal(new Set(names).size, names.length, "duplicate plugin names")
})

test("every plugin's skills directory (if present) is non-empty", () => {
  for (const p of marketplace.plugins) {
    const skillsDir = join(root, p.source, "skills")
    if (!existsSync(skillsDir)) continue
    const skills = readdirSync(skillsDir)
    assert.ok(skills.length > 0, `"${p.name}" has an empty skills/ directory`)
    for (const skill of skills) {
      const skillFile = join(skillsDir, skill, "SKILL.md")
      assert.ok(
        existsSync(skillFile),
        `missing SKILL.md for "${p.name}/${skill}"`,
      )
    }
  }
})

test("every docs page listed in meta.json has an .mdx file", () => {
  const meta = readJson("docs/meta.json")
  for (const page of meta.pages) {
    assert.ok(
      existsSync(join(root, "docs", `${page}.mdx`)),
      `meta.json lists "${page}" but docs/${page}.mdx is missing`,
    )
  }
})

const parseFrontmatter = (source) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (pair) fields[pair[1]] = pair[2].trim()
  }
  return fields
}

test("every plugin's agents directory (if present) holds valid agent files", () => {
  for (const p of marketplace.plugins) {
    const agentsDir = join(root, p.source, "agents")
    if (!existsSync(agentsDir)) continue
    const agents = readdirSync(agentsDir).filter((f) => f.endsWith(".md"))
    assert.ok(agents.length > 0, `"${p.name}" has an empty agents/ directory`)
    for (const file of agents) {
      const label = `${p.name}/agents/${file}`
      const fields = parseFrontmatter(
        readFileSync(join(agentsDir, file), "utf8"),
      )
      assert.ok(fields, `${label} has no frontmatter`)
      assert.ok(fields.name, `${label} is missing "name"`)
      assert.ok(fields.description, `${label} is missing "description"`)
      assert.equal(
        fields.name,
        file.replace(/\.md$/, ""),
        `${label}: name must match the file name`,
      )
    }
  }
})
