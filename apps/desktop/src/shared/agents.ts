import type { ProjectId } from './projects'
import type { SceneCommand, SceneCommandBatchResult, SceneCommandResult } from '@pascal/scene-engine'

// ---------------------------------------------------------------------------
// Agent session identity
// ---------------------------------------------------------------------------

export type AgentSessionId = `session_${string}`

export type AgentSessionStatus =
  | 'idle'
  | 'reading'
  | 'planning'
  | 'applying'
  | 'completed'
  | 'error'

// ---------------------------------------------------------------------------
// Agent messages
// ---------------------------------------------------------------------------

export type AgentMessageRole = 'user' | 'agent'

export type AgentMessage = {
  id: string
  role: AgentMessageRole
  content: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Execution log entries
// ---------------------------------------------------------------------------

export type ExecutionLogEntry =
  | { type: 'tool-call'; tool: string; args: Record<string, unknown>; timestamp: string }
  | { type: 'tool-result'; tool: string; result: unknown; timestamp: string }
  | { type: 'console'; level: 'log' | 'warn' | 'error'; args: unknown[]; timestamp: string }
  | { type: 'scene-commands-applied'; result: SceneCommandResult | SceneCommandBatchResult; timestamp: string }

// ---------------------------------------------------------------------------
// Agent turn result
// ---------------------------------------------------------------------------

export type AgentTurnResult = {
  status: 'completed' | 'error'
  summary: string
  executionLog: ExecutionLogEntry[]
  sceneCommandsApplied: number
  affectedNodeIds: string[]
  error?: string
}

// ---------------------------------------------------------------------------
// Agent session (persisted per project)
// ---------------------------------------------------------------------------

export type AgentSession = {
  sessionId: AgentSessionId
  projectId: ProjectId
  status: AgentSessionStatus
  messages: AgentMessage[]
  lastTurnResult: AgentTurnResult | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Session events (pushed to renderer via IPC)
// ---------------------------------------------------------------------------

export type AgentSessionEvent =
  | { type: 'status-changed'; status: AgentSessionStatus }
  | { type: 'message-added'; message: AgentMessage }
  | { type: 'execution-log'; entry: ExecutionLogEntry }
  | { type: 'turn-completed'; result: AgentTurnResult }

// ---------------------------------------------------------------------------
// IPC channel constants
// ---------------------------------------------------------------------------

export const AGENT_IPC_CHANNELS = {
  getSession: 'agents:get-session',
  sendMessage: 'agents:send-message',
  subscribe: 'agents:subscribe',
  unsubscribe: 'agents:unsubscribe',
  event: 'agents:event',
} as const

// ---------------------------------------------------------------------------
// Code execution (pascal_execute gateway)
// ---------------------------------------------------------------------------

export type PascalExecuteRequest = {
  code: string
  projectId: ProjectId
  timeoutMs?: number
}

export type PascalExecuteResult = {
  status: 'completed' | 'error' | 'timeout'
  logs: ExecutionLogEntry[]
  error?: string
}

// ---------------------------------------------------------------------------
// pascal proxy tools (model-facing surface)
// ---------------------------------------------------------------------------

export type PascalProxyTools = {
  project_read: (projectId: ProjectId) => Promise<{ name: string; scene: unknown }>
  scene_read: (projectId: ProjectId) => Promise<unknown>
  scene_applyCommands: (payload: {
    projectId: ProjectId
    commands: SceneCommand[]
  }) => Promise<{ status: string; result: unknown }>
}

// ---------------------------------------------------------------------------
// Desktop API extension for agents
// ---------------------------------------------------------------------------

export type PascalDesktopAgentsApi = {
  getSession(projectId: ProjectId): Promise<AgentSession>
  sendMessage(
    projectId: ProjectId,
    prompt: string,
    options?: { selectedNodeIds?: string[] },
  ): Promise<AgentTurnResult>
  subscribe(projectId: ProjectId, listener: (event: AgentSessionEvent) => void): () => void
}
