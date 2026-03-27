import { describe, expect, test } from 'bun:test'
import type { PascalToolCallHandler } from './agent-provider'
import { createVesperBridge } from './vesper-bridge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockToolHandler(): PascalToolCallHandler {
  return {
    project_read: async () => ({ name: 'test', scene: {} }),
    scene_read: async () => ({}),
    scene_applyCommands: async () => ({ status: 'ok', result: {} }),
  }
}

// ---------------------------------------------------------------------------
// VesperBridge
// ---------------------------------------------------------------------------

describe('VesperBridge', () => {
  test('creates a bridge with empty conversation history', () => {
    const bridge = createVesperBridge(
      { apiKey: 'test-key' },
      makeMockToolHandler(),
    )
    expect(bridge.getHistoryLength()).toBe(0)
  })

  test('resetConversation clears history', () => {
    const bridge = createVesperBridge(
      { apiKey: 'test-key' },
      makeMockToolHandler(),
    )
    // History starts empty
    expect(bridge.getHistoryLength()).toBe(0)
    bridge.resetConversation()
    expect(bridge.getHistoryLength()).toBe(0)
  })

  test('chat returns an async generator', () => {
    const bridge = createVesperBridge(
      { apiKey: 'test-key' },
      makeMockToolHandler(),
    )
    const gen = bridge.chat('hello', {
      projectId: 'project_test123',
      sceneContext: { nodes: {}, rootNodeIds: [] },
    })
    // Should be an async generator (has next method)
    expect(typeof gen.next).toBe('function')
    expect(typeof gen.return).toBe('function')
    expect(typeof gen.throw).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// PASCAL_TOOLS
// ---------------------------------------------------------------------------

describe('PASCAL_TOOLS', () => {
  test('exports 3 tool descriptors', async () => {
    const { PASCAL_TOOLS } = await import('./pascal-tool-server')
    expect(PASCAL_TOOLS.length).toBe(3)
    expect(PASCAL_TOOLS.map((t) => t.name)).toEqual([
      'project_read',
      'scene_read',
      'scene_applyCommands',
    ])
  })

  test('all tools have required fields', async () => {
    const { PASCAL_TOOLS } = await import('./pascal-tool-server')
    for (const tool of PASCAL_TOOLS) {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.category).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
      expect(['scene', 'project']).toContain(tool.category)
    }
  })

  test('scene_applyCommands has commands in required fields', async () => {
    const { PASCAL_TOOLS } = await import('./pascal-tool-server')
    const applyCmd = PASCAL_TOOLS.find(
      (t) => t.name === 'scene_applyCommands',
    )
    expect(applyCmd).toBeDefined()
    expect(applyCmd!.inputSchema.required).toEqual([
      'projectId',
      'commands',
    ])
  })
})
