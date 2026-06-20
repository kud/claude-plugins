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
