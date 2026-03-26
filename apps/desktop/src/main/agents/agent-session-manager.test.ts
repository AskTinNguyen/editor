import { describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectStore } from '../projects/project-store'
import { createAgentSessionStore } from './agent-session-store'
import { createAgentSessionManager } from './agent-session-manager'
import { createPascalCodeExecutor } from './pascal-code-executor'
import { applyProjectSceneCommands } from '../projects/project-command-service'
import type { AgentSessionEvent } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'

// ---------------------------------------------------------------------------
// Test helper — wire executor tools to the real project store
// ---------------------------------------------------------------------------

function createTestTools(projectStore: ReturnType<typeof createProjectStore>) {
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
      const result = await applyProjectSceneCommands(projectStore, payload.projectId, payload.commands)
      return result
    },
  }
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('AgentSessionManager integration', () => {
  test('sendMessage emits status events in the correct order', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'pascal-sm-status-'))
    const sessionDir = await mkdtemp(join(tmpdir(), 'pascal-sm-session-'))

    try {
      const projectStore = createProjectStore({ rootDir: projectDir })
      const sessionStore = createAgentSessionStore({ rootDir: sessionDir })
      const tools = createTestTools(projectStore)
      const executor = createPascalCodeExecutor(tools)

      const events: AgentSessionEvent[] = []
      const onEvent = mock(((_projectId: ProjectId, event: AgentSessionEvent) => {
        events.push(event)
      }) as (projectId: ProjectId, event: AgentSessionEvent) => void)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        executor,
        onEvent,
      })

      // Create a project so we have a valid ID
      const project = await projectStore.createProject({ name: 'Status Test' })

      // Send a message through the full lifecycle
      await manager.sendMessage(project.projectId, 'Add a wall to the scene')

      // Extract status-changed events in order
      const statusEvents = events
        .filter((e): e is Extract<AgentSessionEvent, { type: 'status-changed' }> => e.type === 'status-changed')
        .map((e) => e.status)

      // The lifecycle must walk through: reading -> planning -> applying -> completed
      expect(statusEvents).toEqual(['reading', 'planning', 'applying', 'completed'])

      // onEvent should have been called multiple times
      expect(onEvent).toHaveBeenCalled()

      // Verify we also got message-added events (user + agent)
      const messageEvents = events.filter((e) => e.type === 'message-added')
      expect(messageEvents.length).toBeGreaterThanOrEqual(2)

      // Verify we got a turn-completed event
      const turnCompletedEvents = events.filter((e) => e.type === 'turn-completed')
      expect(turnCompletedEvents.length).toBe(1)
    } finally {
      await rm(projectDir, { force: true, recursive: true })
      await rm(sessionDir, { force: true, recursive: true })
    }
  })

  test('sendMessage persists session with user and agent messages', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'pascal-sm-persist-'))
    const sessionDir = await mkdtemp(join(tmpdir(), 'pascal-sm-session-'))

    try {
      const projectStore = createProjectStore({ rootDir: projectDir })
      const sessionStore = createAgentSessionStore({ rootDir: sessionDir })
      const tools = createTestTools(projectStore)
      const executor = createPascalCodeExecutor(tools)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        executor,
      })

      const project = await projectStore.createProject({ name: 'Persist Test' })

      // Send a message
      await manager.sendMessage(project.projectId, 'Show me the current layout')

      // Retrieve the session again and verify persistence
      const session = await manager.getSession(project.projectId)

      // Should have both user and agent messages
      expect(session.messages.length).toBe(2)

      const userMessage = session.messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage!.content).toBe('Show me the current layout')

      const agentMessage = session.messages.find((m) => m.role === 'agent')
      expect(agentMessage).toBeDefined()
      expect(agentMessage!.content.length).toBeGreaterThan(0)

      // Session status should be 'completed' after a successful turn
      expect(session.status).toBe('completed')

      // Verify timestamps are ISO strings
      expect(userMessage!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(agentMessage!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      // Verify lastTurnResult is persisted
      expect(session.lastTurnResult).not.toBeNull()
      expect(session.lastTurnResult!.status).toBe('completed')
    } finally {
      await rm(projectDir, { force: true, recursive: true })
      await rm(sessionDir, { force: true, recursive: true })
    }
  })

  test('sendMessage returns a completed turn result', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'pascal-sm-result-'))
    const sessionDir = await mkdtemp(join(tmpdir(), 'pascal-sm-session-'))

    try {
      const projectStore = createProjectStore({ rootDir: projectDir })
      const sessionStore = createAgentSessionStore({ rootDir: sessionDir })
      const tools = createTestTools(projectStore)
      const executor = createPascalCodeExecutor(tools)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        executor,
      })

      const project = await projectStore.createProject({ name: 'Result Test' })

      const result = await manager.sendMessage(project.projectId, 'Read the project')

      // Verify result structure
      expect(result.status).toBe('completed')
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
      expect(Array.isArray(result.executionLog)).toBe(true)
      expect(typeof result.sceneCommandsApplied).toBe('number')
      expect(result.error).toBeUndefined()
    } finally {
      await rm(projectDir, { force: true, recursive: true })
      await rm(sessionDir, { force: true, recursive: true })
    }
  })

  test('getSession returns an idle session for a new project', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'pascal-sm-idle-'))
    const sessionDir = await mkdtemp(join(tmpdir(), 'pascal-sm-session-'))

    try {
      const projectStore = createProjectStore({ rootDir: projectDir })
      const sessionStore = createAgentSessionStore({ rootDir: sessionDir })
      const tools = createTestTools(projectStore)
      const executor = createPascalCodeExecutor(tools)

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        executor,
      })

      const project = await projectStore.createProject({ name: 'Idle Test' })

      // Get session without sending anything
      const session = await manager.getSession(project.projectId)

      expect(session.status).toBe('idle')
      expect(session.messages).toEqual([])
      expect(session.lastTurnResult).toBeNull()
      expect(session.projectId).toBe(project.projectId)
      expect(session.sessionId).toMatch(/^session_/)
      expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(session.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    } finally {
      await rm(projectDir, { force: true, recursive: true })
      await rm(sessionDir, { force: true, recursive: true })
    }
  })

  test('sendMessage returns error for unknown project', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'pascal-sm-err-'))
    const sessionDir = await mkdtemp(join(tmpdir(), 'pascal-sm-session-'))

    try {
      const projectStore = createProjectStore({ rootDir: projectDir })
      const sessionStore = createAgentSessionStore({ rootDir: sessionDir })
      const tools = createTestTools(projectStore)
      const executor = createPascalCodeExecutor(tools)

      const events: AgentSessionEvent[] = []
      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        executor,
        onEvent: (_projectId, event) => {
          events.push(event)
        },
      })

      const fakeProjectId = 'project_nonexistent000000000000' as ProjectId

      // sendMessage for a project that doesn't exist should return error, not throw
      const result = await manager.sendMessage(fakeProjectId, 'Do something')

      expect(result.status).toBe('error')
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)

      // Session should be in error state
      const session = await manager.getSession(fakeProjectId)
      expect(session.status).toBe('error')

      // Should have both user and agent (error summary) messages
      expect(session.messages.length).toBe(2)
      expect(session.messages[0]!.role).toBe('user')
      expect(session.messages[1]!.role).toBe('agent')

      // Status events should end with 'error'
      const statusEvents = events
        .filter((e): e is Extract<AgentSessionEvent, { type: 'status-changed' }> => e.type === 'status-changed')
        .map((e) => e.status)

      // The error happens at step 3 (openProjectById fails), so we get: reading -> error
      expect(statusEvents[0]).toBe('reading')
      expect(statusEvents[statusEvents.length - 1]).toBe('error')

      // Should have a turn-completed event
      const turnCompleted = events.find((e) => e.type === 'turn-completed')
      expect(turnCompleted).toBeDefined()
    } finally {
      await rm(projectDir, { force: true, recursive: true })
      await rm(sessionDir, { force: true, recursive: true })
    }
  })
})
