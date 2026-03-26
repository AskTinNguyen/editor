import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BuildingNode,
  LevelNode,
  SiteNode,
  WallNode,
  type SceneCommand,
} from '@pascal/scene-engine'
import { createProjectStore } from './project-store'
import { applyProjectSceneCommands } from './project-command-service'

describe('applyProjectSceneCommands', () => {
  test('create-node batch command persists to disk', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-cmd-svc-'))

    try {
      const store = createProjectStore({ rootDir })
      const project = await store.createProject({ name: 'Command Test' })

      // Get the initial scene to find the level node id
      const opened = await store.openProjectById(project.projectId)
      const levelId = Object.values(opened.scene.nodes).find(
        (n) => (n as { type: string }).type === 'level',
      )!.id as string

      // Create two walls via batch
      const wall1 = WallNode.parse({ id: 'wall_cmd_1', start: [0, 0], end: [5, 0], children: [] })
      const wall2 = WallNode.parse({ id: 'wall_cmd_2', start: [5, 0], end: [10, 0], children: [] })

      const commands: SceneCommand[] = [
        { type: 'create-node', node: wall1, parentId: levelId },
        { type: 'create-node', node: wall2, parentId: levelId },
      ]

      const result = await applyProjectSceneCommands(store, project.projectId, commands)
      expect(result.status).toBe('ok')

      // Reopen the project from disk and verify new nodes exist
      const reopened = await store.openProjectById(project.projectId)
      expect(reopened.scene.nodes['wall_cmd_1']).toBeDefined()
      expect(reopened.scene.nodes['wall_cmd_2']).toBeDefined()

      // Verify the walls are children of the level
      const level = reopened.scene.nodes[levelId] as { children: string[] }
      expect(level.children).toContain('wall_cmd_1')
      expect(level.children).toContain('wall_cmd_2')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('reopened project sees the new scene after commands applied', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-cmd-svc-'))

    try {
      const store = createProjectStore({ rootDir })
      const project = await store.createProject({ name: 'Reopen Test' })

      // Snapshot the initial scene
      const before = await store.openProjectById(project.projectId)
      const initialNodeCount = Object.keys(before.scene.nodes).length

      const levelId = Object.values(before.scene.nodes).find(
        (n) => (n as { type: string }).type === 'level',
      )!.id as string

      const wall = WallNode.parse({ id: 'wall_reopen_1', start: [0, 0], end: [3, 0], children: [] })
      const commands: SceneCommand[] = [
        { type: 'create-node', node: wall, parentId: levelId },
      ]

      await applyProjectSceneCommands(store, project.projectId, commands)

      // Reopen and verify the scene changed
      const after = await store.openProjectById(project.projectId)
      const afterNodeCount = Object.keys(after.scene.nodes).length

      expect(afterNodeCount).toBe(initialNodeCount + 1)
      expect(after.scene.nodes['wall_reopen_1']).toBeDefined()
      expect((after.scene.nodes['wall_reopen_1'] as { parentId: string }).parentId).toBe(levelId)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('invalid commands do not write the file', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-cmd-svc-'))

    try {
      const store = createProjectStore({ rootDir })
      const project = await store.createProject({ name: 'Invalid Cmd Test' })

      // Snapshot the initial scene
      const before = await store.openProjectById(project.projectId)

      // Attempt to create a node with a nonexistent parent — should fail
      const wall = WallNode.parse({ id: 'wall_invalid_1', start: [0, 0], end: [3, 0], children: [] })
      const commands: SceneCommand[] = [
        { type: 'create-node', node: wall, parentId: 'nonexistent_parent' },
      ]

      const result = await applyProjectSceneCommands(store, project.projectId, commands)
      expect(result.status).toBe('error')

      // Reopen the project and verify the scene is unchanged
      const after = await store.openProjectById(project.projectId)
      expect(Object.keys(after.scene.nodes)).toEqual(Object.keys(before.scene.nodes))
      expect(after.scene.nodes['wall_invalid_1']).toBeUndefined()
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
