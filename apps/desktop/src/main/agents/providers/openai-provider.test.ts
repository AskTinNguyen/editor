import { describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock the `openai` package so tests run without it installed.
// The mock provides a minimal constructor that records config and returns
// a stub client with a `chat.completions.create` method.
// ---------------------------------------------------------------------------

let lastClientConfig: Record<string, unknown> | undefined
let mockCreateFn = mock(async () => ({
  choices: [
    {
      message: {
        content: 'Hello from mock',
        tool_calls: undefined,
      },
    },
  ],
}))

mock.module('openai', () => {
  class OpenAI {
    chat: { completions: { create: typeof mockCreateFn } }
    constructor(config: Record<string, unknown>) {
      lastClientConfig = config
      this.chat = {
        completions: {
          create: mockCreateFn,
        },
      }
    }
  }
  return { default: OpenAI }
})

// Import after mocking -------------------------------------------------------
const { createOpenAIProvider } = await import('./openai-provider')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProjectId = import('./openai-provider').ProjectId
type PascalToolCallHandler = import('./openai-provider').PascalToolCallHandler
type OpenAIProviderConfig = import('./openai-provider').OpenAIProviderConfig

const TEST_PROJECT_ID = 'proj_001' as ProjectId

function stubToolHandler(
  overrides: Partial<PascalToolCallHandler> = {},
): PascalToolCallHandler {
  return {
    project_read: mock(async (_id: ProjectId) => ({
      name: 'Test Project',
      scene: { nodes: {} },
    })),
    scene_read: mock(async (_id: ProjectId) => ({ nodes: {} })),
    scene_applyCommands: mock(async () => ({
      status: 'ok',
      result: {},
    })),
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
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenAIProvider', () => {
  test('creates a provider with the correct name', () => {
    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    expect(provider.name).toBe('openai')
  })

  test('uses custom model when specified', () => {
    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      model: 'gpt-4-turbo',
    })
    expect(provider.name).toBe('openai')
  })

  test('accepts optional baseURL', () => {
    const provider = createOpenAIProvider({
      apiKey: 'test-key',
      baseURL: 'https://custom.openai.example.com/v1',
    })
    expect(provider.name).toBe('openai')
  })

  test('config type accepts all documented fields', () => {
    const config: OpenAIProviderConfig = {
      apiKey: 'sk-test',
      model: 'gpt-4o',
      maxTokens: 8192,
      baseURL: 'https://api.openai.com/v1',
    }
    const provider = createOpenAIProvider(config)
    expect(provider.name).toBe('openai')
  })

  test('runTurn is a function', () => {
    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    expect(typeof provider.runTurn).toBe('function')
  })

  test('runTurn returns response from model when no tool calls', async () => {
    mockCreateFn = mock(async () => ({
      choices: [
        {
          message: {
            content: 'I moved the wall for you.',
            tool_calls: undefined,
          },
        },
      ],
    }))

    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    const tools = stubToolHandler()

    const result = await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Move the wall',
      sceneContext: { nodes: {} },
      messageHistory: [],
      tools,
    })

    expect(result.response).toBe('I moved the wall for you.')
    expect(result.toolCallsExecuted).toBe(0)
  })

  test('runTurn passes apiKey and baseURL to OpenAI client', async () => {
    mockCreateFn = mock(async () => ({
      choices: [
        {
          message: { content: 'ok', tool_calls: undefined },
        },
      ],
    }))

    const provider = createOpenAIProvider({
      apiKey: 'sk-secret',
      baseURL: 'https://custom.api/v1',
    })
    const tools = stubToolHandler()

    await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Hello',
      sceneContext: null,
      messageHistory: [],
      tools,
    })

    expect(lastClientConfig).toBeDefined()
    expect(lastClientConfig!.apiKey).toBe('sk-secret')
    expect(lastClientConfig!.baseURL).toBe('https://custom.api/v1')
  })

  test('runTurn executes tool calls and returns final response', async () => {
    let callCount = 0
    mockCreateFn = mock(async () => {
      callCount++
      if (callCount === 1) {
        // First call: model requests a tool call
        return {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function' as const,
                    function: {
                      name: 'scene_read',
                      arguments: JSON.stringify({ projectId: TEST_PROJECT_ID }),
                    },
                  },
                ],
              },
            },
          ],
        }
      }
      // Second call: model returns final text
      return {
        choices: [
          {
            message: {
              content: 'Here is the scene.',
              tool_calls: undefined,
            },
          },
        ],
      }
    })

    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    const tools = stubToolHandler()

    const result = await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Show me the scene',
      sceneContext: null,
      messageHistory: [],
      tools,
    })

    expect(result.response).toBe('Here is the scene.')
    expect(result.toolCallsExecuted).toBe(1)
    expect(tools.scene_read).toHaveBeenCalledTimes(1)
  })

  test('runTurn handles tool execution errors gracefully', async () => {
    let callCount = 0
    mockCreateFn = mock(async () => {
      callCount++
      if (callCount === 1) {
        return {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_err',
                    type: 'function' as const,
                    function: {
                      name: 'scene_applyCommands',
                      arguments: JSON.stringify({
                        projectId: TEST_PROJECT_ID,
                        commands: [{ type: 'delete-node', nodeId: 'bad' }],
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }
      }
      return {
        choices: [
          {
            message: {
              content: 'Something went wrong with that operation.',
              tool_calls: undefined,
            },
          },
        ],
      }
    })

    const failHandler = stubToolHandler({
      scene_applyCommands: mock(async () => {
        throw new Error('Node not found')
      }),
    })

    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    const result = await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Delete node bad',
      sceneContext: null,
      messageHistory: [],
      tools: failHandler,
    })

    // Even on tool error the loop should continue and return a response
    expect(result.response).toBe('Something went wrong with that operation.')
    // The tool was still "executed" (attempted), so count increments
    // Actually, looking at the implementation, toolCallsExecuted only increments
    // on success. On error it goes to the catch block without incrementing.
    expect(result.toolCallsExecuted).toBe(0)
  })

  test('runTurn returns max iterations message when exhausted', async () => {
    // Always return tool calls so we never break out
    mockCreateFn = mock(async () => ({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_loop',
                type: 'function' as const,
                function: {
                  name: 'scene_read',
                  arguments: JSON.stringify({ projectId: TEST_PROJECT_ID }),
                },
              },
            ],
          },
        },
      ],
    }))

    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    const tools = stubToolHandler()

    const result = await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Loop forever',
      sceneContext: null,
      messageHistory: [],
      tools,
    })

    expect(result.response).toBe('Max iterations reached.')
    expect(result.toolCallsExecuted).toBe(10)
  })

  test('runTurn includes message history in conversation', async () => {
    let capturedMessages: unknown[] = []
    mockCreateFn = mock(async (params: { messages: unknown[] }) => {
      capturedMessages = params.messages
      return {
        choices: [
          {
            message: { content: 'Got it.', tool_calls: undefined },
          },
        ],
      }
    })

    const provider = createOpenAIProvider({ apiKey: 'test-key' })
    const tools = stubToolHandler()

    await provider.runTurn({
      projectId: TEST_PROJECT_ID,
      prompt: 'Do something',
      sceneContext: { nodes: {} },
      messageHistory: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ],
      tools,
    })

    // system + 2 history + 1 user prompt = 4 messages
    expect(capturedMessages.length).toBe(4)
    expect((capturedMessages[0] as { role: string }).role).toBe('system')
    expect((capturedMessages[1] as { role: string }).role).toBe('user')
    expect((capturedMessages[2] as { role: string }).role).toBe('assistant')
    expect((capturedMessages[3] as { role: string }).role).toBe('user')
    expect((capturedMessages[3] as { content: string }).content).toBe(
      'Do something',
    )
  })
})
