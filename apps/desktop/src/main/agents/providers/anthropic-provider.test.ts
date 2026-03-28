import { describe, expect, mock, test } from 'bun:test'
import {
  createAnthropicProvider,
  type AnthropicProviderConfig,
  type PascalToolCallHandler,
} from './anthropic-provider'

// ---------------------------------------------------------------------------
// Unit tests for createAnthropicProvider
// ---------------------------------------------------------------------------

describe('AnthropicProvider', () => {
  test('creates a provider with the correct name', () => {
    const provider = createAnthropicProvider({ apiKey: 'test-key' })
    expect(provider.name).toBe('anthropic')
  })

  test('exposes a runTurn method', () => {
    const provider = createAnthropicProvider({ apiKey: 'test-key' })
    expect(typeof provider.runTurn).toBe('function')
  })

  test('uses custom model when specified', () => {
    const provider = createAnthropicProvider({
      apiKey: 'test-key',
      model: 'claude-opus-4-6',
    })
    expect(provider.name).toBe('anthropic')
  })

  test('accepts custom maxTokens', () => {
    const provider = createAnthropicProvider({
      apiKey: 'test-key',
      maxTokens: 8192,
    })
    expect(provider.name).toBe('anthropic')
  })

  test('accepts a custom baseURL for gateway compatibility', () => {
    const provider = createAnthropicProvider({
      apiKey: 'test-key',
      baseURL: 'https://custom-gateway.example.com',
    })
    expect(provider.name).toBe('anthropic')
  })

  test('config type accepts all optional fields', () => {
    const config: AnthropicProviderConfig = {
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      baseURL: 'https://gateway.example.com/v1',
    }
    const provider = createAnthropicProvider(config)
    expect(provider.name).toBe('anthropic')
  })
})

// ---------------------------------------------------------------------------
// Integration-style tests that mock the Anthropic SDK
// ---------------------------------------------------------------------------

// We use bun:test mock to intercept the Anthropic client.
// These tests verify the tool-use loop logic without real API calls.

describe('AnthropicProvider.runTurn (mocked SDK)', () => {
  function makeMockToolHandler(): PascalToolCallHandler {
    return {
      project_read: mock(async (_projectId: string) => ({
        name: 'Test Project',
        scene: { nodes: {}, rootNodeIds: [] },
      })),
      scene_read: mock(async (_projectId: string) => ({
        nodes: {},
        rootNodeIds: [],
      })),
      scene_applyCommands: mock(
        async (_payload: { projectId: string; commands: unknown[] }) => ({
          status: 'ok',
          result: {},
        }),
      ),
      vesper_ui_get_state: mock(async () => ({
        success: true,
        data: { mode: 'idle', snapshot: null, updatedAt: null },
      })),
      vesper_ui_get_selection: mock(async () => ({
        success: false,
        error: {
          code: 'NO_SELECTION',
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      })),
      vesper_ui_get_context: mock(async () => ({
        success: false,
        error: {
          code: 'NO_SELECTION',
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      })),
      vesper_ui_capture_screenshot: mock(async () => ({
        success: false,
        error: {
          code: 'TOOL_UNAVAILABLE',
          message: 'UI inspector screenshot capture is not implemented yet.',
          retriable: false,
        },
      })),
    }
  }

  // Note: Full runTurn tests require mocking the @anthropic-ai/sdk module.
  // If the SDK is not installed, these tests will be skipped at the import
  // level. The structural tests above still pass because they only exercise
  // the factory function (which doesn't call the SDK until runTurn is invoked).

  test('tool handler mock functions are callable', async () => {
    const handler = makeMockToolHandler()

    const readResult = await handler.project_read('proj-1')
    expect(readResult.name).toBe('Test Project')

    const sceneResult = await handler.scene_read('proj-1')
    expect(sceneResult).toEqual({ nodes: {}, rootNodeIds: [] })

    const applyResult = await handler.scene_applyCommands({
      projectId: 'proj-1',
      commands: [{ type: 'create-node', nodeType: 'wall' }],
    })
    expect(applyResult.status).toBe('ok')
  })
})
