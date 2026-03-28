import type { PersistedProviderConfig } from '../main/agents/providers/provider-config'
import type { ProjectId } from './projects'
import type { SceneCommand, SceneCommandBatchResult, SceneCommandResult } from '@pascal/scene-engine'
import type { UiInspectorAttachment } from './ui-inspector'

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
// Model selection
// ---------------------------------------------------------------------------

export type ModelFamily = 'claude' | 'openai' | 'kimi'

export type ModelDefinition = {
  id: string
  name: string
  family: ModelFamily
  contextWindow: number
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', family: 'claude', contextWindow: 200000 },
]

// ---------------------------------------------------------------------------
// Thinking levels
// ---------------------------------------------------------------------------

export type ThinkingLevel = 'off' | 'think' | 'max'

export type ThinkingLevelDefinition = {
  id: ThinkingLevel
  name: string
  description: string
  budgetTokens: number
}

export const THINKING_LEVELS: ThinkingLevelDefinition[] = [
  { id: 'off', name: 'No Thinking', description: 'Fastest responses', budgetTokens: 0 },
  { id: 'think', name: 'Thinking', description: 'Balanced reasoning', budgetTokens: 4000 },
  { id: 'max', name: 'Max Thinking', description: 'Deepest reasoning', budgetTokens: 16000 },
]

export function getThinkingBudgetTokens(level: ThinkingLevel): number {
  return THINKING_LEVELS.find(t => t.id === level)?.budgetTokens ?? 0
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
  model: string
  thinkingLevel: ThinkingLevel
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

export const PROVIDER_CONFIG_IPC_CHANNELS = {
  get: 'provider-config:get',
  set: 'provider-config:set',
  test: 'provider-config:test',
} as const

export const MODEL_IPC_CHANNELS = {
  getModels: 'models:list',
  setSessionModel: 'session:set-model',
  setSessionThinking: 'session:set-thinking',
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
    options?: {
      selectedNodeIds?: string[]
      model?: string
      thinkingLevel?: ThinkingLevel
      agentContextPrefix?: string
      uiInspectorAttachment?: UiInspectorAttachment
    },
  ): Promise<AgentTurnResult>
  subscribe(projectId: ProjectId, listener: (event: AgentSessionEvent) => void): () => void
  getProviderConfig(): Promise<PersistedProviderConfig>
  setProviderConfig(config: PersistedProviderConfig): Promise<void>
  testProviderConnection(config: PersistedProviderConfig): Promise<{ ok: boolean; error?: string }>
}
