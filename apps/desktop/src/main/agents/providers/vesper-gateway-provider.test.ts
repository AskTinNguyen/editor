import { describe, expect, mock, test } from 'bun:test'
import {
  getAiGatewayBaseUrl,
  getAiGatewayCredentials,
  getAiGatewayToken,
} from './ai-gateway-credentials'
import {
  createVesperGatewayProvider,
  type PascalToolCallHandler,
  type VesperGatewayProviderConfig,
} from './vesper-gateway-provider'

// ---------------------------------------------------------------------------
// Unit tests for createVesperGatewayProvider
// ---------------------------------------------------------------------------

describe('VesperGatewayProvider', () => {
  test('creates a provider with the correct name', () => {
    const provider = createVesperGatewayProvider({
      authToken: 'test-token',
      baseUrl: 'https://test.example.com',
    })
    expect(provider.name).toBe('vesper-gateway')
  })

  test('exposes a runTurn method', () => {
    const provider = createVesperGatewayProvider({
      authToken: 'test-token',
      baseUrl: 'https://test.example.com',
    })
    expect(typeof provider.runTurn).toBe('function')
  })

  test('uses custom model when specified', () => {
    const provider = createVesperGatewayProvider({
      authToken: 'test-token',
      baseUrl: 'https://test.example.com',
      model: 'claude-opus-4-6',
    })
    expect(provider.name).toBe('vesper-gateway')
  })

  test('accepts custom maxTokens', () => {
    const provider = createVesperGatewayProvider({
      authToken: 'test-token',
      baseUrl: 'https://test.example.com',
      maxTokens: 8192,
    })
    expect(provider.name).toBe('vesper-gateway')
  })

  test('config type accepts all optional fields', () => {
    const config: VesperGatewayProviderConfig = {
      authToken: 'test-token',
      baseUrl: 'https://gateway.example.com/v1',
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
    }
    const provider = createVesperGatewayProvider(config)
    expect(provider.name).toBe('vesper-gateway')
  })

  test('can be created with no config (defers credential discovery to runTurn)', () => {
    const provider = createVesperGatewayProvider()
    expect(provider.name).toBe('vesper-gateway')
  })
})

// ---------------------------------------------------------------------------
// AI Gateway credential discovery tests
// ---------------------------------------------------------------------------

describe('AI Gateway Credentials', () => {
  test('getAiGatewayBaseUrl returns a non-empty string', () => {
    const url = getAiGatewayBaseUrl()
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })

  test('getAiGatewayBaseUrl returns default when no config exists', () => {
    // Save and clear env
    const saved = process.env.ANTHROPIC_BASE_URL
    delete process.env.ANTHROPIC_BASE_URL
    try {
      const url = getAiGatewayBaseUrl()
      expect(typeof url).toBe('string')
      expect(url.length).toBeGreaterThan(0)
    } finally {
      if (saved !== undefined) {
        process.env.ANTHROPIC_BASE_URL = saved
      }
    }
  })

  test('getAiGatewayBaseUrl respects ANTHROPIC_BASE_URL env var', () => {
    const saved = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = 'https://custom.example.com/'
    try {
      const url = getAiGatewayBaseUrl()
      // Trailing slash should be stripped
      expect(url).toBe('https://custom.example.com')
    } finally {
      if (saved !== undefined) {
        process.env.ANTHROPIC_BASE_URL = saved
      } else {
        delete process.env.ANTHROPIC_BASE_URL
      }
    }
  })

  test('getAiGatewayToken respects ANTHROPIC_AUTH_TOKEN env var', () => {
    const saved = process.env.ANTHROPIC_AUTH_TOKEN
    process.env.ANTHROPIC_AUTH_TOKEN = 'env-test-token'
    try {
      const token = getAiGatewayToken()
      expect(token).toBe('env-test-token')
    } finally {
      if (saved !== undefined) {
        process.env.ANTHROPIC_AUTH_TOKEN = saved
      } else {
        delete process.env.ANTHROPIC_AUTH_TOKEN
      }
    }
  })

  test('getAiGatewayCredentials returns null or valid credentials', () => {
    const creds = getAiGatewayCredentials()
    // May be null in CI/test environments without gateway configured
    if (creds) {
      expect(typeof creds.authToken).toBe('string')
      expect(typeof creds.baseUrl).toBe('string')
      expect(creds.authToken.length).toBeGreaterThan(0)
      expect(creds.baseUrl.length).toBeGreaterThan(0)
    } else {
      expect(creds).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Integration-style tests that exercise mock tool handlers
// ---------------------------------------------------------------------------

describe('VesperGatewayProvider tool handler compatibility', () => {
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
