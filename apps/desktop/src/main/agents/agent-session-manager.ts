import { randomUUID } from 'node:crypto'
import type {
  AgentMessage,
  AgentSession,
  AgentSessionEvent,
  AgentSessionStatus,
  AgentTurnResult,
  ExecutionLogEntry,
} from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { PascalAgentProvider, PascalToolCallHandler } from './agent-provider'
import type { createAgentSessionStore } from './agent-session-store'
import type { createProjectStore } from '../projects/project-store'
import type { createVesperBridge } from './vesper-bridge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionStore = ReturnType<typeof createAgentSessionStore>
type ProjectStore = ReturnType<typeof createProjectStore>
type VesperBridge = ReturnType<typeof createVesperBridge>

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

export function createAgentSessionManager(deps: {
  sessionStore: SessionStore
  projectStore: ProjectStore
  provider?: PascalAgentProvider
  bridge?: VesperBridge
  toolHandler: PascalToolCallHandler
  onEvent?: (projectId: ProjectId, event: AgentSessionEvent) => void
}) {
  const { sessionStore, projectStore, provider, bridge, toolHandler, onEvent } = deps

  if (!bridge && !provider) {
    throw new Error('Either bridge or provider must be provided')
  }

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
  // Bridge path — uses Vesper bridge async generator for streaming turns
  // ---------------------------------------------------------------------------

  async function sendMessageViaBridge(
    bridgeRef: VesperBridge,
    projectId: ProjectId,
    prompt: string,
    project: { scene: unknown },
    session: AgentSession,
    selectionContext?: { selectedNodeIds: string[]; selectedNodeTypes: string[] },
  ): Promise<AgentTurnResult> {
    let responseText = ''
    const executionLog: ExecutionLogEntry[] = []
    const affectedNodeIds: string[] = []

    for await (const event of bridgeRef.chat(prompt, {
      projectId,
      sceneContext: project.scene,
      selectionContext,
    })) {
      switch (event.type) {
        case 'status':
          emit(projectId, { type: 'status-changed', status: 'applying' })
          break
        case 'text_delta':
          responseText += event.text
          break
        case 'text_complete':
          responseText = event.text
          break
        case 'tool_start': {
          const entry: ExecutionLogEntry = {
            type: 'tool-call',
            tool: event.toolName,
            args: event.input,
            timestamp: new Date().toISOString(),
          }
          executionLog.push(entry)
          emit(projectId, { type: 'execution-log', entry })
          // Track affected nodes from scene_applyCommands input
          if (event.toolName === 'scene_applyCommands') {
            const commands = (event.input.commands ?? []) as Array<Record<string, unknown>>
            for (const cmd of commands) {
              if (cmd.type === 'create-node' && cmd.node) {
                const node = cmd.node as Record<string, unknown>
                if (typeof node.id === 'string') affectedNodeIds.push(node.id)
              }
              if (cmd.type === 'update-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
              if (cmd.type === 'move-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
              if (cmd.type === 'delete-node' && typeof cmd.nodeId === 'string') affectedNodeIds.push(cmd.nodeId)
            }
          }
          break
        }
        case 'tool_result':
          executionLog.push({
            type: 'tool-result',
            tool: 'unknown', // bridge doesn't repeat the tool name in results
            result: event.result,
            timestamp: new Date().toISOString(),
          })
          break
        case 'error':
          throw new Error(event.message)
        case 'complete':
          // Final event — generator is done
          break
      }
    }

    // Build turn result
    const sceneCommandsApplied = executionLog.filter(
      (e) => e.type === 'tool-call' && e.tool === 'scene_applyCommands',
    ).length

    return {
      status: 'completed',
      summary: responseText || 'Done.',
      executionLog,
      sceneCommandsApplied,
      affectedNodeIds,
    }
  }

  // ---------------------------------------------------------------------------
  // Provider path — uses the legacy PascalAgentProvider.runTurn()
  // ---------------------------------------------------------------------------

  async function sendMessageViaProvider(
    providerRef: PascalAgentProvider,
    projectId: ProjectId,
    prompt: string,
    project: { scene: unknown },
    session: AgentSession,
    selectionContext?: { selectedNodeIds: string[]; selectedNodeTypes: string[] },
  ): Promise<AgentTurnResult> {
    const tracking = createTrackingToolHandler(toolHandler)

    const turnOutput = await providerRef.runTurn({
      projectId,
      prompt,
      sceneContext: project.scene,
      messageHistory: session.messages,
      tools: tracking.handler,
      selectionContext,
    })

    return {
      status: 'completed',
      summary: turnOutput.response,
      executionLog: [],
      sceneCommandsApplied: turnOutput.toolCallsExecuted,
      affectedNodeIds: tracking.getAffectedNodeIds(),
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

      // 8. Run the turn — bridge path or provider path
      let turnResult: AgentTurnResult

      if (bridge) {
        turnResult = await sendMessageViaBridge(bridge, projectId, prompt, project, session, selectionContext)
      } else if (provider) {
        turnResult = await sendMessageViaProvider(provider, projectId, prompt, project, session, selectionContext)
      } else {
        throw new Error('Either bridge or provider must be provided')
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
