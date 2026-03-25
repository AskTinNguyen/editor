import { describe, expect, test } from 'bun:test'
import { applySceneCommand } from './apply-scene-command'

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

describe('applySceneCommand', () => {
  test('replaces the scene document deterministically', () => {
    const first = applySceneCommand(null, {
      type: 'replace-scene-document',
      document: VALID_SCENE,
    })
    const second = applySceneCommand(null, {
      type: 'replace-scene-document',
      document: VALID_SCENE,
    })

    expect(first).toEqual(VALID_SCENE)
    expect(second).toEqual(VALID_SCENE)
  })

  test('clears the scene document without mutating the previous value', () => {
    const initialDocument = VALID_SCENE
    const nextDocument = applySceneCommand(initialDocument, {
      type: 'clear-scene-document',
    })

    expect(nextDocument).toBeNull()
    expect(initialDocument).toEqual(VALID_SCENE)
  })
})
