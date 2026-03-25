import { describe, expect, test } from 'bun:test'
import { BuildingNode, LevelNode } from '../schema'
import { parseSceneGraph } from './scene-graph'

describe('parseSceneGraph', () => {
  test('accepts a valid scene graph', () => {
    const level = LevelNode.parse({ id: 'level_1', children: [] })
    const building = BuildingNode.parse({
      id: 'building_1',
      children: [level.id],
    })
    const site = {
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
      children: [building.id],
    }

    const result = parseSceneGraph({
      nodes: {
        [site.id]: site,
        [building.id]: building,
        [level.id]: level,
      },
      rootNodeIds: [site.id],
    })

    expect(result).not.toBeNull()
    expect(result?.rootNodeIds).toEqual([site.id])
  })

  test('rejects a graph when a node key does not match the node id', () => {
    const site = {
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
    }

    const result = parseSceneGraph({
      nodes: {
        site_alias: site,
      },
      rootNodeIds: [site.id],
    })

    expect(result).toBeNull()
  })

  test('rejects a graph when a node payload is invalid', () => {
    const result = parseSceneGraph({
      nodes: {
        wall_1: {
          id: 'wall_1',
          type: 'wall',
          start: [0, 0],
          end: [1],
        },
      },
      rootNodeIds: ['wall_1'],
    })

    expect(result).toBeNull()
  })
})
