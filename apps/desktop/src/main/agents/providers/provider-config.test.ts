import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { PascalToolCallHandler } from '../agent-provider'
import {
  loadProviderConfig,
  resolveProviderFromConfig,
  saveProviderConfig,
  testProviderConnection,
  type PersistedProviderConfig,
} from './provider-config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `pascal-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

const stubToolHandler: PascalToolCallHandler = {
  project_read: async () => ({ name: 'test', scene: {} }),
  scene_read: async () => ({}),
  scene_applyCommands: async () => ({ status: 'ok', result: {} as any }),
  vesper_ui_get_state: async () => ({
    success: true,
    data: { mode: 'idle', snapshot: null, updatedAt: null },
  }),
  vesper_ui_get_selection: async () => ({
    success: false,
    error: {
      code: 'NO_SELECTION',
      message: 'No UI selection is currently captured.',
      retriable: true,
    },
  }),
  vesper_ui_get_context: async () => ({
    success: false,
    error: {
      code: 'NO_SELECTION',
      message: 'No UI selection is currently captured.',
      retriable: true,
    },
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

// ---------------------------------------------------------------------------
// loadProviderConfig
// ---------------------------------------------------------------------------

describe('loadProviderConfig', () => {
  test('returns stub default when no file exists', async () => {
    const config = await loadProviderConfig(testDir)
    expect(config).toEqual({ provider: 'stub' })
  })

  test('returns stub default when file is invalid JSON', async () => {
    await Bun.write(join(testDir, '.pascal-agent-config.json'), 'not-json')
    const config = await loadProviderConfig(testDir)
    expect(config).toEqual({ provider: 'stub' })
  })

  test('loads saved config from disk', async () => {
    const saved: PersistedProviderConfig = {
      provider: 'anthropic',
      anthropicApiKey: 'sk-test-123',
      model: 'claude-sonnet-4-6',
    }
    await Bun.write(
      join(testDir, '.pascal-agent-config.json'),
      JSON.stringify(saved),
    )

    const config = await loadProviderConfig(testDir)
    expect(config.provider).toBe('anthropic')
    expect(config.anthropicApiKey).toBe('sk-test-123')
    expect(config.model).toBe('claude-sonnet-4-6')
  })

  test('defaults provider to stub when field is missing', async () => {
    await Bun.write(
      join(testDir, '.pascal-agent-config.json'),
      JSON.stringify({ anthropicApiKey: 'sk-test' }),
    )

    const config = await loadProviderConfig(testDir)
    expect(config.provider).toBe('stub')
    expect(config.anthropicApiKey).toBe('sk-test')
  })
})

// ---------------------------------------------------------------------------
// saveProviderConfig + round-trip
// ---------------------------------------------------------------------------

describe('saveProviderConfig', () => {
  test('saveProviderConfig and loadProviderConfig round-trip', async () => {
    const original: PersistedProviderConfig = {
      provider: 'openai',
      openaiApiKey: 'sk-openai-abc',
      model: 'gpt-4o',
    }

    await saveProviderConfig(testDir, original)
    const loaded = await loadProviderConfig(testDir)

    expect(loaded.provider).toBe('openai')
    expect(loaded.openaiApiKey).toBe('sk-openai-abc')
    expect(loaded.model).toBe('gpt-4o')
  })

  test('writes valid JSON', async () => {
    await saveProviderConfig(testDir, { provider: 'stub' })
    const raw = await readFile(
      join(testDir, '.pascal-agent-config.json'),
      'utf8',
    )
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  test('creates parent directories if needed', async () => {
    const nested = join(testDir, 'deeply', 'nested', 'dir')
    await saveProviderConfig(nested, { provider: 'stub' })
    const loaded = await loadProviderConfig(nested)
    expect(loaded.provider).toBe('stub')
  })

  test('overwrites existing config', async () => {
    await saveProviderConfig(testDir, {
      provider: 'anthropic',
      anthropicApiKey: 'first',
    })
    await saveProviderConfig(testDir, {
      provider: 'openai',
      openaiApiKey: 'second',
    })

    const loaded = await loadProviderConfig(testDir)
    expect(loaded.provider).toBe('openai')
    expect(loaded.openaiApiKey).toBe('second')
    expect(loaded.anthropicApiKey).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveProviderFromConfig
// ---------------------------------------------------------------------------

describe('resolveProviderFromConfig', () => {
  test('creates anthropic provider with API key', () => {
    const result = resolveProviderFromConfig({
      provider: 'anthropic',
      anthropicApiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
    })
    expect(result).toEqual({
      provider: 'anthropic',
      config: { apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' },
    })
  })

  test('throws when anthropic key missing', () => {
    // Clear env to ensure no fallback
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      expect(() =>
        resolveProviderFromConfig({ provider: 'anthropic' }),
      ).toThrow('Anthropic API key not configured')
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved
    }
  })

  test('falls back to env var for anthropic key', () => {
    const saved = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'env-key'
    try {
      const result = resolveProviderFromConfig({ provider: 'anthropic' })
      expect(result).toEqual({
        provider: 'anthropic',
        config: { apiKey: 'env-key', model: undefined },
      })
    } finally {
      if (saved) {
        process.env.ANTHROPIC_API_KEY = saved
      } else {
        delete process.env.ANTHROPIC_API_KEY
      }
    }
  })

  test('creates openai provider with API key', () => {
    const result = resolveProviderFromConfig({
      provider: 'openai',
      openaiApiKey: 'sk-openai-test',
      model: 'gpt-4o',
    })
    expect(result).toEqual({
      provider: 'openai',
      config: { apiKey: 'sk-openai-test', model: 'gpt-4o' },
    })
  })

  test('throws when openai key missing', () => {
    const saved = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      expect(() =>
        resolveProviderFromConfig({ provider: 'openai' }),
      ).toThrow('OpenAI API key not configured')
    } finally {
      if (saved) process.env.OPENAI_API_KEY = saved
    }
  })

  test('creates vesper-gateway without key', () => {
    const result = resolveProviderFromConfig({
      provider: 'vesper-gateway',
      model: 'claude-sonnet-4-6',
    })
    expect(result).toEqual({
      provider: 'vesper-gateway',
      config: { model: 'claude-sonnet-4-6' },
    })
  })

  test('creates stub provider', () => {
    const result = resolveProviderFromConfig({ provider: 'stub' })
    expect(result).toEqual({ provider: 'stub' })
  })
})

// ---------------------------------------------------------------------------
// testProviderConnection
// ---------------------------------------------------------------------------

describe('testProviderConnection', () => {
  test('returns ok for stub', async () => {
    const result = await testProviderConnection(
      { provider: 'stub' },
      stubToolHandler,
    )
    expect(result).toEqual({ ok: true })
  })

  test('returns ok for anthropic with key', async () => {
    const result = await testProviderConnection(
      { provider: 'anthropic', anthropicApiKey: 'sk-test' },
      stubToolHandler,
    )
    expect(result).toEqual({ ok: true })
  })

  test('returns error for anthropic without key', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const result = await testProviderConnection(
        { provider: 'anthropic' },
        stubToolHandler,
      )
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Anthropic API key not configured')
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved
    }
  })

  test('returns error for openai without key', async () => {
    const saved = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const result = await testProviderConnection(
        { provider: 'openai' },
        stubToolHandler,
      )
      expect(result.ok).toBe(false)
      expect(result.error).toContain('OpenAI API key not configured')
    } finally {
      if (saved) process.env.OPENAI_API_KEY = saved
    }
  })

  test('returns ok for vesper-gateway', async () => {
    const result = await testProviderConnection(
      { provider: 'vesper-gateway' },
      stubToolHandler,
    )
    expect(result).toEqual({ ok: true })
  })
})
