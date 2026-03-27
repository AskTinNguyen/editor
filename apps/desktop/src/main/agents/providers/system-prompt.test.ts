import { describe, expect, test } from 'bun:test'
import { buildSystemPrompt } from './system-prompt'

// ---------------------------------------------------------------------------
// Test scene fixtures
// ---------------------------------------------------------------------------

function makeScene(
  nodes: Record<string, { type: string; [k: string]: unknown }> = {},
  rootNodeIds: string[] = [],
) {
  return { nodes, rootNodeIds }
}

const sampleScene = makeScene(
  {
    site_001: { type: 'site', id: 'site_001', parentId: null, children: ['building_001'] },
    building_001: {
      type: 'building',
      id: 'building_001',
      parentId: 'site_001',
      children: ['level_001'],
    },
    level_001: {
      type: 'level',
      id: 'level_001',
      parentId: 'building_001',
      children: ['wall_001', 'zone_001'],
    },
    wall_001: {
      type: 'wall',
      id: 'wall_001',
      parentId: 'level_001',
      start: [0, 0],
      end: [5, 0],
      children: [],
    },
    zone_001: {
      type: 'zone',
      id: 'zone_001',
      parentId: 'level_001',
      polygon: { type: 'polygon', points: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    },
    item_001: {
      type: 'item',
      id: 'item_001',
      parentId: 'level_001',
      position: [2.5, 0, 2],
      children: [],
    },
  },
  ['site_001'],
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  test('includes scene node count', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('6 nodes')
  })

  test('includes level node IDs', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('level_001')
  })

  test('includes wall schema example', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('type: "wall"')
    expect(prompt).toContain('start: [0, 0]')
    expect(prompt).toContain('end: [5, 0]')
    expect(prompt).toContain('thickness: 0.15')
    expect(prompt).toContain('height: 2.8')
  })

  test('includes zone schema example', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('type: "zone"')
    expect(prompt).toContain('polygon:')
  })

  test('includes item schema example', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('type: "item"')
    expect(prompt).toContain('position: [2.5, 0, 2]')
  })

  test('includes all four command types', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('create-node')
    expect(prompt).toContain('update-node')
    expect(prompt).toContain('move-node')
    expect(prompt).toContain('delete-node')
  })

  test('includes the important rules section', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('Important Rules')
    expect(prompt).toContain('Node IDs must use the correct prefix')
    expect(prompt).toContain('object: "node"')
    expect(prompt).toContain('Commands are validated atomically')
    expect(prompt).toContain('scene_read first')
  })

  test('includes scene graph structure explanation', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('Scene Graph Structure')
    expect(prompt).toContain('flat dictionary of nodes')
    expect(prompt).toContain('site → building → level')
  })

  test('includes available tools section', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).toContain('project_read')
    expect(prompt).toContain('scene_read')
    expect(prompt).toContain('scene_applyCommands')
  })

  test('includes node type counts in the scene summary', () => {
    const prompt = buildSystemPrompt(sampleScene)
    // Should list the types present
    expect(prompt).toContain('wall')
    expect(prompt).toContain('zone')
    expect(prompt).toContain('item')
    expect(prompt).toContain('site')
    expect(prompt).toContain('building')
    expect(prompt).toContain('level')
  })

  test('handles empty scene gracefully', () => {
    const emptyScene = makeScene({}, [])
    const prompt = buildSystemPrompt(emptyScene)
    expect(prompt).toContain('0 nodes')
    expect(prompt).not.toThrow
    // Should still include the schema examples and rules
    expect(prompt).toContain('Wall')
    expect(prompt).toContain('Important Rules')
    expect(prompt).toContain('Level nodes: (none)')
  })

  test('handles null/undefined scene gracefully', () => {
    const promptNull = buildSystemPrompt(null)
    expect(promptNull).toContain('0 nodes')
    expect(promptNull).toContain('Important Rules')

    const promptUndefined = buildSystemPrompt(undefined)
    expect(promptUndefined).toContain('0 nodes')
    expect(promptUndefined).toContain('Important Rules')
  })

  test('lists multiple level IDs when present', () => {
    const multiLevelScene = makeScene({
      level_001: { type: 'level', id: 'level_001', parentId: 'building_001' },
      level_002: { type: 'level', id: 'level_002', parentId: 'building_001' },
      wall_001: { type: 'wall', id: 'wall_001', parentId: 'level_001' },
    })
    const prompt = buildSystemPrompt(multiLevelScene)
    expect(prompt).toContain('level_001')
    expect(prompt).toContain('level_002')
  })
})
