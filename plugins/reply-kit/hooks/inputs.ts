// Readers for the component tools' inputs and the live run's JSON: each takes
// anything (a tool.run `e`, a half-streamed props.input) and answers a value
// only once it is whole.
import type { CopyInput, FoldInput, LiveInput, LiveRun } from "../types"

const record = (value: unknown) =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined

export const readCopy = (value: unknown): CopyInput | undefined => {
  const items = record(value)?.items
  if (!Array.isArray(items)) return undefined
  const whole = items
    .map(record)
    .filter((item) => typeof item?.value === "string" && item.value.length > 0)
    .map((item) => ({
      value: item!.value as string,
      label: typeof item!.label === "string" ? item!.label : undefined,
    }))
  return whole.length > 0 ? { items: whole.slice(0, 9) } : undefined
}

export const readFold = (value: unknown): FoldInput | undefined => {
  const input = record(value)
  if (typeof input?.summary !== "string" || typeof input.body !== "string")
    return undefined
  return { summary: input.summary, body: input.body }
}

// Only a GitHub Actions run by its repository and numeric id: the tool never
// runs a command the model names.
export const readLive = (value: unknown): LiveInput | undefined => {
  const input = record(value)
  const repo = input?.repo
  const runId = String(input?.runId ?? "")
  if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    return undefined
  if (!/^\d{1,20}$/.test(runId)) return undefined
  return { repo, runId }
}

export const liveArgv = ({ repo, runId }: LiveInput) => [
  "gh",
  "run",
  "view",
  runId,
  "-R",
  repo,
  "--json",
  "status,conclusion,displayTitle,url,jobs",
]

export const parseRun = (stdout: string): LiveRun => {
  const raw = JSON.parse(stdout) as Record<string, unknown>
  const jobs = Array.isArray(raw.jobs) ? raw.jobs.map(record) : []
  return {
    title: String(raw.displayTitle ?? ""),
    url: String(raw.url ?? ""),
    status: String(raw.status ?? ""),
    conclusion: String(raw.conclusion ?? ""),
    jobs: jobs.map((job) => ({
      name: String(job?.name ?? ""),
      status: String(job?.status ?? ""),
      conclusion: String(job?.conclusion ?? ""),
    })),
  }
}

// The state word carries the meaning; the emoji is its shape, never a colour.
export const stateWord = (status: string, conclusion: string) => {
  if (status !== "completed") return "⏳ running"
  if (conclusion === "success") return "✅ green"
  if (conclusion === "skipped" || conclusion === "neutral") return "💤 skipped"
  return "🔥 red"
}

export const isOver = (run: LiveRun) =>
  run.status === "completed" || Boolean(run.error)

export const runMarkdown = (input: LiveInput, run: LiveRun) =>
  [
    `${stateWord(run.status, run.conclusion)} ${input.repo} run ${input.runId}: ${run.title}`,
    ...run.jobs.map(
      (job) => `- ${stateWord(job.status, job.conclusion)} ${job.name}`,
    ),
    run.url,
  ].join("\n")

export const chosenText = (picked: number[]) =>
  [...picked]
    .sort((a, b) => a - b)
    .map((index) => String(index + 1))
    .join(", ")
