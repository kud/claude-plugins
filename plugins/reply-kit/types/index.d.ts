export type AskInput = {
  question: string
  options: string[]
  multi?: boolean
  french?: boolean
  isGated?: boolean
}

export type CopyItem = { label?: string; value: string }
export type CopyInput = { items: CopyItem[] }
export type CopyState = { index: number; isCopied: boolean; reason?: string }

export type ChooseState = { picked: number[]; isSent: boolean }

export type LiveInput = { repo: string; runId: string }
export type LiveJob = { name: string; status: string; conclusion: string }
export type LiveRun = {
  title: string
  url: string
  status: string
  conclusion: string
  jobs: LiveJob[]
  error?: string
}

export type FoldInput = { summary: string; body: string }

declare module "claude-code" {
  interface PluginState {
    "reply-kit": {
      answers: Shaped<Record<string, number>>
      copies: Shaped<Record<string, CopyState>>
      choices: Shaped<Record<string, ChooseState>>
      runs: Shaped<Record<string, LiveRun>>
      folds: Shaped<Record<string, boolean>>
      locked: Shaped<Record<string, boolean>>
    }
  }
}
