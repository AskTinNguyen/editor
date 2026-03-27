import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectStore } from '../projects/project-store'
import { applyProjectSceneCommands } from '../projects/project-command-service'
import { createStubAgentProvider } from './stub-agent-provider'
import type { PascalToolCallHandler } from './agent-provider'
import type { ProjectId } from '../../shared/projects'

describe('agent e2e', () => {
  function createTestToolHandler(
    projectStore: ReturnType<typeof createProjectStore>,
  ): PascalToolCallHandler {
    return {
      project_read: async (pid: ProjectId) => {
        const p = await projectStore.openProjectById(pid)
        return { name: p.name, scene: p.scene }
      },
      scene_read: async (pid: ProjectId) => {
        const p = await projectStore.openProjectById(pid)
        return p.scene
      },
      scene_applyCommands: async (payload) => {
        return applyProjectSceneCommands(projectStore, payload.projectId, payload.commands)
      },
    }
  }

  test('stub provider creates a wall that persists to disk', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-e2e-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const project = await projectStore.createProject({ name: 'E2E Test' })

      const opened = await projectStore.openProjectById(project.projectId)
      const levelNode = Object.values(opened.scene.nodes).find(
        (n) => (n as { type: string }).type === 'level',
      )
      expect(levelNode).toBeDefined()

      const toolHandler = createTestToolHandler(projectStore)
      const provider = createStubAgentProvider()

      const result = await provider.runTurn({
        projectId: project.projectId,
        prompt: 'Add a wall to the floor plan',
        sceneContext: opened.scene,
        messageHistory: [],
        tools: toolHandler,
      })

      expect(result.toolCallsExecuted).toBeGreaterThan(0)
      expect(result.response).toContain('wall')

      // Reopen and verify wall persisted
      const reopened = await projectStore.openProjectById(project.projectId)
      const wallNodes = Object.values(reopened.scene.nodes).filter(
        (n) => (n as { type: string }).type === 'wall',
      )
      expect(wallNodes.length).toBeGreaterThan(0)

      const initialNodeCount = Object.keys(opened.scene.nodes).length
      const finalNodeCount = Object.keys(reopened.scene.nodes).length
      expect(finalNodeCount).toBeGreaterThan(initialNodeCount)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('stub provider generates read-only response for non-wall prompts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-e2e-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const project = await projectStore.createProject({ name: 'Read Only Test' })
      const opened = await projectStore.openProjectById(project.projectId)

      const toolHandler = createTestToolHandler(projectStore)
      const provider = createStubAgentProvider()

      const result = await provider.runTurn({
        projectId: project.projectId,
        prompt: 'What is in this project?',
        sceneContext: opened.scene,
        messageHistory: [],
        tools: toolHandler,
      })

      expect(result.toolCallsExecuted).toBe(1) // project_read
      expect(result.response).toContain('Read Only Test')

      // Scene should be unchanged
      const reopened = await projectStore.openProjectById(project.projectId)
      expect(Object.keys(reopened.scene.nodes).length).toBe(
        Object.keys(opened.scene.nodes).length,
      )
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
