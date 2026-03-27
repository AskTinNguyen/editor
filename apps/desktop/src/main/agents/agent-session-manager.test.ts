import { describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectStore } from '../projects/project-store'
import { applyProjectSceneCommands } from '../projects/project-command-service'
import { createAgentSessionStore } from './agent-session-store'
import { createAgentSessionManager } from './agent-session-manager'
import { createStubAgentProvider } from './stub-agent-provider'
import type { PascalAgentProvider, PascalToolCallHandler } from './agent-provider'
import type { AgentSessionEvent } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'

// ---------------------------------------------------------------------------
// Test helper — wire tool handler to the real project store
// ---------------------------------------------------------------------------

function createTestToolHandler(
  projectStore: ReturnType<typeof createProjectStore>,
): PascalToolCallHandler {
  return {
    project_read: async (projectId: ProjectId) => {
      const project = await projectStore.openProjectById(projectId)
      return { name: project.name, scene: project.scene }
    },
    scene_read: async (projectId: ProjectId) => {
      const project = await projectStore.openProjectById(projectId)
      return project.scene
    },
    scene_applyCommands: async (payload: { projectId: ProjectId; commands: any[] }) => {
      return applyProjectSceneCommands(projectStore, payload.projectId, payload.commands)
    },
  }
}

// ---------------------------------------------------------------------------
// Minimal provider for read-only tests
// ---------------------------------------------------------------------------

const minimalProvider: PascalAgentProvider = {
  name: 'minimal-test',
  async runTurn({ tools, projectId }) {
    const project = await tools.project_read(projectId)
    return {
      response: `Read project "${project.name}".`,
      toolCallsExecuted: 1,
    }
  },
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('AgentSessionManager integration', () => {
  test('sendMessage emits status events in the correct order', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const events: AgentSessionEvent[] = []
      const onEvent = mock(((_projectId: ProjectId, event: AgentSessionEvent) => {
        events.push(event)
      }) as (projectId: ProjectId, event: AgentSessionEvent) => void)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
        onEvent,
      })

      const project = await projectStore.createProject({ name: 'Status Test' })
      await manager.sendMessage(project.projectId, 'Add a wall to the scene')

      const statusEvents = events
        .filter((e): e is Extract<AgentSessionEvent, { type: 'status-changed' }> => e.type === 'status-changed')
        .map((e) => e.status)

      expect(statusEvents).toEqual(['reading', 'planning', 'applying', 'completed'])
      expect(onEvent).toHaveBeenCalled()

      const messageEvents = events.filter((e) => e.type === 'message-added')
      expect(messageEvents.length).toBeGreaterThanOrEqual(2)

      const turnCompletedEvents = events.filter((e) => e.type === 'turn-completed')
      expect(turnCompletedEvents.length).toBe(1)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage persists session with user and agent messages', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Persist Test' })
      await manager.sendMessage(project.projectId, 'Show me the current layout')

      const session = await manager.getSession(project.projectId)

      expect(session.messages.length).toBe(2)

      const userMessage = session.messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage!.content).toBe('Show me the current layout')

      const agentMessage = session.messages.find((m) => m.role === 'agent')
      expect(agentMessage).toBeDefined()
      expect(agentMessage!.content.length).toBeGreaterThan(0)

      expect(session.status).toBe('completed')
      expect(userMessage!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(agentMessage!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(session.lastTurnResult).not.toBeNull()
      expect(session.lastTurnResult!.status).toBe('completed')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage returns a completed turn result', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Result Test' })
      const result = await manager.sendMessage(project.projectId, 'Read the project')

      expect(result.status).toBe('completed')
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
      expect(Array.isArray(result.executionLog)).toBe(true)
      expect(typeof result.sceneCommandsApplied).toBe('number')
      expect(result.error).toBeUndefined()
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('getSession returns an idle session for a new project', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Idle Test' })
      const session = await manager.getSession(project.projectId)

      expect(session.status).toBe('idle')
      expect(session.messages).toEqual([])
      expect(session.lastTurnResult).toBeNull()
      expect(session.projectId).toBe(project.projectId)
      expect(session.sessionId).toMatch(/^session_/)
      expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(session.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage returns error for unknown project', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const events: AgentSessionEvent[] = []
      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
        onEvent: (_projectId, event) => {
          events.push(event)
        },
      })

      const fakeProjectId = 'project_nonexistent000000000000' as ProjectId
      const result = await manager.sendMessage(fakeProjectId, 'Do something')

      expect(result.status).toBe('error')
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)

      const session = await manager.getSession(fakeProjectId)
      expect(session.status).toBe('error')
      expect(session.messages.length).toBe(2)
      expect(session.messages[0]!.role).toBe('user')
      expect(session.messages[1]!.role).toBe('agent')

      const statusEvents = events
        .filter((e): e is Extract<AgentSessionEvent, { type: 'status-changed' }> => e.type === 'status-changed')
        .map((e) => e.status)

      expect(statusEvents[0]).toBe('reading')
      expect(statusEvents[statusEvents.length - 1]).toBe('error')

      const turnCompleted = events.find((e) => e.type === 'turn-completed')
      expect(turnCompleted).toBeDefined()
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage with stub provider creates a wall and persists it', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)
      const provider = createStubAgentProvider()

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'E2E Wall Test' })

      const before = await projectStore.openProjectById(project.projectId)
      const initialNodeCount = Object.keys(before.scene.nodes).length

      const result = await manager.sendMessage(project.projectId, 'add a wall')

      expect(result.status).toBe('completed')
      expect(result.sceneCommandsApplied).toBeGreaterThan(0)

      const reopened = await projectStore.openProjectById(project.projectId)
      const wallNodes = Object.values(reopened.scene.nodes).filter(
        (n) => (n as { type: string }).type === 'wall',
      )
      expect(wallNodes.length).toBeGreaterThan(0)

      const finalNodeCount = Object.keys(reopened.scene.nodes).length
      expect(finalNodeCount).toBeGreaterThan(initialNodeCount)

      const session = await manager.getSession(project.projectId)
      expect(session.status).toBe('completed')
      expect(session.messages.length).toBe(2)
      expect(session.messages[0]!.role).toBe('user')
      expect(session.messages[0]!.content).toBe('add a wall')
      expect(session.messages[1]!.role).toBe('agent')
      expect(session.lastTurnResult).not.toBeNull()
      expect(session.lastTurnResult!.sceneCommandsApplied).toBeGreaterThan(0)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
