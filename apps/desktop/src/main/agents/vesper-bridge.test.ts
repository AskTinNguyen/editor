import { describe, expect, test } from 'bun:test'
import { AVAILABLE_MODELS, THINKING_LEVELS, getThinkingBudgetTokens } from '../../shared/agents'
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

  test('chat options accept model and thinkingLevel', () => {
    const bridge = createVesperBridge(
      { apiKey: 'test-key' },
      makeMockToolHandler(),
    )
    // Verify the bridge accepts model + thinkingLevel options without error
    const gen = bridge.chat('hello', {
      projectId: 'project_test123',
      sceneContext: { nodes: {}, rootNodeIds: [] },
      model: 'claude-opus-4-6',
      thinkingLevel: 'max',
    })
    expect(typeof gen.next).toBe('function')
    expect(bridge.getHistoryLength()).toBe(0)
  })

  test('chat options accept thinkingLevel off', () => {
    const bridge = createVesperBridge(
      { apiKey: 'test-key' },
      makeMockToolHandler(),
    )
    const gen = bridge.chat('hello', {
      projectId: 'project_test123',
      sceneContext: { nodes: {}, rootNodeIds: [] },
      thinkingLevel: 'off',
    })
    expect(typeof gen.next).toBe('function')
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

// ---------------------------------------------------------------------------
// Model & Thinking types
// ---------------------------------------------------------------------------

describe('Model selection types', () => {
  test('AVAILABLE_MODELS includes at least 3 Claude models', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(3)
    const claudeModels = AVAILABLE_MODELS.filter((m) => m.family === 'claude')
    expect(claudeModels.length).toBeGreaterThanOrEqual(3)
  })

  test('all models have required fields', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeDefined()
      expect(model.name).toBeDefined()
      expect(model.family).toBeDefined()
      expect(model.contextWindow).toBeGreaterThan(0)
    }
  })
})

describe('Thinking levels', () => {
  test('THINKING_LEVELS has 3 levels', () => {
    expect(THINKING_LEVELS.length).toBe(3)
    expect(THINKING_LEVELS.map((t) => t.id)).toEqual(['off', 'think', 'max'])
  })

  test('getThinkingBudgetTokens returns correct values', () => {
    expect(getThinkingBudgetTokens('off')).toBe(0)
    expect(getThinkingBudgetTokens('think')).toBe(4000)
    expect(getThinkingBudgetTokens('max')).toBe(16000)
  })

  test('getThinkingBudgetTokens returns 0 for unknown level', () => {
    expect(getThinkingBudgetTokens('unknown' as any)).toBe(0)
  })
})
