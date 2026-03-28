import { describe, expect, test } from 'bun:test'
import { ALL_NODE_TYPES, buildSystemPrompt } from './system-prompt'

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
      name: 'Living Room',
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
    expect(prompt).toContain('Node IDs must use the format')
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
    expect(prompt).toContain('wall (parent: level)')
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

  test('includes selection context section when selection is provided', () => {
    const prompt = buildSystemPrompt(sampleScene, {
      selectedNodeIds: ['wall_001', 'zone_001'],
      selectedNodeTypes: ['wall', 'zone'],
    })
    expect(prompt).toContain('## Current Selection')
    expect(prompt).toContain('2 node(s)')
    expect(prompt).toContain('wall_001')
    expect(prompt).toContain('zone_001')
    expect(prompt).toContain('types: wall, zone')
    expect(prompt).toContain('When the user refers to "this", "the selected", or "it"')
  })

  test('omits selection section when no selection is provided', () => {
    const prompt = buildSystemPrompt(sampleScene)
    expect(prompt).not.toContain('## Current Selection')
  })

  test('omits selection section when selection has empty node IDs', () => {
    const prompt = buildSystemPrompt(sampleScene, {
      selectedNodeIds: [],
      selectedNodeTypes: [],
    })
    expect(prompt).not.toContain('## Current Selection')
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

  // -----------------------------------------------------------------------
  // New tests — all 14 node types documented
  // -----------------------------------------------------------------------

  test('documents all 14 node types in the schema reference', () => {
    const prompt = buildSystemPrompt(null)
    for (const nodeType of ALL_NODE_TYPES) {
      expect(prompt).toContain(`### ${nodeType}`)
    }
  })

  test('ALL_NODE_TYPES contains exactly 14 types', () => {
    expect(ALL_NODE_TYPES.length).toBe(14)
  })

  test('includes door example with wallId', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('type: "door"')
    expect(prompt).toContain('wallId: "wall_001"')
  })

  test('includes window example with wallId', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('type: "window"')
    expect(prompt).toContain('wallId: "wall_001"')
  })

  test('includes roof-segment schema', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('roof-segment')
    expect(prompt).toContain('roofType')
    expect(prompt).toContain('"gable"')
  })

  test('includes guide and scan schemas', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('### guide')
    expect(prompt).toContain('### scan')
    expect(prompt).toContain('url: string')
  })

  test('includes ceiling schema', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('### ceiling')
    expect(prompt).toContain('height: 2.5')
  })

  test('includes slab schema', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('### slab')
    expect(prompt).toContain('elevation')
  })

  // -----------------------------------------------------------------------
  // New tests — compact scene dump
  // -----------------------------------------------------------------------

  test('includes compact scene dump when scene has nodes', () => {
    const prompt = buildSystemPrompt(sampleScene)
    // Should contain a JSON code block with the compact dump
    expect(prompt).toContain('```json')
    expect(prompt).toContain('"type": "wall"')
    expect(prompt).toContain('"type": "zone"')
  })

  test('compact scene dump includes key fields per type', () => {
    const sceneWithDetails = makeScene({
      level_001: { type: 'level', id: 'level_001', parentId: 'building_001', level: 0 },
      wall_001: {
        type: 'wall',
        id: 'wall_001',
        parentId: 'level_001',
        start: [0, 0],
        end: [5, 0],
        thickness: 0.15,
      },
      door_001: {
        type: 'door',
        id: 'door_001',
        parentId: 'wall_001',
        wallId: 'wall_001',
        width: 0.9,
        height: 2.1,
      },
      zone_001: {
        type: 'zone',
        id: 'zone_001',
        parentId: 'level_001',
        name: 'Kitchen',
        polygon: [[0, 0], [3, 0], [3, 3], [0, 3]],
      },
    })
    const prompt = buildSystemPrompt(sceneWithDetails)
    // Wall fields
    expect(prompt).toContain('"start"')
    expect(prompt).toContain('"end"')
    // Door fields
    expect(prompt).toContain('"wallId": "wall_001"')
    expect(prompt).toContain('"width": 0.9')
    // Zone fields
    expect(prompt).toContain('"name": "Kitchen"')
  })

  test('does not include scene dump for empty scene', () => {
    const prompt = buildSystemPrompt(makeScene({}, []))
    // Should not have a JSON code block for the dump
    expect(prompt).not.toContain('```json\n[')
  })

  test('caps scene dump at 50 nodes', () => {
    // Create a scene with 60 nodes
    const nodes: Record<string, { type: string; id: string; parentId: string }> = {}
    for (let i = 0; i < 60; i++) {
      const id = `wall_${String(i).padStart(3, '0')}`
      nodes[id] = { type: 'wall', id, parentId: 'level_001' }
    }
    const largeScene = makeScene(nodes, ['site_001'])
    const prompt = buildSystemPrompt(largeScene)

    // Should mention truncation
    expect(prompt).toContain('first 50 of 60 nodes')

    // Count how many wall entries appear in the JSON dump
    const dumpMatch = prompt.match(/```json\n([\s\S]*?)\n```/)
    expect(dumpMatch).not.toBeNull()
    const dumpArray = JSON.parse(dumpMatch![1]) as unknown[]
    expect(dumpArray.length).toBe(50)
  })

  // -----------------------------------------------------------------------
  // New tests — door/window wallId rule
  // -----------------------------------------------------------------------

  test('rules mention setting BOTH parentId AND wallId for doors/windows', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('set BOTH parentId AND wallId')
  })

  // -----------------------------------------------------------------------
  // New tests — room creation guidance
  // -----------------------------------------------------------------------

  test('rules include guidance for creating rooms', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('4 walls, a slab, a ceiling, and a zone')
  })

  // -----------------------------------------------------------------------
  // New tests — command details
  // -----------------------------------------------------------------------

  test('explains that commands execute in order', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('Commands is an array and they execute in order')
  })

  test('explains parentId in command vs node', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('parentId in the command is what matters')
  })

  // -----------------------------------------------------------------------
  // New tests — coordinates
  // -----------------------------------------------------------------------

  test('mentions coordinates are in meters on XZ plane', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('meters')
    expect(prompt).toContain('XZ plane')
    expect(prompt).toContain('Y is up')
  })

  // -----------------------------------------------------------------------
  // New tests — asset catalog
  // -----------------------------------------------------------------------

  test('includes asset catalog section', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('Available Assets')
    expect(prompt).toContain('Asset categories:')
    expect(prompt).toContain('furniture')
    expect(prompt).toContain('kitchen')
    expect(prompt).toContain('bathroom')
    expect(prompt).toContain('appliance')
    expect(prompt).toContain('outdoor')
  })

  test('lists at least 20 asset IDs in the catalog', () => {
    const prompt = buildSystemPrompt(null)
    const assetIds = [
      'sofa', 'dining-table', 'dining-chair', 'office-chair', 'office-table',
      'single-bed', 'double-bed', 'bookshelf', 'closet', 'coffee-table',
      'tv-stand', 'floor-lamp', 'ceiling-lamp', 'fridge', 'stove',
      'toilet', 'bathtub', 'bathroom-sink', 'television', 'tree',
      'bush', 'palm', 'washing-machine', 'shower-square',
    ]
    let count = 0
    for (const id of assetIds) {
      if (prompt.includes(`- ${id}:`)) {
        count++
      }
    }
    expect(count).toBeGreaterThanOrEqual(20)
  })

  test('includes asset dimensions in catalog', () => {
    const prompt = buildSystemPrompt(null)
    // Check a few exact dimensions from the catalog
    expect(prompt).toContain('2.2x0.9x1.0m')  // sofa
    expect(prompt).toContain('0.7x1.8x0.7m')  // fridge
    expect(prompt).toContain('0.4x0.4x0.7m')  // toilet
  })

  test('includes attachTo annotations for wall/ceiling items', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('ceiling-lamp: 0.5x0.3x0.5m (attachTo: ceiling)')
    expect(prompt).toContain('kitchen-cabinet: 0.6x0.7x0.4m (attachTo: wall)')
    expect(prompt).toContain('television: 1.0x0.6x0.1m (attachTo: wall)')
    expect(prompt).toContain('ceiling-fan: 1.0x0.3x1.0m (attachTo: ceiling)')
  })

  test('includes item creation example with asset fields', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('To create an item:')
    expect(prompt).toContain('category: "furniture"')
    expect(prompt).toContain('thumbnail: "/items/sofa/thumbnail.webp"')
    expect(prompt).toContain('src: "/items/sofa/model.glb"')
    expect(prompt).toContain('dimensions: [2.2, 0.9, 1.0]')
  })

  // -----------------------------------------------------------------------
  // New tests — wall connectivity guidance
  // -----------------------------------------------------------------------

  test('includes wall connectivity guidance', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('walls should share endpoints')
    expect(prompt).toContain('wall_north goes from (0,4) to (5,4)')
    expect(prompt).toContain('wall_east should start at (5,4)')
    expect(prompt).toContain('Always list walls in order')
  })

  // -----------------------------------------------------------------------
  // New tests — UI inspector tools
  // -----------------------------------------------------------------------

  test('includes UI inspector tools section', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('## UI Inspector Tools')
    expect(prompt).toContain('vesper_ui_capture_screenshot')
    expect(prompt).toContain('vesper_ui_get_state')
    expect(prompt).toContain('vesper_ui_get_selection')
  })

  test('describes screenshot tool purpose', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('Capture a screenshot')
    expect(prompt).toContain('SEE what the scene looks like')
  })
})
