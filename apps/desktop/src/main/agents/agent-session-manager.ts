import { randomUUID } from 'node:crypto'
import type {
  AgentMessage,
  AgentSession,
  AgentSessionEvent,
  AgentSessionStatus,
  AgentTurnResult,
  ExecutionLogEntry,
  PascalExecuteRequest,
  PascalExecuteResult,
} from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { createAgentSessionStore } from './agent-session-store'
import type { createProjectStore } from '../projects/project-store'

// ---------------------------------------------------------------------------
// Dependency-injected executor interface (Worker E builds the real one)
// ---------------------------------------------------------------------------

type CodeExecutor = {
  execute(request: PascalExecuteRequest): Promise<PascalExecuteResult>
}

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

type SessionStore = ReturnType<typeof createAgentSessionStore>
type ProjectStore = ReturnType<typeof createProjectStore>

export function createAgentSessionManager(deps: {
  sessionStore: SessionStore
  projectStore: ProjectStore
  executor: CodeExecutor
  onEvent?: (projectId: ProjectId, event: AgentSessionEvent) => void
}) {
  const { sessionStore, projectStore, executor, onEvent } = deps

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
  // Public API
  // ---------------------------------------------------------------------------

  async function getSession(projectId: ProjectId): Promise<AgentSession> {
    return sessionStore.getSession(projectId)
  }

  async function sendMessage(projectId: ProjectId, prompt: string): Promise<AgentTurnResult> {
    // 1. Load session
    const session = await sessionStore.getSession(projectId)

    // 2. Add user message
    const userMessage = createMessage('user', prompt)
    session.messages.push(userMessage)
    emit(projectId, { type: 'message-added', message: userMessage })

    try {
      // 3. Set status to 'reading'
      await setStatus(session, 'reading')

      // 4. Load current project to get scene state
      await projectStore.openProjectById(projectId)

      // 5. Set status to 'planning'
      await setStatus(session, 'planning')

      // 6. Build execution code (PLACEHOLDER — real LLM integration replaces this)
      const code = `
        // Agent prompt: ${JSON.stringify(prompt)}
        const project = await pascal.project_read('${projectId}')
        // TODO: Real LLM-generated code will go here.
        // For now, just read the project as a placeholder.
      `

      // 7. Set status to 'applying'
      await setStatus(session, 'applying')

      // 8. Execute via executor
      const execResult = await executor.execute({ code, projectId })

      // 9. Build AgentTurnResult from execution result
      const sceneCommandsApplied = execResult.logs.filter(
        (entry: ExecutionLogEntry) => entry.type === 'scene-commands-applied',
      ).length

      const turnResult: AgentTurnResult = {
        status: execResult.status === 'completed' ? 'completed' : 'error',
        summary:
          execResult.status === 'completed'
            ? `Processed prompt and applied ${sceneCommandsApplied} scene command(s).`
            : `Execution failed: ${execResult.error ?? 'unknown error'}`,
        executionLog: execResult.logs,
        sceneCommandsApplied,
        error: execResult.error,
      }

      // Emit execution log entries individually
      for (const entry of execResult.logs) {
        emit(projectId, { type: 'execution-log', entry })
      }

      // 10. Add agent message with summary
      const agentMessage = createMessage('agent', turnResult.summary)
      session.messages.push(agentMessage)
      emit(projectId, { type: 'message-added', message: agentMessage })

      // 11. Set status to 'completed' or 'error'
      session.lastTurnResult = turnResult
      await setStatus(session, turnResult.status === 'completed' ? 'completed' : 'error')

      // 12. Save session, emit turn-completed
      await sessionStore.saveSession(session)
      emit(projectId, { type: 'turn-completed', result: turnResult })

      // 13. Return result
      return turnResult
    } catch (err) {
      // Unhandled errors during the turn
      const errorMessage = err instanceof Error ? err.message : String(err)

      const turnResult: AgentTurnResult = {
        status: 'error',
        summary: `Agent turn failed: ${errorMessage}`,
        executionLog: [],
        sceneCommandsApplied: 0,
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
