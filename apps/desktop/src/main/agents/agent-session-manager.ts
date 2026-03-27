import { randomUUID } from 'node:crypto'
import type {
  AgentMessage,
  AgentSession,
  AgentSessionEvent,
  AgentSessionStatus,
  AgentTurnResult,
} from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { PascalAgentProvider, PascalToolCallHandler } from './agent-provider'
import type { createAgentSessionStore } from './agent-session-store'
import type { createProjectStore } from '../projects/project-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionStore = ReturnType<typeof createAgentSessionStore>
type ProjectStore = ReturnType<typeof createProjectStore>

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

export function createAgentSessionManager(deps: {
  sessionStore: SessionStore
  projectStore: ProjectStore
  provider: PascalAgentProvider
  toolHandler: PascalToolCallHandler
  onEvent?: (projectId: ProjectId, event: AgentSessionEvent) => void
}) {
  const { sessionStore, projectStore, provider, toolHandler, onEvent } = deps

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function emit(projectId: ProjectId, event: AgentSessionEvent): void {
    onEvent?.(projectId, event)
  }

  async function setStatus(session: AgentSession, status: AgentSessionStatus): Promise<void> {
    session.status = status
    emit(session.projectId, { type: 'status-changed', status })
  }

  function createMessage(role: 'user' | 'agent', content: string): AgentMessage {
    return {
      id: randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString(),
    }
  }

  // ---------------------------------------------------------------------------
  // Tracking tool handler — wraps the base handler to capture affected node IDs
  // ---------------------------------------------------------------------------

  function createTrackingToolHandler(base: PascalToolCallHandler) {
    const affectedNodeIds: string[] = []

    return {
      handler: {
        ...base,
        scene_applyCommands: async (payload: Parameters<PascalToolCallHandler['scene_applyCommands']>[0]) => {
          // Extract node IDs from commands
          for (const cmd of payload.commands as Array<Record<string, unknown>>) {
            if (cmd.type === 'create-node' && cmd.node) {
              const node = cmd.node as Record<string, unknown>
              if (typeof node.id === 'string') affectedNodeIds.push(node.id)
            }
            if (cmd.type === 'update-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
            if (cmd.type === 'move-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
            if (cmd.type === 'delete-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
          }
          return base.scene_applyCommands(payload)
        },
      } satisfies PascalToolCallHandler,
      getAffectedNodeIds: () => [...affectedNodeIds],
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async function getSession(projectId: ProjectId): Promise<AgentSession> {
    return sessionStore.getSession(projectId)
  }

  async function sendMessage(
    projectId: ProjectId,
    prompt: string,
    options?: { selectedNodeIds?: string[] },
  ): Promise<AgentTurnResult> {
    // 1. Load session
    const session = await sessionStore.getSession(projectId)

    // 2. Add user message
    const userMessage = createMessage('user', prompt)
    session.messages.push(userMessage)
    emit(projectId, { type: 'message-added', message: userMessage })

    try {
      // 3. Set status to 'reading'
      await setStatus(session, 'reading')

      // 4. Load current project
      const project = await projectStore.openProjectById(projectId)

      // 5. Set status to 'planning'
      await setStatus(session, 'planning')

      // 6. Set status to 'applying'
      await setStatus(session, 'applying')

      // 7. Build selection context from the loaded scene if node IDs are provided
      let selectionContext: { selectedNodeIds: string[]; selectedNodeTypes: string[] } | undefined
      if (options?.selectedNodeIds && options.selectedNodeIds.length > 0) {
        const sceneNodes = (project.scene as { nodes?: Record<string, { type?: string }> })?.nodes ?? {}
        const selectedNodeTypes = options.selectedNodeIds.map((id) => sceneNodes[id]?.type ?? 'unknown')
        selectionContext = {
          selectedNodeIds: options.selectedNodeIds,
          selectedNodeTypes,
        }
      }

      // 8. Create tracking tool handler to capture affected node IDs
      const tracking = createTrackingToolHandler(toolHandler)

      // 9. Run the provider turn — provider handles LLM + tool-use loop
      const turnOutput = await provider.runTurn({
        projectId,
        prompt,
        sceneContext: project.scene,
        messageHistory: session.messages,
        tools: tracking.handler,
        selectionContext,
      })

      // 10. Build AgentTurnResult
      const turnResult: AgentTurnResult = {
        status: 'completed',
        summary: turnOutput.response,
        executionLog: [],
        sceneCommandsApplied: turnOutput.toolCallsExecuted,
        affectedNodeIds: tracking.getAffectedNodeIds(),
      }

      // 9. Add agent message with summary
      const agentMessage = createMessage('agent', turnResult.summary)
      session.messages.push(agentMessage)
      emit(projectId, { type: 'message-added', message: agentMessage })

      // 10. Set status to 'completed'
      session.lastTurnResult = turnResult
      await setStatus(session, 'completed')

      // 11. Save session, emit turn-completed
      await sessionStore.saveSession(session)
      emit(projectId, { type: 'turn-completed', result: turnResult })

      return turnResult
    } catch (err) {
      // Unhandled errors during the turn
      const errorMessage = err instanceof Error ? err.message : String(err)

      const turnResult: AgentTurnResult = {
        status: 'error',
        summary: `Agent turn failed: ${errorMessage}`,
        executionLog: [],
        sceneCommandsApplied: 0,
        affectedNodeIds: [],
        error: errorMessage,
      }

      const agentMessage = createMessage('agent', turnResult.summary)
      session.messages.push(agentMessage)
      emit(projectId, { type: 'message-added', message: agentMessage })

      session.lastTurnResult = turnResult
      await setStatus(session, 'error')
      await sessionStore.saveSession(session)
      emit(projectId, { type: 'turn-completed', result: turnResult })

      return turnResult
    }
  }

  return {
    getSession,
    sendMessage,
  }
}
