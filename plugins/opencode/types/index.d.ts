export type OpencodeJobState = 'busy' | 'retry' | 'idle' | 'gone'

export type OpencodeJobRow = {
  port: number
  repo: string
  sessionId: string | null
  title: string
  startedAt: string
  state: OpencodeJobState
}

export type OpencodeJobs = {
  rows: OpencodeJobRow[]
  updatedAt: number
}

export type OpencodeJobsFocus = {
  isFocused: boolean
  order: string[]
  cursor: string | null
  copied: string | null
}

declare module 'claude-code' {
  interface PluginState {
    opencode: { jobs: OpencodeJobs; focus: OpencodeJobsFocus }
  }
}
