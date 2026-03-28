import { describe, expect, mock, test } from 'bun:test'
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
    vesper_ui_get_state: async () => ({
      success: true,
      data: { mode: 'inspect', snapshot: null, updatedAt: '2026-03-28T00:00:00.000Z' },
    }),
    vesper_ui_get_selection: async () => ({
      success: true,
      data: {
        source: 'dom',
        label: 'Inspect button',
        selector: '#inspect',
        bounds: { x: 1, y: 2, width: 3, height: 4 },
      },
    }),
    vesper_ui_get_context: async () => ({
      success: true,
      data: 'UI_INSPECTOR_CONTEXT\nlabel: Inspect button',
    }),
    vesper_ui_capture_screenshot: async () => ({
      success: false,
      error: {
        code: 'TOOL_UNAVAILABLE',
        message: 'UI inspector screenshot capture is not implemented yet.',
        retriable: false,
      },
    }),
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

  test('routes vesper_ui_get_selection with the current windowId', async () => {
    const selectionCalls: Array<{ projectId: string; windowId?: number }> = []
    const toolHandler = makeMockToolHandler()
    toolHandler.vesper_ui_get_selection = async (payload) => {
      selectionCalls.push(payload)
      return {
        success: true as const,
        data: {
          source: 'dom',
          label: 'Inspect button',
          selector: '#inspect',
          bounds: { x: 1, y: 2, width: 3, height: 4 },
        },
      }
    }

    const mockCreate = mock(async () => {
      if (selectionCalls.length === 0) {
        return {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'vesper_ui_get_selection',
              input: { projectId: 'project_test123' },
            },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 1, output_tokens: 1 },
        }
      }

      return {
        content: [{ type: 'text', text: 'Selection loaded.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      }
    })

    mock.module('@anthropic-ai/sdk', () => {
      class Anthropic {
        messages = {
          create: mockCreate,
        }
      }

      return { default: Anthropic }
    })

    const bridge = createVesperBridge({ apiKey: 'test-key' }, toolHandler)
    const events: Array<{ type: string; [key: string]: unknown }> = []

    for await (const event of bridge.chat('Inspect this', {
      projectId: 'project_test123',
      sceneContext: { nodes: {}, rootNodeIds: [] },
      windowId: 99,
    })) {
      events.push(event)
    }

    expect(selectionCalls).toEqual([{ projectId: 'project_test123', windowId: 99 }])
    expect(
      events.some((event) => event.type === 'tool_start' && event.toolName === 'vesper_ui_get_selection'),
    ).toBe(true)
    expect(
      events.some((event) => event.type === 'text_complete' && event.text === 'Selection loaded.'),
    ).toBe(true)
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
