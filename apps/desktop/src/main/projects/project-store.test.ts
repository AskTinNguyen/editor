import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProjectStore } from './project-store'

const VALID_SCENE = {
  nodes: {
    site_1: {
      object: 'node' as const,
      id: 'site_1',
      type: 'site' as const,
      parentId: null,
      visible: true,
      metadata: {},
      polygon: {
        type: 'polygon' as const,
        points: [
          [-15, -15],
          [15, -15],
          [15, 15],
          [-15, 15],
        ],
      },
      children: [],
    },
  },
  rootNodeIds: ['site_1'],
}

describe('createProjectStore', () => {
  test('reopens a saved project file with the same scene document', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-project-store-'))

    try {
      const store = createProjectStore({ rootDir })
      const created = await store.createProject({ name: 'Test Project' })

      await store.saveProjectScene(created.projectId, VALID_SCENE)

      const reopened = await store.openProject(created.projectFilePath)

      expect(reopened.scene).toEqual(VALID_SCENE)
      expect(reopened.projectId).toBe(created.projectId)
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })

  test('rejects an invalid scene document before writing', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'pascal-project-store-'))

    try {
      const store = createProjectStore({ rootDir })
      const created = await store.createProject({ name: 'Broken Project' })

      await expect(
        store.saveProjectScene(created.projectId, {
          nodes: {
            wall_1: {
              id: 'wall_1',
              type: 'wall',
              start: [0, 0],
              end: [1],
            },
          },
          rootNodeIds: ['wall_1'],
        }),
      ).rejects.toThrow('Invalid scene document')
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
