import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectStore } from '../projects/project-store'
import { applyProjectSceneCommands } from '../projects/project-command-service'
import { createPascalCodeExecutor } from './pascal-code-executor'
import { createStubAgentProvider } from './stub-agent-provider'
import type { ProjectId } from '../../shared/projects'

describe('agent e2e', () => {
  test('stub provider generates wall-creation code that persists to disk', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-e2e-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const project = await projectStore.createProject({ name: 'E2E Test' })

      // Get the scene to find the level node
      const opened = await projectStore.openProjectById(project.projectId)
      const levelNode = Object.values(opened.scene.nodes).find(
        (n) => (n as { type: string }).type === 'level',
      )
      expect(levelNode).toBeDefined()

      // Create executor with real tools
      const executor = createPascalCodeExecutor({
        project_read: async (pid: ProjectId) => {
          const p = await projectStore.openProjectById(pid)
          return { name: p.name, scene: p.scene }
        },
        scene_read: async (pid: ProjectId) => {
          const p = await projectStore.openProjectById(pid)
          return p.scene
        },
        scene_applyCommands: async (payload) => {
          return applyProjectSceneCommands(
            projectStore,
            payload.projectId,
            payload.commands,
          )
        },
      })

      // Generate code using stub provider
      const provider = createStubAgentProvider()
      const code = await provider.generateCode({
        projectId: project.projectId,
        prompt: 'Add a wall to the floor plan',
        sceneContext: opened.scene,
      })

      // Execute the generated code
      const execResult = await executor.execute({
        code,
        projectId: project.projectId,
        timeoutMs: 10000,
      })

      expect(execResult.status).toBe('completed')

      // Verify scene commands were applied (check for tool-call logs)
      const applyLogs = execResult.logs.filter(
        (l) => l.type === 'tool-call' && l.tool === 'scene_applyCommands',
      )
      expect(applyLogs.length).toBeGreaterThan(0)

      // Reopen the project and verify the wall was persisted
      const reopened = await projectStore.openProjectById(project.projectId)
      const wallNodes = Object.values(reopened.scene.nodes).filter(
        (n) => (n as { type: string }).type === 'wall',
      )
      expect(wallNodes.length).toBeGreaterThan(0)

      // Verify the initial node count increased
      const initialNodeCount = Object.keys(opened.scene.nodes).length
      const finalNodeCount = Object.keys(reopened.scene.nodes).length
      expect(finalNodeCount).toBeGreaterThan(initialNodeCount)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('stub provider generates read-only code for non-wall prompts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-e2e-'))

    try {
      const projectStore = createProjectStore({ rootDir })
      const project = await projectStore.createProject({ name: 'Read Only Test' })
      const opened = await projectStore.openProjectById(project.projectId)

      const executor = createPascalCodeExecutor({
        project_read: async (pid: ProjectId) => {
          const p = await projectStore.openProjectById(pid)
          return { name: p.name, scene: p.scene }
        },
        scene_read: async (pid: ProjectId) => {
          const p = await projectStore.openProjectById(pid)
          return p.scene
        },
        scene_applyCommands: async (payload) => {
          return applyProjectSceneCommands(
            projectStore,
            payload.projectId,
            payload.commands,
          )
        },
      })

      const provider = createStubAgentProvider()
      const code = await provider.generateCode({
        projectId: project.projectId,
        prompt: 'What is in this project?',
        sceneContext: opened.scene,
      })

      const execResult = await executor.execute({
        code,
        projectId: project.projectId,
        timeoutMs: 10000,
      })

      expect(execResult.status).toBe('completed')

      // No scene commands should have been applied
      const applyLogs = execResult.logs.filter(
        (l) => l.type === 'tool-call' && l.tool === 'scene_applyCommands',
      )
      expect(applyLogs.length).toBe(0)

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
