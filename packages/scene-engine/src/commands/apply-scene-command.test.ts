import { describe, expect, test } from 'bun:test'
import { parseSceneGraph } from '../document/scene-graph'
import { BuildingNode, LevelNode, SiteNode, WallNode } from '../schema'
import { applySceneCommand } from './apply-scene-command'
import type { SceneCommand } from './scene-command'
import type { SceneCommandBatchResult } from './scene-command-result'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid scene with site -> building -> level hierarchy. */
function buildTestScene() {
  const level = LevelNode.parse({ id: 'level_1', level: 0, children: [] })
  const building = BuildingNode.parse({ id: 'building_1', children: [level.id] })
  const site = SiteNode.parse({ id: 'site_1', children: [building] })
  // SiteNode.parse produces inline children objects; for a flat graph we
  // need string IDs in children and all nodes stored at top level.
  const flatSite = { ...site, children: [building.id] }
  const graph = parseSceneGraph({
    nodes: {
      [flatSite.id]: flatSite,
      [building.id]: { ...building, parentId: flatSite.id },
      [level.id]: { ...level, parentId: building.id },
    },
    rootNodeIds: [flatSite.id],
  })
  if (!graph) throw new Error('Failed to build test scene graph')
  return graph
}

function buildWall(overrides: Record<string, unknown> = {}) {
  return WallNode.parse({
    id: 'wall_1',
    start: [0, 0],
    end: [5, 0],
    children: [],
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Legacy tests — document-level commands (adapted to new return type)
// ---------------------------------------------------------------------------

const VALID_SCENE = buildTestScene()

describe('applySceneCommand — document-level', () => {
  test('replaces the scene document deterministically', () => {
    const first = applySceneCommand(null, {
      type: 'replace-scene-document',
      document: VALID_SCENE,
    })
    const second = applySceneCommand(null, {
      type: 'replace-scene-document',
      document: VALID_SCENE,
    })

    expect(first.result.status).toBe('ok')
    expect(first.document).toEqual(VALID_SCENE)
    expect(second.document).toEqual(VALID_SCENE)
  })

  test('clears the scene document without mutating the previous value', () => {
    const initialDocument = VALID_SCENE
    const output = applySceneCommand(initialDocument, {
      type: 'clear-scene-document',
    })

    expect(output.document).toBeNull()
    expect(output.result.status).toBe('ok')
    expect(initialDocument).toEqual(VALID_SCENE) // not mutated
  })
})

// ---------------------------------------------------------------------------
// create-node
// ---------------------------------------------------------------------------

describe('applySceneCommand — create-node', () => {
  test('creates a node and adds it to the parent children', () => {
    const scene = buildTestScene()
    const wall = buildWall()

    const output = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    expect(output.result.status).toBe('ok')
    expect(output.document).not.toBeNull()
    const doc = output.document!
    expect(doc.nodes[wall.id]).toBeDefined()
    expect(doc.nodes[wall.id].parentId).toBe('level_1')

    // Parent's children should include the wall
    const level = doc.nodes['level_1'] as { children: string[] }
    expect(level.children).toContain(wall.id)
  })

  test('does not mutate the original document', () => {
    const scene = buildTestScene()
    const originalNodes = { ...scene.nodes }
    const wall = buildWall()

    applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    // Original document unchanged
    expect(scene.nodes).toEqual(originalNodes)
  })

  test('errors when node id already exists', () => {
    const scene = buildTestScene()
    const wall = buildWall()

    // First create succeeds
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    // Second create with same id should fail
    const output = applySceneCommand(doc!, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toEqual(doc)
  })

  test('errors when parent does not exist', () => {
    const scene = buildTestScene()
    const wall = buildWall()

    const output = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'nonexistent_parent',
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toEqual(scene)
  })

  test('errors when document is null', () => {
    const wall = buildWall()

    const output = applySceneCommand(null, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// update-node
// ---------------------------------------------------------------------------

describe('applySceneCommand — update-node', () => {
  test('updates allowed properties on a node', () => {
    const scene = buildTestScene()
    // First create a wall to update
    const wall = buildWall()
    const afterCreate = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })
    expect(afterCreate.result.status).toBe('ok')
    const doc = afterCreate.document!

    const output = applySceneCommand(doc, {
      type: 'update-node',
      nodeId: wall.id,
      patch: { start: [1, 1], end: [6, 1], visible: false },
    })

    expect(output.result.status).toBe('ok')
    const updatedWall = output.document!.nodes[wall.id] as { start: [number, number]; end: [number, number]; visible: boolean }
    expect(updatedWall.start).toEqual([1, 1])
    expect(updatedWall.end).toEqual([6, 1])
    expect(updatedWall.visible).toBe(false)
  })

  test('forbids updating id via patch', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'update-node',
      nodeId: wall.id,
      // biome-ignore lint/suspicious/noExplicitAny: testing forbidden field
      patch: { id: 'wall_hacked' } as any,
    })

    expect(output.result.status).toBe('error')
    if (output.result.status === 'error') {
      expect(output.result.error).toContain('id')
    }
  })

  test('forbids updating type via patch', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'update-node',
      nodeId: wall.id,
      // biome-ignore lint/suspicious/noExplicitAny: testing forbidden field
      patch: { type: 'item' } as any,
    })

    expect(output.result.status).toBe('error')
    if (output.result.status === 'error') {
      expect(output.result.error).toContain('type')
    }
  })

  test('forbids updating parentId via patch', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'update-node',
      nodeId: wall.id,
      // biome-ignore lint/suspicious/noExplicitAny: testing forbidden field
      patch: { parentId: 'building_1' } as any,
    })

    expect(output.result.status).toBe('error')
    if (output.result.status === 'error') {
      expect(output.result.error).toContain('parentId')
    }
  })

  test('forbids updating children via patch', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'update-node',
      nodeId: wall.id,
      // biome-ignore lint/suspicious/noExplicitAny: testing forbidden field
      patch: { children: ['item_fake'] } as any,
    })

    expect(output.result.status).toBe('error')
    if (output.result.status === 'error') {
      expect(output.result.error).toContain('children')
    }
  })

  test('errors when node does not exist', () => {
    const scene = buildTestScene()

    const output = applySceneCommand(scene, {
      type: 'update-node',
      nodeId: 'nonexistent_99',
      patch: { visible: false },
    })

    expect(output.result.status).toBe('error')
  })

  test('errors when document is null', () => {
    const output = applySceneCommand(null, {
      type: 'update-node',
      nodeId: 'wall_1',
      patch: { visible: false },
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// move-node
// ---------------------------------------------------------------------------

describe('applySceneCommand — move-node', () => {
  test('moves a node to a new parent', () => {
    const scene = buildTestScene()
    // Create a second level under the same building
    const level2 = LevelNode.parse({ id: 'level_2', level: 1, children: [] })
    const { document: doc1 } = applySceneCommand(scene, {
      type: 'create-node',
      node: level2,
      parentId: 'building_1',
    })

    // Create a wall under level_1
    const wall = buildWall()
    const { document: doc2 } = applySceneCommand(doc1!, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    // Move wall from level_1 to level_2
    const output = applySceneCommand(doc2!, {
      type: 'move-node',
      nodeId: wall.id,
      newParentId: 'level_2',
    })

    expect(output.result.status).toBe('ok')
    const doc = output.document!

    // Wall's parentId updated
    expect(doc.nodes[wall.id].parentId).toBe('level_2')

    // Old parent no longer has the wall
    const level1 = doc.nodes['level_1'] as { children: string[] }
    expect(level1.children).not.toContain(wall.id)

    // New parent has the wall
    const lev2 = doc.nodes['level_2'] as { children: string[] }
    expect(lev2.children).toContain(wall.id)
  })

  test('moving to same parent is a no-op', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'move-node',
      nodeId: wall.id,
      newParentId: 'level_1',
    })

    expect(output.result.status).toBe('ok')
    expect(output.document).toBe(doc) // same reference — true no-op
  })

  test('errors when node does not exist', () => {
    const scene = buildTestScene()

    const output = applySceneCommand(scene, {
      type: 'move-node',
      nodeId: 'nonexistent_wall',
      newParentId: 'level_1',
    })

    expect(output.result.status).toBe('error')
  })

  test('errors when new parent does not exist', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'move-node',
      nodeId: wall.id,
      newParentId: 'nonexistent_level',
    })

    expect(output.result.status).toBe('error')
  })

  test('errors when document is null', () => {
    const output = applySceneCommand(null, {
      type: 'move-node',
      nodeId: 'wall_1',
      newParentId: 'level_1',
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// delete-node
// ---------------------------------------------------------------------------

describe('applySceneCommand — delete-node', () => {
  test('deletes a node and removes it from parent children', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    const output = applySceneCommand(doc!, {
      type: 'delete-node',
      nodeId: wall.id,
    })

    expect(output.result.status).toBe('ok')
    const resultDoc = output.document!
    expect(resultDoc.nodes[wall.id]).toBeUndefined()

    const level = resultDoc.nodes['level_1'] as { children: string[] }
    expect(level.children).not.toContain(wall.id)
  })

  test('does not mutate the original document', () => {
    const scene = buildTestScene()
    const wall = buildWall()
    const { document: doc } = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })
    const originalDoc = doc!
    const originalNodeIds = Object.keys(originalDoc.nodes)

    applySceneCommand(originalDoc, {
      type: 'delete-node',
      nodeId: wall.id,
    })

    // Original still has the wall
    expect(Object.keys(originalDoc.nodes)).toEqual(originalNodeIds)
  })

  test('errors when node does not exist', () => {
    const scene = buildTestScene()

    const output = applySceneCommand(scene, {
      type: 'delete-node',
      nodeId: 'nonexistent_node',
    })

    expect(output.result.status).toBe('error')
  })

  test('errors when document is null', () => {
    const output = applySceneCommand(null, {
      type: 'delete-node',
      nodeId: 'wall_1',
    })

    expect(output.result.status).toBe('error')
    expect(output.document).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// batch-commands
// ---------------------------------------------------------------------------

describe('applySceneCommand — batch-commands', () => {
  test('applies multiple commands in sequence', () => {
    const scene = buildTestScene()
    const wall1 = buildWall({ id: 'wall_1' })
    const wall2 = buildWall({ id: 'wall_2', start: [5, 0], end: [10, 0] })

    const output = applySceneCommand(scene, {
      type: 'batch-commands',
      commands: [
        { type: 'create-node', node: wall1, parentId: 'level_1' },
        { type: 'create-node', node: wall2, parentId: 'level_1' },
      ],
    })

    expect(output.result.status).toBe('ok')
    const batchResult = output.result as SceneCommandBatchResult
    expect(batchResult.results).toHaveLength(2)
    expect(batchResult.results.every((r) => r.status === 'ok')).toBe(true)

    const doc = output.document!
    expect(doc.nodes['wall_1']).toBeDefined()
    expect(doc.nodes['wall_2']).toBeDefined()

    const level = doc.nodes['level_1'] as { children: string[] }
    expect(level.children).toContain('wall_1')
    expect(level.children).toContain('wall_2')
  })

  test('rolls back on first error in batch', () => {
    const scene = buildTestScene()
    const wall1 = buildWall({ id: 'wall_1' })

    const output = applySceneCommand(scene, {
      type: 'batch-commands',
      commands: [
        { type: 'create-node', node: wall1, parentId: 'level_1' },
        // This should fail — duplicate id
        { type: 'create-node', node: wall1, parentId: 'level_1' },
      ],
    })

    expect(output.result.status).toBe('error')
    // Rolled back to original
    expect(output.document).toEqual(scene)

    const batchResult = output.result as SceneCommandBatchResult
    expect(batchResult.results[0].status).toBe('ok')
    expect(batchResult.results[1].status).toBe('error')
  })

  test('empty batch is a no-op', () => {
    const scene = buildTestScene()

    const output = applySceneCommand(scene, {
      type: 'batch-commands',
      commands: [],
    })

    expect(output.result.status).toBe('ok')
    expect(output.document).toBe(scene)
  })

  test('batch with create + update + delete', () => {
    const scene = buildTestScene()
    const wall = buildWall()

    const commands: SceneCommand[] = [
      { type: 'create-node', node: wall, parentId: 'level_1' },
      { type: 'update-node', nodeId: wall.id, patch: { visible: false } },
      { type: 'delete-node', nodeId: wall.id },
    ]

    const output = applySceneCommand(scene, {
      type: 'batch-commands',
      commands,
    })

    expect(output.result.status).toBe('ok')
    // Wall was created, updated, then deleted — should be gone
    expect(output.document!.nodes[wall.id]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Graph integrity validation
// ---------------------------------------------------------------------------

describe('applySceneCommand — graph integrity', () => {
  test('create-node validates the resulting graph', () => {
    // Build a scene where the integrity check is meaningful
    const scene = buildTestScene()
    const wall = buildWall()

    // Normal create should pass integrity
    const output = applySceneCommand(scene, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })
    expect(output.result.status).toBe('ok')
  })

  test('move-node validates the resulting graph', () => {
    const scene = buildTestScene()
    const level2 = LevelNode.parse({ id: 'level_2', level: 1, children: [] })
    const { document: doc1 } = applySceneCommand(scene, {
      type: 'create-node',
      node: level2,
      parentId: 'building_1',
    })

    const wall = buildWall()
    const { document: doc2 } = applySceneCommand(doc1!, {
      type: 'create-node',
      node: wall,
      parentId: 'level_1',
    })

    // Valid move
    const output = applySceneCommand(doc2!, {
      type: 'move-node',
      nodeId: wall.id,
      newParentId: 'level_2',
    })
    expect(output.result.status).toBe('ok')
  })
})
