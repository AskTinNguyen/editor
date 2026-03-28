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
import type { PascalAgentEvent, createVesperBridge } from './vesper-bridge'

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

  test('sendMessage prefixes the runtime prompt without changing the saved user message', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      let capturedPrompt = ''
      const provider: PascalAgentProvider = {
        name: 'capture',
        async runTurn({ prompt }) {
          capturedPrompt = prompt
          return {
            response: 'Done.',
            toolCallsExecuted: 0,
          }
        },
      }

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Prefix Test' })
      await manager.sendMessage(project.projectId, 'Move this panel closer to the canvas', {
        agentContextPrefix: 'UI_INSPECTOR_CONTEXT\nselector: #panel',
      })

      expect(capturedPrompt).toContain('UI_INSPECTOR_CONTEXT')
      expect(capturedPrompt).toContain('Move this panel closer to the canvas')

      const session = await manager.getSession(project.projectId)
      expect(session.messages[0]?.content).toBe('Move this panel closer to the canvas')
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

// ---------------------------------------------------------------------------
// Mock bridge helper
// ---------------------------------------------------------------------------

function createMockBridge(events?: PascalAgentEvent[]): ReturnType<typeof createVesperBridge> {
  const defaultEvents: PascalAgentEvent[] = [
    { type: 'status', message: 'Thinking...' },
    { type: 'tool_start', toolName: 'scene_read', toolUseId: '1', input: { projectId: 'test' } },
    { type: 'tool_result', toolUseId: '1', result: '{}', isError: false },
    { type: 'text_complete', text: 'Read the project successfully.' },
    { type: 'complete', usage: { inputTokens: 100, outputTokens: 50 } },
  ]
  const eventsToYield = events ?? defaultEvents

  return {
    async *chat(_message: string, _options: any): AsyncGenerator<PascalAgentEvent> {
      for (const event of eventsToYield) {
        yield event
      }
    },
    resetConversation() {},
    getHistoryLength() {
      return 0
    },
  } as ReturnType<typeof createVesperBridge>
}

// ---------------------------------------------------------------------------
// Bridge integration tests
// ---------------------------------------------------------------------------

describe('AgentSessionManager bridge integration', () => {
  test('sendMessage with bridge uses async generator and tracks events', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-bridge-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const events: AgentSessionEvent[] = []
      const mockBridge = createMockBridge([
        { type: 'status', message: 'Thinking...' },
        {
          type: 'tool_start',
          toolName: 'scene_applyCommands',
          toolUseId: 'tu-1',
          input: {
            projectId: 'test',
            commands: [
              { type: 'create-node', node: { id: 'node-abc', type: 'wall' } },
              { type: 'update-node', nodeId: 'node-xyz' },
            ],
          },
        },
        { type: 'tool_result', toolUseId: 'tu-1', result: '{"status":"ok"}', isError: false },
        { type: 'text_complete', text: 'I created a wall and updated a node.' },
        { type: 'complete', usage: { inputTokens: 200, outputTokens: 100 } },
      ])

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        bridge: mockBridge,
        toolHandler,
        onEvent: (_projectId, event) => {
          events.push(event)
        },
      })

      const project = await projectStore.createProject({ name: 'Bridge Test' })
      const result = await manager.sendMessage(project.projectId, 'Create a wall')

      // Verify the turn result
      expect(result.status).toBe('completed')
      expect(result.summary).toBe('I created a wall and updated a node.')
      expect(result.affectedNodeIds).toContain('node-abc')
      expect(result.affectedNodeIds).toContain('node-xyz')
      expect(result.sceneCommandsApplied).toBe(1)
      expect(result.executionLog.length).toBe(2) // 1 tool-call + 1 tool-result

      // Verify execution log entries
      const toolCallEntries = result.executionLog.filter((e) => e.type === 'tool-call')
      expect(toolCallEntries.length).toBe(1)
      expect(toolCallEntries[0]!.tool).toBe('scene_applyCommands')

      const toolResultEntries = result.executionLog.filter((e) => e.type === 'tool-result')
      expect(toolResultEntries.length).toBe(1)

      // Verify events were emitted
      const statusEvents = events
        .filter((e): e is Extract<AgentSessionEvent, { type: 'status-changed' }> => e.type === 'status-changed')
        .map((e) => e.status)
      expect(statusEvents).toContain('reading')
      expect(statusEvents).toContain('applying')
      expect(statusEvents).toContain('completed')

      const executionLogEvents = events.filter((e) => e.type === 'execution-log')
      expect(executionLogEvents.length).toBe(1) // one tool_start event

      const turnCompletedEvents = events.filter((e) => e.type === 'turn-completed')
      expect(turnCompletedEvents.length).toBe(1)

      // Verify session persistence
      const session = await manager.getSession(project.projectId)
      expect(session.status).toBe('completed')
      expect(session.messages.length).toBe(2)
      expect(session.messages[0]!.role).toBe('user')
      expect(session.messages[1]!.role).toBe('agent')
      expect(session.lastTurnResult).not.toBeNull()
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage with bridge handles error events', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-bridge-err-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const mockBridge = createMockBridge([
        { type: 'status', message: 'Thinking...' },
        { type: 'error', message: 'API rate limit exceeded' },
      ])

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        bridge: mockBridge,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Bridge Error Test' })
      const result = await manager.sendMessage(project.projectId, 'Do something')

      expect(result.status).toBe('error')
      expect(result.error).toBe('API rate limit exceeded')

      const session = await manager.getSession(project.projectId)
      expect(session.status).toBe('error')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage with bridge accumulates text deltas', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-bridge-delta-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const mockBridge = createMockBridge([
        { type: 'status', message: 'Thinking...' },
        { type: 'text_delta', text: 'Hello ' },
        { type: 'text_delta', text: 'world' },
        { type: 'text_complete', text: 'Hello world' },
        { type: 'complete', usage: { inputTokens: 50, outputTokens: 20 } },
      ])

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        bridge: mockBridge,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Delta Test' })
      const result = await manager.sendMessage(project.projectId, 'Say hello')

      // text_complete overwrites accumulated deltas
      expect(result.summary).toBe('Hello world')
      expect(result.status).toBe('completed')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('sendMessage falls back to provider when bridge is undefined', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-fallback-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      // No bridge, just provider — same as the legacy path
      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: minimalProvider,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Fallback Test' })
      const result = await manager.sendMessage(project.projectId, 'Read the project')

      expect(result.status).toBe('completed')
      expect(result.summary).toContain('Fallback Test')
      expect(typeof result.sceneCommandsApplied).toBe('number')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('bridge path takes precedence over provider when both are supplied', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-sm-precedence-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const sessionStore = createAgentSessionStore({ rootDir })
      const toolHandler = createTestToolHandler(projectStore)

      const providerCalled = { value: false }
      const spyProvider: PascalAgentProvider = {
        name: 'spy-provider',
        async runTurn() {
          providerCalled.value = true
          return { response: 'from provider', toolCallsExecuted: 0 }
        },
      }

      const mockBridge = createMockBridge([
        { type: 'text_complete', text: 'from bridge' },
        { type: 'complete' },
      ])

      const manager = createAgentSessionManager({
        sessionStore,
        projectStore,
        provider: spyProvider,
        bridge: mockBridge,
        toolHandler,
      })

      const project = await projectStore.createProject({ name: 'Precedence Test' })
      const result = await manager.sendMessage(project.projectId, 'test')

      expect(result.summary).toBe('from bridge')
      expect(providerCalled.value).toBe(false)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
